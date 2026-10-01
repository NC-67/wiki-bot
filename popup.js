const $ = s => document.querySelector(s);
const DEFAULTS = {enabled:true,pollMs:120,actionDelay:250,viewDelay:180,retryDelay:500,navigationDelay:150,emailPollMs:500,emailFillDelay:150,signupFillDelay:150,signupSubmitDelay:150,signupButtonPollMs:75,signupButtonTimeoutMs:15000,otpSubmitDelay:150,autoStartupGate:true,autoSignup:true,signupResultTimeoutMs:20000,signupResultPollMs:250,usernameMinLength:3,usernameMaxLength:24};
let currentSettings = Object.assign({}, DEFAULTS);
async function activeTab() {
  const t = await chrome.tabs.query({active:true,currentWindow:true});
  return t[0];
}
function allowed(url) {
  try {
    const u = new URL(url);
    return (u.hostname === "www.wiki-masters.com" || u.hostname === "wiki-masters.com") && (u.pathname === "/pull" || u.pathname.startsWith("/pulls"));
  } catch (e) { return false; }
}
function updateInputs() {
  const keys = ["pollMs","actionDelay","viewDelay","retryDelay","navigationDelay","emailPollMs","emailFillDelay","signupFillDelay","signupSubmitDelay","signupButtonPollMs","signupButtonTimeoutMs","otpSubmitDelay","signupResultTimeoutMs","signupResultPollMs"];
  for (const k of keys) {
    const el = $("#" + k), out = $("#" + k + "Out");
    if (!el || !out) continue;
    el.value = currentSettings[k]; out.textContent = currentSettings[k];
  }
  for (const k of ["autoStartupGate","autoSignup"]) {
    const el = $("#" + k); if (el) el.checked = !!currentSettings[k];
  }
}
async function send(action, extra) {
  extra = extra || {};
  const t = await activeTab();
  if (!t || !t.id) throw new Error("No tab");
  return chrome.tabs.sendMessage(t.id, Object.assign({type:"wmph", action}, extra));
}
async function refresh() {
  const tab = await activeTab();
  const ok = allowed(tab && tab.url);
  let isStartup = false;
  try { isStartup = new URL((tab && tab.url) || "").pathname === "/pull"; } catch (e) {}
  $("#site").textContent = isStartup ? "Page /pull détectée — validation du captcha requise" : (ok ? "Page /pulls détectée" : "WikiMasters : mode repos (va dans /pull ou /pulls)");
  try {
    const state = await send("getState");
    currentSettings = Object.assign({}, DEFAULTS, state.settings || {});
    $("#status").textContent = state.halted ? "Légendaire trouvée — arrêt" : state.status;
    $("#packs").textContent = "Packs parcourus : " + state.packs;
    $("#toggle").disabled = !state.inPulls;
    $("#toggle").textContent = !state.inPulls ? "Mode repos" : (state.enabled ? "Arrêter l'automatisation" : "Démarrer l'automatisation");
  } catch (e) {
    $("#status").textContent = ok ? "Recharge la page" : "Mode repos";
    $("#packs").textContent = "Packs parcourus : —";
    $("#toggle").disabled = true; $("#toggle").textContent = "Page non chargée";
  }
  updateInputs();
  refreshAccounts().catch(() => {});
}
$("#toggle").addEventListener("click", async () => {
  try { await send("toggle"); } catch (e) {}
  await refresh();
});
const sliderKeys = ["pollMs","actionDelay","viewDelay","retryDelay","navigationDelay","emailPollMs","emailFillDelay","signupFillDelay","signupSubmitDelay","signupButtonPollMs","signupButtonTimeoutMs","otpSubmitDelay","signupResultTimeoutMs","signupResultPollMs"];
for (const k of sliderKeys) {
  const el = $("#" + k);
  if (!el) continue;
  el.addEventListener("input", async e => {
    currentSettings[k] = Number(e.target.value);
    $("#" + k + "Out").textContent = currentSettings[k];
    try { await send("updateSettings", {settings:{[k]: currentSettings[k]}}); } catch (err) {}
  });
}
for (const k of ["autoStartupGate","autoSignup"]) {
  const el = $("#" + k);
  if (!el) continue;
  el.addEventListener("change", async e => {
    currentSettings[k] = !!e.target.checked;
    try { await send("updateSettings", {settings:{[k]: currentSettings[k]}}); } catch (err) {}
  });
}
$("#reset").addEventListener("click", async () => {
  try {
    const r = await send("resetSettings");
    currentSettings = Object.assign({}, DEFAULTS, r.settings || {});
  } catch (e) { currentSettings = Object.assign({}, DEFAULTS); }
  updateInputs();
  await refresh();
});
async function refreshAccounts() {
  const summary = $("#accountsSummary"), list = $("#accountsList");
  if (!summary || !list) return;
  try {
    const r = await send("getAccounts");
    const accounts = (r && r.accounts) || {};
    const emails = Object.keys(accounts);
    if (!emails.length) { summary.textContent = "Aucun compte enregistré."; list.innerHTML = ""; return; }
    const tp = emails.reduce((s, e) => s + (accounts[e].totalPacks || 0), 0);
    summary.textContent = emails.length + " compte(s) — " + tp + " pack(s)";
    list.innerHTML = emails.map(email => {
      const a = accounts[email];
      const cls = a.signupStatus === "success" ? "status-ok" : a.signupStatus === "failed" ? "status-fail" : "status-pending";
      const last = a.lastUpdated ? a.lastUpdated.slice(0, 19).replace("T", " ") : "—";
      return '<div class="account-row"><div class="email">' + email + '</div><div class="meta"><span class="' + cls + '">' + (a.signupStatus || "pending") + '</span> · ' + (a.totalPacks || 0) + ' pack(s) · ' + last + '</div></div>';
    }).join("");
  } catch (e) { summary.textContent = "Erreur de chargement des comptes."; list.innerHTML = ""; }
}
$("#closeIncognito").addEventListener("click", async () => {
  const status = $("#closeIncognitoStatus"), button = $("#closeIncognito");
  button.disabled = true; status.textContent = "Fermeture des fenêtres privées…";
  try {
    const r = await chrome.runtime.sendMessage({type:"wmph", action:"closeAllIncognitoWindows"});
    if (r && r.ok) status.textContent = r.closed ? (r.closed + " fenêtre(s) privée(s) fermée(s).") : "Aucune fenêtre privée à fermer.";
    else status.textContent = "Impossible de fermer les fenêtres privées.";
  } catch (e) { status.textContent = "Erreur lors de la fermeture."; }
  finally { button.disabled = false; }
});
$("#exportJSON").addEventListener("click", async () => {
  const status = $("#accountsStatus");
  try {
    const r = await send("exportJSON");
    if (!r || !r.json) throw new Error("no data");
    const url = URL.createObjectURL(new Blob([r.json], {type:"application/json"}));
    chrome.downloads.download({url, filename: "wmph-accounts-" + new Date().toISOString().slice(0, 10) + ".json", saveAs: true});
    status.textContent = "Export JSON lancé.";
  } catch (e) { status.textContent = "Erreur export JSON."; }
});
$("#exportCSV").addEventListener("click", async () => {
  const status = $("#accountsStatus");
  try {
    const r = await send("exportCSV");
    if (!r || !r.csv) throw new Error("no data");
    const url = URL.createObjectURL(new Blob([r.csv], {type:"text/csv"}));
    chrome.downloads.download({url, filename: "wmph-accounts-" + new Date().toISOString().slice(0, 10) + ".csv", saveAs: true});
    status.textContent = "Export CSV lancé.";
  } catch (e) { status.textContent = "Erreur export CSV."; }
});
$("#clearAccounts").addEventListener("click", async () => {
  const status = $("#accountsStatus");
  if (!confirm("Effacer tous les comptes et packs enregistrés ?")) return;
  try { await send("clearAccounts"); status.textContent = "Comptes effacés."; await refreshAccounts(); }
  catch (e) { status.textContent = "Erreur lors de l'effacement."; }
});
refresh();
