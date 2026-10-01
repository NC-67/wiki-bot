import { isPullsPage, isPullStartupPage } from "./pages.js";
import { api, session } from "./session.js";

export function resetForNavigation() {
  api.clearScheduled();
  session.busy = false;
  session.halted = false;
  session.inPulls = isPullsPage();
  session.inPullStartup = isPullStartupPage();
  if (session.inPullStartup) {
    session.sawPullGate = true;
    session.captchaConfirmed = false;
  }
  session.startupWaitingForPack = false;
  session.startupUserGestureAt = 0;
  if (!session.inPullStartup) session.startupValidated = false;
  api.installStartupGateSensor();
  session.state.status = session.inPulls
    ? (session.settings.enabled ? "Recherche d'un pack..." : "Arrêté")
    : (session.inPullStartup ? "En attente de validation" : "Repos");
  api.renderOverlay();
  if (session.inPulls && session.settings.enabled && (!session.sawPullGate || session.captchaConfirmed)) {
    session.timer = setTimeout(() => api.runLoop(), Math.max(0, Number(session.settings.navigationDelay) || 150));
  }
}

function checkUrlChange() {
  const current = location.href;
  if (current === session.lastUrl) return;
  session.lastUrl = current;
  if (session.navigationTimer) clearTimeout(session.navigationTimer);
  session.navigationTimer = setTimeout(resetForNavigation, Math.max(0, Number(session.settings.navigationDelay) || 150));
}

export function installNavigationHooks() {
  if (session.navigationHooksInstalled) return;
  session.navigationHooksInstalled = true;
  const pushState = history.pushState;
  const replaceState = history.replaceState;
  history.pushState = function () {
    const result = pushState.apply(this, arguments);
    queueMicrotask(checkUrlChange);
    return result;
  };
  history.replaceState = function () {
    const result = replaceState.apply(this, arguments);
    queueMicrotask(checkUrlChange);
    return result;
  };
  window.addEventListener("popstate", checkUrlChange, true);
  window.addEventListener("hashchange", checkUrlChange, true);
  if (session.urlWatcher) clearInterval(session.urlWatcher);
  session.urlWatcher = setInterval(checkUrlChange, 100);
}

api.resetForNavigation = resetForNavigation;
api.installNavigationHooks = installNavigationHooks;
