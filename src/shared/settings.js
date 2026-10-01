import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants.js";

export async function loadSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return Object.assign({}, DEFAULT_SETTINGS, data[STORAGE_KEYS.settings] || {});
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}
