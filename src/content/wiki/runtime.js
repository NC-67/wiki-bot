import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../../shared/constants.js";
import { loadSettings, saveSettings } from "../../shared/settings.js";
import { api, session } from "./session.js";

export function clearScheduled() {
  if (session.timer) clearTimeout(session.timer);
  session.timer = null;
  if (session.navigationTimer) clearTimeout(session.navigationTimer);
  session.navigationTimer = null;
  if (session.startupWatchTimer) clearTimeout(session.startupWatchTimer);
  session.startupWatchTimer = null;
}

export async function persistSettings() {
  await saveSettings(session.settings);
}

export async function readSettings() {
  session.settings = await loadSettings();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEYS.settings]) return;
  session.settings = Object.assign({}, DEFAULT_SETTINGS, changes[STORAGE_KEYS.settings].newValue || {});
  api.renderOverlay();
  if (session.inPulls && session.settings.enabled && !session.halted) {
    clearScheduled();
    session.timer = setTimeout(api.runLoop, session.settings.navigationDelay);
  }
});

api.clearScheduled = clearScheduled;
api.saveSettings = persistSettings;
api.loadSettings = readSettings;
