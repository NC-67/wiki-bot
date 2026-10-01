import { api, session } from "./session.js";
import { isPullsPage, isPullStartupPage } from "./pages.js";
import "./runtime.js";
import "./overlay.js";
import "./packs.js";
import "./navigation.js";
import "./gate.js";
import "./signup.js";
import "./messages.js";

async function init() {
  api.installNavigationHooks();
  api.installStartupGateSensor();
  await api.loadSettings();
  const start = () => {
    try {
      api.makeOverlay();
      session.inPulls = isPullsPage();
      session.inPullStartup = isPullStartupPage();
      if (session.inPullStartup) {
        session.sawPullGate = true;
        session.captchaConfirmed = false;
      }
      if (session.observer) session.observer.disconnect();
      session.observer = new MutationObserver(() => {
        if (isPullStartupPage()) {
          session.inPullStartup = true;
          api.installStartupGateSensor();
        }
        if (!session.inPulls || !session.settings.enabled || session.busy || session.halted) return;
        if (session.sawPullGate && !session.captchaConfirmed) return;
        api.clearScheduled();
        session.timer = setTimeout(api.runLoop, Math.max(0, Number(session.settings.pollMs) || 120));
      });
      if (document.documentElement) {
        session.observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["disabled", "class"]
        });
      }
      api.resetForNavigation();
    } catch (e) {
      console.error("[WMPH] init", e);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}

init().catch((error) => {
  console.error("[WikiMasters Pack Hunter]", error);
  api.setStatus("Erreur d'initialisation");
});
