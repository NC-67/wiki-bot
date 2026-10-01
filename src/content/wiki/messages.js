import { DEFAULT_SETTINGS, MESSAGE } from "../../shared/constants.js";
import {
  wmphClearAll,
  wmphExportCSV,
  wmphExportJSON,
  wmphGetAccounts,
  wmphGetCurrentEmail
} from "../../shared/storage.js";
import { api, session } from "./session.js";

function snapshot() {
  return {
    enabled: session.settings.enabled,
    halted: session.halted,
    status: session.state.status,
    packs: session.state.packs,
    inPulls: session.inPulls,
    settings: session.settings
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (!msg || msg.type !== MESSAGE.popup) return;
  if (msg.action === "fillOtp") {
    send({ filled: api.fillOtp(msg.code) });
    return true;
  }
  if (msg.action === "fillSignup") {
    const delay = Number(msg.delay != null ? msg.delay : session.settings.signupFillDelay) || 0;
    api.fillSignup(msg.email, delay).then((filled) => send({ filled }));
    return true;
  }
  if (msg.action === "getState") {
    send(snapshot());
    return true;
  }
  if (msg.action === "toggle") {
    session.settings.enabled = !session.settings.enabled;
    if (!session.settings.enabled) {
      api.clearScheduled();
      api.setStatus("Arrêté");
    } else if (session.inPulls) {
      session.halted = false;
      api.setStatus("Recherche d'un pack...");
      api.runLoop();
    }
    api.saveSettings().then(() => send(snapshot()));
    return true;
  }
  if (msg.action === "updateSettings") {
    session.settings = Object.assign({}, session.settings, msg.settings || {});
    api.saveSettings().then(() => {
      if (session.inPulls && session.settings.enabled && !session.halted) {
        api.clearScheduled();
        session.timer = setTimeout(api.runLoop, session.settings.navigationDelay);
      }
      send({ settings: session.settings });
    });
    return true;
  }
  if (msg.action === "resetSettings") {
    session.settings = Object.assign({}, DEFAULT_SETTINGS);
    api.saveSettings().then(() => send({ settings: session.settings }));
    return true;
  }
  if (msg.action === "retrySignup") {
    session.lastSignupEmail = msg.email || session.lastSignupEmail;
    api.clearSignupWatcher();
    api.fillSignup(session.lastSignupEmail, 0).then((filled) => send({ filled }));
    return true;
  }
  if (msg.action === "getAccounts") {
    wmphGetAccounts().then((accounts) => send({ accounts }));
    return true;
  }
  if (msg.action === "getCurrentAccount") {
    wmphGetCurrentEmail().then((email) => send({ email }));
    return true;
  }
  if (msg.action === "clearAccounts") {
    wmphClearAll().then(() => send({ ok: true }));
    return true;
  }
  if (msg.action === "exportJSON") {
    wmphExportJSON().then((json) => send({ json }));
    return true;
  }
  if (msg.action === "exportCSV") {
    wmphExportCSV().then((csv) => send({ csv }));
    return true;
  }
});
