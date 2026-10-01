import { MESSAGE } from "../shared/constants.js";
import { isWikiHttps, isWikiSignup } from "../shared/url.js";
import { closeAllIncognitoWindows, refillSignupForWindow, rotateMailboxForWindow } from "./incognito.js";

function windowIdFrom(sender, msg) {
  return (sender && sender.tab && sender.tab.windowId) || msg.sourceWindowId;
}

async function wikiTabs(windowId, signupOnly) {
  const tabs = await chrome.tabs.query({ windowId });
  return tabs.filter((tab) => signupOnly ? isWikiSignup(tab.url) : isWikiHttps(tab.url));
}

async function forwardToWiki(sender, msg, payload, signupOnly) {
  const windowId = windowIdFrom(sender, msg);
  if (windowId == null) return { ok: false, error: "no window" };
  const targets = await wikiTabs(windowId, signupOnly);
  let sent = 0;
  for (const tab of targets) {
    try {
      await chrome.tabs.sendMessage(tab.id, payload);
      sent++;
    } catch (e) {}
  }
  return { ok: true, sent };
}

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (!msg || !msg.type) return;

  if (msg.type === MESSAGE.popup && msg.action === "closeAllIncognitoWindows") {
    closeAllIncognitoWindows()
      .then((closed) => send({ ok: true, closed }))
      .catch((error) => send({ ok: false, error: String(error) }));
    return true;
  }

  if (msg.type === MESSAGE.emailCode && msg.code) {
    forwardToWiki(sender, msg, { type: MESSAGE.popup, action: "fillOtp", code: String(msg.code) }, false)
      .then(send)
      .catch((error) => send({ ok: false, error: String(error) }));
    return true;
  }

  if (msg.type === MESSAGE.emailAddress && msg.email) {
    forwardToWiki(sender, msg, {
      type: MESSAGE.popup,
      action: "fillSignup",
      email: String(msg.email),
      delay: msg.delay
    }, true)
      .then(send)
      .catch((error) => send({ ok: false, error: String(error) }));
    return true;
  }

  if (msg.type === MESSAGE.signupResult) {
    if (msg.ok) {
      send({ ok: true, noop: true });
      return true;
    }
    const windowId = sender && sender.tab && sender.tab.windowId;
    if (windowId == null) {
      send({ ok: false, error: "no window" });
      return true;
    }
    const reason = String(msg.reason || "");
    const duplicate = /d[ée]j[àa]|existe|pris|utilis/i.test(reason);
    const timeout = reason === "timeout";
    if (!duplicate && !timeout) {
      send({ ok: false, retried: false, reason });
      return true;
    }
    rotateMailboxForWindow(windowId)
      .then(async (address) => {
        if (!address) {
          send({ ok: false, retried: false, error: "rotation failed" });
          return;
        }
        const sent = await refillSignupForWindow(windowId, address);
        send({ ok: true, retried: sent > 0, newAddress: address, sent });
      })
      .catch((error) => send({ ok: false, error: String(error) }));
    return true;
  }
});
