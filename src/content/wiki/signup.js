import { MESSAGE } from "../../shared/constants.js";
import { wmphSetCurrentEmail, wmphUpsertAccount } from "../../shared/storage.js";
import { normalize, sleep } from "../../shared/util.js";
import { isVisible } from "./dom.js";
import { isSignupPage } from "./pages.js";
import { api, session } from "./session.js";

function reportSignupResult(ok, reason) {
  if (session.currentAccountEmail) {
    wmphUpsertAccount(session.currentAccountEmail, {
      signupStatus: ok ? "success" : "failed",
      failureReason: ok ? null : (reason || null)
    }).catch(() => {});
  }
  try {
    chrome.runtime.sendMessage({
      type: MESSAGE.signupResult,
      ok,
      reason: reason || null,
      email: session.lastSignupEmail || session.currentAccountEmail
    });
  } catch (e) {}
}

function detectSignupError() {
  const selectors = ['[role="alert"]', ".text-red-500", ".text-red-600", ".text-destructive", "[data-error]"];
  for (let i = 0; i < selectors.length; i++) {
    const nodes = Array.from(document.querySelectorAll(selectors[i])).filter(isVisible);
    for (let j = 0; j < nodes.length; j++) {
      const text = normalize(nodes[j].innerText || nodes[j].textContent);
      if (!text) continue;
      if (/d[ée]j[àa]\s+(utilis|pris)|existe\s+d[ée]j[àa]|invalide|incorrect|refus|erreur|trop\s+(court|long)/i.test(text)) return text;
    }
  }
  return null;
}

function watchSignupResult() {
  if (session.signupResultWatcher) clearInterval(session.signupResultWatcher);
  const started = Date.now();
  const timeout = Math.max(2000, Number(session.settings.signupResultTimeoutMs) || 20000);
  const poll = Math.max(100, Number(session.settings.signupResultPollMs) || 250);
  session.signupResultWatcher = setInterval(() => {
    if (!isSignupPage()) {
      clearInterval(session.signupResultWatcher);
      session.signupResultWatcher = null;
      reportSignupResult(true, "navigated");
      return;
    }
    const error = detectSignupError();
    if (error) {
      clearInterval(session.signupResultWatcher);
      session.signupResultWatcher = null;
      reportSignupResult(false, error);
      api.setStatus("Inscription refusée : " + error.slice(0, 60));
      return;
    }
    if (Date.now() - started > timeout) {
      clearInterval(session.signupResultWatcher);
      session.signupResultWatcher = null;
      reportSignupResult(false, "timeout");
      api.setStatus("Inscription : timeout");
    }
  }, poll);
}

function setReactInputValue(input, value) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(input, value);
    else input.value = value;
  } catch (e) {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
}

function waitForCreateAccountButton() {
  const delay = Math.max(0, Number(session.settings.signupSubmitDelay) || 150);
  const poll = Math.max(25, Number(session.settings.signupButtonPollMs) || 75);
  const timeout = Math.max(1000, Number(session.settings.signupButtonTimeoutMs) || 15000);
  setTimeout(() => {
    const started = Date.now();
    let clicked = false;
    const clickable = (button) => {
      if (!button || !document.contains(button) || !isSignupPage()) return false;
      if (button.disabled || button.getAttribute("aria-disabled") === "true") return false;
      const style = getComputedStyle(button);
      if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const check = () => {
      if (clicked || !isSignupPage()) return;
      const button = Array.from(document.querySelectorAll('button[type="submit"]')).find((candidate) => /cr[ée]er\s+mon\s+compte/i.test(normalize(candidate.innerText || candidate.textContent)))
        || Array.from(document.querySelectorAll("button")).find((candidate) => /cr[ée]er\s+mon\s+compte/i.test(normalize(candidate.innerText || candidate.textContent)));
      if (clickable(button)) {
        clicked = true;
        button.click();
        watchSignupResult();
        return;
      }
      if (Date.now() - started < timeout) setTimeout(check, poll);
    };
    check();
  }, delay);
}

export async function fillSignup(email, delay) {
  if (!email || !isSignupPage()) return false;
  const value = String(email).trim();
  const at = value.indexOf("@");
  if (at <= 0 || at === value.length - 1) return false;
  const user = value.slice(0, at);
  const address = value;
  if (user.length < (session.settings.usernameMinLength || 3) || user.length > (session.settings.usernameMaxLength || 24)) return false;
  if (delay == null) delay = session.settings.signupFillDelay;
  if (delay > 0) await sleep(delay);
  session.lastSignupEmail = address;
  session.currentAccountEmail = address;
  wmphUpsertAccount(address, { username: user, password: address, signupStatus: "pending" }).catch(() => {});
  wmphSetCurrentEmail(address).catch(() => {});
  const username = document.querySelector("#username") || document.querySelector('input[autocomplete="username"]');
  const emailInput = document.querySelector("#email") || document.querySelector('input[type="email"][autocomplete="email"]');
  const password = document.querySelector("#password") || document.querySelector('input[type="password"][autocomplete="new-password"]');
  if (!username || !emailInput || !password) return false;
  setReactInputValue(username, user);
  setReactInputValue(emailInput, address);
  setReactInputValue(password, address);
  const checks = Array.from(document.querySelectorAll('#signup-form input[type="checkbox"], form input[type="checkbox"]'));
  for (let i = 0; i < checks.length; i++) {
    if (!checks[i].checked && !checks[i].disabled) checks[i].click();
  }
  const ok = username.value === user && emailInput.value === address && password.value === address && checks.every((box) => box.checked || box.disabled);
  if (ok) waitForCreateAccountButton();
  return ok;
}

export function fillOtp(code) {
  if (!code) return false;
  const input = document.querySelector("#signup-otp-code") || document.querySelector('input[name="otp"]');
  if (!input || input.disabled || input.readOnly) return false;
  const value = String(code).trim();
  if (!/^\d{6,12}$/.test(value)) return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(input, value);
    else input.value = value;
  } catch (e) {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
  input.focus();
  const submit = Array.from(document.querySelectorAll("button")).find((button) => {
    if (!isVisible(button) || button.disabled) return false;
    return /v[ée]rifier\s+et\s+continuer/i.test(normalize(button.innerText || button.textContent));
  });
  if (submit) {
    const delay = Math.max(0, Number(session.settings.otpSubmitDelay) || 150);
    setTimeout(() => {
      const started = Date.now();
      const maxWait = 10000;
      const every = 75;
      const clickable = (button) => {
        if (!button || !document.contains(button) || !isSignupPage()) return false;
        if (button.disabled || button.getAttribute("aria-disabled") === "true") return false;
        if (!isVisible(button)) return false;
        const style = getComputedStyle(button);
        if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      const wait = () => {
        if (!isSignupPage()) return;
        const button = Array.from(document.querySelectorAll("button")).find((candidate) => /v[ée]rifier\s+et\s+continuer/i.test(normalize(candidate.innerText || candidate.textContent)));
        if (clickable(button)) {
          button.click();
          watchSignupResult();
          return;
        }
        if (Date.now() - started < maxWait) setTimeout(wait, every);
      };
      wait();
    }, delay);
  }
  return true;
}

export function clearSignupWatcher() {
  if (session.signupResultWatcher) {
    clearInterval(session.signupResultWatcher);
    session.signupResultWatcher = null;
  }
}

api.fillSignup = fillSignup;
api.fillOtp = fillOtp;
api.clearSignupWatcher = clearSignupWatcher;
