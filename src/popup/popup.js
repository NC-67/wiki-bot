import { DEFAULT_SETTINGS, MESSAGE, SLIDER_KEYS, TOGGLE_KEYS } from "../shared/constants.js";
import { loadSettings, saveSettings } from "../shared/settings.js";
import { wmphClearAll, wmphExportCSV, wmphExportJSON, wmphGetAccounts } from "../shared/storage.js";

const $ = (selector) => document.querySelector(selector);

let currentSettings = Object.assign({}, DEFAULT_SETTINGS);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function allowed(url) {
  try {
    const parsed = new URL(url);
    const hostOk = parsed.hostname === "www.wiki-masters.com" || parsed.hostname === "wiki-masters.com";
    return hostOk && (parsed.pathname === "/pull" || parsed.pathname.startsWith("/pulls"));
  } catch (e) {
    return false;
  }
}

function updateInputs() {
  for (const key of SLIDER_KEYS) {
    const input = $("#" + key);
    const output = $("#" + key + "Out");
    if (!input || !output) continue;
    input.value = currentSettings[key];
    output.textContent = currentSettings[key];
  }
  for (const key of TOGGLE_KEYS) {
    const input = $("#" + key);
    if (input) input.checked = !!currentSettings[key];
  }
}

async function send(action, extra) {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error("No tab");
  return chrome.tabs.sendMessage(tab.id, Object.assign({ type: MESSAGE.popup, action }, extra || {}));
}

async function patchSetting(key, value) {
  const stored = await loadSettings();
  stored[key] = value;
  currentSettings = stored;
  await saveSettings(stored);
}

async function refreshAccounts() {
  const summary = $("#accountsSummary");
  const list = $("#accountsList");
  if (!summary || !list) return;
  try {
    const accounts = await wmphGetAccounts();
    const emails = Object.keys(accounts);
    if (!emails.length) {
      summary.textContent = "Aucun compte enregistré.";
      list.innerHTML = "";
      return;
    }
    const totalPacks = emails.reduce((sum, email) => sum + (accounts[email].totalPacks || 0), 0);
    summary.textContent = emails.length + " compte(s) — " + totalPacks + " pack(s)";
    list.innerHTML = emails.map((email) => {
      const account = accounts[email];
      const cls = account.signupStatus === "success" ? "status-ok" : account.signupStatus === "failed" ? "status-fail" : "status-pending";
      const last = account.lastUpdated ? account.lastUpdated.slice(0, 19).replace("T", " ") : "—";
      return '<div class="account-row"><div class="email">' + escapeHtml(email) + '</div><div class="meta"><span class="' + cls + '">' + escapeHtml(account.signupStatus || "pending") + '</span> · ' + (account.totalPacks || 0) + ' pack(s) · ' + escapeHtml(last) + '</div></div>';
    }).join("");
  } catch (e) {
    summary.textContent = "Erreur de chargement des comptes.";
    list.innerHTML = "";
  }
}

async function refresh() {
  const tab = await activeTab();
  const ok = allowed(tab && tab.url);
  let isStartup = false;
  try {
    isStartup = new URL((tab && tab.url) || "").pathname === "/pull";
  } catch (e) {}
  $("#site").textContent = isStartup
    ? "Page /pull détectée — validation du captcha requise"
    : (ok ? "Page /pulls détectée" : "WikiMasters : mode repos (va dans /pull ou /pulls)");
  try {
    currentSettings = await loadSettings();
  } catch (e) {
    currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  }
  try {
    const state = await send("getState");
    $("#status").textContent = state.halted ? "Légendaire trouvée — arrêt" : state.status;
    $("#packs").textContent = "Packs parcourus : " + state.packs;
    $("#toggle").disabled = !state.inPulls;
    $("#toggle").textContent = !state.inPulls ? "Mode repos" : (state.enabled ? "Arrêter l'automatisation" : "Démarrer l'automatisation");
  } catch (e) {
    $("#status").textContent = ok ? "Recharge la page" : "Mode repos";
    $("#packs").textContent = "Packs parcourus : —";
    $("#toggle").disabled = true;
    $("#toggle").textContent = "Page non chargée";
  }
  updateInputs();
  await refreshAccounts();
}

$("#toggle").addEventListener("click", async () => {
  try { await send("toggle"); } catch (e) {}
  await refresh();
});

for (const key of SLIDER_KEYS) {
  const input = $("#" + key);
  if (!input) continue;
  input.addEventListener("input", async (event) => {
    const value = Number(event.target.value);
    $("#" + key + "Out").textContent = value;
    try { await patchSetting(key, value); } catch (e) {}
  });
}

for (const key of TOGGLE_KEYS) {
  const input = $("#" + key);
  if (!input) continue;
  input.addEventListener("change", async (event) => {
    try { await patchSetting(key, !!event.target.checked); } catch (e) {}
  });
}

$("#reset").addEventListener("click", async () => {
  currentSettings = Object.assign({}, DEFAULT_SETTINGS);
  try { await saveSettings(currentSettings); } catch (e) {}
  updateInputs();
  await refresh();
});

$("#closeIncognito").addEventListener("click", async () => {
  const status = $("#closeIncognitoStatus");
  const button = $("#closeIncognito");
  button.disabled = true;
  status.textContent = "Fermeture des fenêtres privées…";
  try {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE.popup, action: "closeAllIncognitoWindows" });
    if (response && response.ok) {
      status.textContent = response.closed ? (response.closed + " fenêtre(s) privée(s) fermée(s).") : "Aucune fenêtre privée à fermer.";
    } else {
      status.textContent = "Impossible de fermer les fenêtres privées.";
    }
  } catch (e) {
    status.textContent = "Erreur lors de la fermeture.";
  } finally {
    button.disabled = false;
  }
});

function downloadText(contents, mime, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  chrome.downloads.download({
    url,
    filename: "wmph-accounts-" + new Date().toISOString().slice(0, 10) + "." + filename,
    saveAs: true
  });
}

$("#exportJSON").addEventListener("click", async () => {
  const status = $("#accountsStatus");
  try {
    const json = await wmphExportJSON();
    if (!json) throw new Error("no data");
    downloadText(json, "application/json", "json");
    status.textContent = "Export JSON lancé.";
  } catch (e) {
    status.textContent = "Erreur export JSON.";
  }
});

$("#exportCSV").addEventListener("click", async () => {
  const status = $("#accountsStatus");
  try {
    const csv = await wmphExportCSV();
    if (!csv) throw new Error("no data");
    downloadText(csv, "text/csv", "csv");
    status.textContent = "Export CSV lancé.";
  } catch (e) {
    status.textContent = "Erreur export CSV.";
  }
});

$("#clearAccounts").addEventListener("click", async () => {
  const status = $("#accountsStatus");
  if (!confirm("Effacer tous les comptes et packs enregistrés ?")) return;
  try {
    await wmphClearAll();
    status.textContent = "Comptes effacés.";
    await refreshAccounts();
  } catch (e) {
    status.textContent = "Erreur lors de l'effacement.";
  }
});

refresh();
