import { wmphAppendPack } from "../../shared/storage.js";
import { normalize, sleep } from "../../shared/util.js";
import {
  findContinueButton,
  findMoreCardsButton,
  findNextButton,
  findOpenPackButton,
  isVisible,
  viewerIsOpen
} from "./dom.js";
import { api, session } from "./session.js";

async function waitForPackResult(timeout) {
  timeout = timeout || 12000;
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (!session.inPulls || !session.settings.enabled || session.halted) return false;
    if (viewerIsOpen()) return true;
    await sleep(session.settings.pollMs);
  }
  return false;
}

function extractCardInfo() {
  const card = document.querySelector(".rounded-2xl");
  if (!card) return null;
  const nameNode = card.querySelector("h3");
  const name = normalize((nameNode && nameNode.innerText) || (nameNode && nameNode.textContent) || "");
  if (!name) return null;
  const image = card.querySelector("img");
  const imgAlt = (image && image.getAttribute("alt")) || "";
  let rarity = "";
  const divs = card.querySelectorAll("div");
  for (let i = 0; i < divs.length; i++) {
    const el = divs[i];
    if (!isVisible(el)) continue;
    const cls = typeof el.className === "string" ? el.className : "";
    if (cls.indexOf("absolute") === -1 || cls.indexOf("top-2") === -1 || cls.indexOf("left-2") === -1) continue;
    const text = normalize(el.textContent);
    if (/^(L|UR|SR|R|PC|C)$/.test(text)) {
      rarity = text;
      break;
    }
  }
  if (!rarity) {
    const shimmer = card.querySelector(".legendary-shimmer-sheen");
    if (shimmer || /legendary|l[ée]gendaire/i.test(imgAlt)) rarity = "L";
  }
  return { name, rarity: rarity || "unknown", imgAlt };
}

async function inspectCurrentCard() {
  await sleep(session.settings.viewDelay);
  if (!session.inPulls || !session.settings.enabled || session.halted) return false;
  const info = extractCardInfo();
  if (info) session.currentPackCards.push(info);
  const more = findMoreCardsButton();
  if (more) {
    const next = findNextButton();
    if (!next || next.disabled) {
      api.setStatus("Attente de la prochaine carte...");
      await sleep(session.settings.retryDelay);
      return true;
    }
    next.click();
    await sleep(session.settings.viewDelay);
    return true;
  }
  const cont = findContinueButton();
  if (cont) {
    if (session.currentAccountEmail && session.currentPackCards.length) {
      session.packCounter++;
      const pack = {
        packId: "p_" + Date.now() + "_" + session.packCounter,
        openedAt: session.currentPackStartedAt ? new Date(session.currentPackStartedAt).toISOString() : new Date().toISOString(),
        closedAt: new Date().toISOString(),
        cards: session.currentPackCards.slice()
      };
      wmphAppendPack(session.currentAccountEmail, pack).catch(() => {});
    }
    session.currentPackCards = [];
    session.currentPackStartedAt = null;
    cont.click();
    session.state.packs++;
    api.renderOverlay();
    await sleep(session.settings.actionDelay);
    return true;
  }
  return true;
}

export async function runLoop() {
  if (session.busy || !session.inPulls || !session.settings.enabled || session.halted) return;
  if (session.sawPullGate && !session.captchaConfirmed) {
    api.setStatus("Captcha non validé - attente");
    return;
  }
  session.busy = true;
  try {
    while (session.inPulls && session.settings.enabled && !session.halted) {
      if (session.sawPullGate && !session.captchaConfirmed) {
        api.setStatus("Captcha non validé - attente");
        break;
      }
      if (viewerIsOpen()) {
        api.setStatus("Analyse du pack...");
        if (!(await inspectCurrentCard())) break;
        continue;
      }
      const open = findOpenPackButton();
      if (open && !open.disabled) {
        api.setStatus("Ouverture du pack...");
        session.currentPackStartedAt = Date.now();
        session.currentPackCards = [];
        open.click();
        const appeared = await waitForPackResult();
        if (!appeared && session.inPulls && session.settings.enabled) {
          api.setStatus("Attente du résultat...");
          await sleep(session.settings.retryDelay);
        }
        continue;
      }
      if (document.body.innerText.indexOf("Sanction anti-triche") !== -1) {
        session.settings.enabled = false;
        session.halted = true;
        await api.saveSettings();
        api.setStatus("Arrêt : restriction anti-triche");
        break;
      }
      const body = normalize(document.body.innerText);
      api.setStatus(/Aucun paquet|paquets disponibles/i.test(body) ? "Aucun pack disponible" : "Recherche d'un pack...");
      await sleep(session.settings.retryDelay);
    }
  } finally {
    session.busy = false;
    api.renderOverlay();
  }
}

api.runLoop = runLoop;
