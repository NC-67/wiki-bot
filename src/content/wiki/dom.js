import { normalize } from "../../shared/util.js";

export function isVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

export function allButtons() {
  return Array.from(document.querySelectorAll("button")).filter(isVisible);
}

export function findStartupGate() {
  const checkbox = Array.from(document.querySelectorAll('input[type="checkbox"]')).find((input) => {
    const label = input.closest("label");
    return /je ne suis pas un robot/i.test(normalize((label && label.innerText) || ""));
  });
  if (!checkbox) return { checkbox: null, button: null };
  const label = checkbox.closest("label");
  const container = checkbox.closest("div.relative") || (label && label.parentElement);
  const buttons = Array.from((container || document).querySelectorAll("button")).filter(isVisible);
  const button = buttons.find((candidate) => normalize(candidate.innerText || candidate.textContent) === "Continuer") || null;
  return { checkbox, button };
}

export function findOpenPackButton() {
  const image = Array.from(document.querySelectorAll('img[alt="Ouvrir un paquet"]')).find(isVisible);
  if (image) {
    const button = image.closest("button");
    if (button && !button.disabled) return button;
  }
  return allButtons().find((button) => {
    const text = normalize(button.innerText);
    return /^Ouvrir$/.test(text) && !button.disabled && !/pack pro/i.test((button.parentElement && button.parentElement.innerText) || "");
  }) || null;
}

export function findContinueButton() {
  return allButtons().find((button) => normalize(button.innerText) === "Continuer") || null;
}

export function findMoreCardsButton() {
  return allButtons().find((button) => /^Encore \d+ carte/.test(normalize(button.innerText))) || null;
}

export function viewerIsOpen() {
  return !!findContinueButton() || !!findMoreCardsButton() || !!document.querySelector(".legendary-shimmer-sheen");
}

export function findNextButton() {
  const buttons = allButtons();
  for (let i = 0; i < buttons.length; i++) {
    if (buttons[i].querySelector('polyline[points="9 18 15 12 9 6"]')) return buttons[i];
  }
  const more = findMoreCardsButton();
  if (more) {
    const row = more.parentElement;
    if (row) {
      const rowButtons = Array.from(row.querySelectorAll("button")).filter(isVisible);
      if (rowButtons.length) return rowButtons[rowButtons.length - 1];
    }
  }
  return null;
}
