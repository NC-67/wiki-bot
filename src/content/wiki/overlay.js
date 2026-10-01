import { api, session } from "./session.js";

export function setStatus(status) {
  session.state.status = status;
  renderOverlay();
}

export function renderOverlay() {
  const box = document.getElementById("wmph-overlay");
  if (!box) return;
  const status = box.querySelector("#wmph-status");
  const packs = box.querySelector("#wmph-packs");
  const button = box.querySelector("#wmph-toggle");
  packs.textContent = "Packs parcourus : " + session.state.packs;
  if (session.sawPullGate && !session.captchaConfirmed) {
    status.textContent = "Captcha non validé - attente";
    status.style.color = "#fbbf24";
    button.textContent = "Attente captcha";
    button.style.background = "#475569";
    button.style.color = "#fff";
    button.disabled = true;
    return;
  }
  if (session.inPullStartup) {
    status.textContent = "En attente de validation";
    status.style.color = "#fbbf24";
    button.textContent = "Attente";
    button.style.background = "#475569";
    button.style.color = "#fff";
    button.disabled = true;
  } else if (!session.inPulls) {
    status.textContent = "Repos - hors /pulls";
    status.style.color = "#94a3b8";
    button.textContent = "Aller dans /pulls";
    button.style.background = "#475569";
    button.style.color = "#fff";
    button.disabled = true;
  } else if (session.halted) {
    status.textContent = session.state.status;
    status.style.color = "#f87171";
    button.textContent = "Reprendre";
    button.style.background = "#ef4444";
    button.style.color = "#fff";
    button.disabled = false;
  } else if (session.settings.enabled) {
    status.textContent = session.state.status;
    status.style.color = "#4ade80";
    button.textContent = "Arrêter";
    button.style.background = "#22c55e";
    button.style.color = "#052e16";
    button.disabled = false;
  } else {
    status.textContent = "Arrêté";
    status.style.color = "#fbbf24";
    button.textContent = "Démarrer";
    button.style.background = "#f59e0b";
    button.style.color = "#1c1917";
    button.disabled = false;
  }
}

export function makeOverlay() {
  if (document.getElementById("wmph-overlay")) return;
  const box = document.createElement("div");
  box.id = "wmph-overlay";
  box.innerHTML = '<div id="wmph-title">Pack Hunter</div><div id="wmph-status">Repos</div><div id="wmph-packs">Packs parcourus : 0</div><button id="wmph-toggle" type="button">-</button>';
  Object.assign(box.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    width: "220px",
    padding: "12px",
    borderRadius: "12px",
    background: "rgba(15,23,42,.96)",
    color: "#fff",
    font: "13px/1.4 system-ui,sans-serif",
    boxShadow: "0 10px 35px rgba(0,0,0,.35)",
    border: "1px solid rgba(255,255,255,.12)"
  });
  Object.assign(box.querySelector("#wmph-title").style, { fontWeight: "700", marginBottom: "5px" });
  Object.assign(box.querySelector("#wmph-status").style, { color: "#94a3b8", marginBottom: "3px" });
  Object.assign(box.querySelector("#wmph-packs").style, { color: "rgba(255,255,255,.65)", fontSize: "12px", marginBottom: "9px" });
  Object.assign(box.querySelector("#wmph-toggle").style, {
    width: "100%",
    border: "0",
    borderRadius: "8px",
    padding: "8px",
    cursor: "pointer",
    fontWeight: "700"
  });
  box.querySelector("#wmph-toggle").addEventListener("click", () => {
    if (!session.inPulls) return;
    if (session.sawPullGate && !session.captchaConfirmed) return;
    if (session.halted) {
      session.halted = false;
      session.settings.enabled = true;
      api.saveSettings().then(() => {
        setStatus("Recherche d'un pack...");
        api.runLoop();
      });
    } else {
      session.settings.enabled = !session.settings.enabled;
      api.saveSettings().then(() => {
        if (!session.settings.enabled) {
          session.busy = false;
          setStatus("Arrêté");
          api.clearScheduled();
        } else {
          setStatus("Recherche d'un pack...");
          api.runLoop();
        }
      });
    }
  });
  document.documentElement.appendChild(box);
  renderOverlay();
}

api.setStatus = setStatus;
api.renderOverlay = renderOverlay;
api.makeOverlay = makeOverlay;
