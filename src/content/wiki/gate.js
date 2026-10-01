import { normalize } from "../../shared/util.js";
import { findOpenPackButton, findStartupGate } from "./dom.js";
import { isPullsPage, isPullStartupPage, isWiki } from "./pages.js";
import { api, session } from "./session.js";

function startAfterStartupGate() {
  if (!isWiki() || !session.startupValidated) return;
  session.captchaConfirmed = true;
  session.startupWaitingForPack = true;
  session.inPullStartup = false;
  session.inPulls = isPullsPage();
  api.setStatus("Validation détectée - démarrage...");
  if (session.startupWatchTimer) clearTimeout(session.startupWatchTimer);
  const started = Date.now();
  const timeout = 20000;
  const poll = Math.max(50, Number(session.settings.pollMs) || 120);
  const watch = () => {
    if (!isWiki() || !session.startupValidated) return;
    if (isPullsPage()) {
      session.startupWaitingForPack = false;
      api.resetForNavigation();
      return;
    }
    const open = findOpenPackButton();
    if (isPullStartupPage() && open && !open.disabled) {
      session.startupWaitingForPack = false;
      session.inPulls = true;
      session.inPullStartup = false;
      session.state.status = session.settings.enabled ? "Recherche d'un pack..." : "Arrêté";
      api.renderOverlay();
      if (session.settings.enabled && !session.busy && !session.halted) api.runLoop();
      return;
    }
    if (Date.now() - started < timeout) session.startupWatchTimer = setTimeout(watch, poll);
    else {
      session.startupWaitingForPack = false;
      api.setStatus("Validation OK - interface introuvable");
    }
  };
  watch();
}

export function installStartupGateSensor() {
  if (session.startupListenerInstalled) return;
  session.startupListenerInstalled = true;
  document.addEventListener("change", (event) => {
    if (!isPullStartupPage()) return;
    session.sawPullGate = true;
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input || input.type !== "checkbox") return;
    const label = input.closest("label");
    if (!/je ne suis pas un robot/i.test(normalize((label && label.innerText) || ""))) return;
    if (event.isTrusted) session.startupUserGestureAt = Date.now();
    if (input.checked) {
      session.startupValidated = false;
      session.inPullStartup = true;
      api.setStatus("Vérification cochée");
    } else {
      session.startupValidated = false;
      session.inPullStartup = true;
      api.setStatus("En attente de validation");
    }
  }, true);
  document.addEventListener("click", (event) => {
    if (!isPullStartupPage()) return;
    session.sawPullGate = true;
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (!target) return;
    const gate = findStartupGate();
    const text = normalize(target.innerText || target.textContent);
    if (!gate.checkbox || !gate.checkbox.checked || text !== "Continuer" || target.disabled) return;
    session.startupUserGestureAt = Date.now();
    session.startupValidated = true;
    session.captchaConfirmed = true;
    api.setStatus("Validation détectée");
    startAfterStartupGate();
  }, true);
  if (session.startupGateObserver) session.startupGateObserver.disconnect();
  session.startupGateObserver = new MutationObserver(() => {
    if (!isPullStartupPage()) return;
    session.sawPullGate = true;
    const gate = findStartupGate();
    const checkbox = gate.checkbox;
    const button = gate.button;
    if (checkbox) {
      session.inPullStartup = true;
      if (checkbox.checked && button && !button.disabled) {
        api.setStatus("Vérification prête");
        if (session.settings.autoStartupGate && !session.startupValidated) {
          session.startupValidated = true;
          session.startupUserGestureAt = Date.now();
          setTimeout(() => {
            try {
              if (button && !button.disabled) {
                button.click();
                session.captchaConfirmed = true;
              }
            } catch (e) {}
          }, Math.max(50, Number(session.settings.signupFillDelay) || 150));
        }
      } else if (!checkbox.checked) {
        api.setStatus("En attente de validation");
        if (session.settings.autoStartupGate && !session.startupValidated) {
          setTimeout(() => {
            try {
              if (!checkbox.checked && !checkbox.disabled) checkbox.click();
            } catch (e) {}
          }, Math.max(50, Number(session.settings.signupFillDelay) || 150));
        }
      }
      return;
    }
    if (!session.startupValidated && session.startupUserGestureAt && Date.now() - session.startupUserGestureAt < 3000 && findOpenPackButton()) {
      session.startupValidated = true;
      session.captchaConfirmed = true;
      startAfterStartupGate();
    }
  });
  if (document.documentElement) {
    session.startupGateObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled", "class", "checked"]
    });
  }
}

api.installStartupGateSensor = installStartupGateSensor;
