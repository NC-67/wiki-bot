(function () {
  "use strict";
  if (location.hostname !== "10minutemail.com") return;
  var STORAGE_KEY = "wmph_settings";
  var DEFAULTS = {emailPollMs:500, emailFillDelay:150, signupFillDelay:150, rotationDelayMs:1200};
  var settings = Object.assign({}, DEFAULTS);
  var lastCode = null, lastMessage = null, lastAddress = null, pollTimer = null;
  var normalize = function (s) { return (s || "").replace(/\s+/g, " ").trim(); };
  var sleep = function (ms) { return new Promise(function (r) { return setTimeout(r, Math.max(0, Number(ms) || 0)); }); };
  async function loadSettings() {
    try {
      var d = await chrome.storage.local.get(STORAGE_KEY);
      settings = Object.assign({}, DEFAULTS, d[STORAGE_KEY] || {});
    } catch (e) {}
  }
  function getAddress() {
    var i = document.querySelector("#mail_address");
    var v = normalize((i && i.value) || (i && i.getAttribute("value")) || "");
    if (/^[^\s@]+@[^\s@]+$/.test(v)) return v;
    var disp = document.querySelector(".mail_address_display");
    var t = normalize((disp && disp.textContent) || "");
    if (/^[^\s@]+@[^\s@]+$/.test(t)) return t;
    return null;
  }
  async function getWindowId() {
    try {
      var c = await chrome.tabs.query({active:true, currentWindow:true});
      return (c[0] && c[0].windowId) || null;
    } catch (e) { return null; }
  }
  async function sendAddress(addr) {
    if (!addr || addr === lastAddress) return;
    lastAddress = addr;
    await sleep(settings.signupFillDelay);
    try { await chrome.runtime.sendMessage({type:"wmph_email_address", email:addr, sourceWindowId: await getWindowId()}); }
    catch (e) {}
  }
  function getMessageBlocks() { return Array.from(document.querySelectorAll(".mail_message")); }
  function isWikiMsg(b) {
    var t = normalize((b && b.innerText) || (b && b.textContent));
    return /wiki-masters\.com/i.test(t) || /WikiMasters/i.test(t);
  }
  function extractCode(b) {
    if (!b || !isWikiMsg(b)) return null;
    var body = b.querySelector(".message_bottom") || b;
    var t = normalize(body.innerText || body.textContent);
    var c = t.match(/code(?:\s+de\s+v[ée]rification)?[^0-9]{0,120}(\d{6,12})/i);
    if (c) return c[1];
    var ps = Array.from(body.querySelectorAll("p,h1,h2,h3,strong")).map(function (e) { return normalize(e.textContent); }).filter(Boolean);
    for (var i = 0; i < ps.length; i++) { var m = ps[i].match(/^(\d{6,12})$/); if (m) return m[1]; }
    return null;
  }
  function findNewestCode() {
    var blocks = getMessageBlocks();
    for (var i = 0; i < blocks.length; i++) {
      var c = extractCode(blocks[i]);
      if (!c) continue;
      return {code:c, messageId: blocks[i].getAttribute("data-message-index") || c};
    }
    return null;
  }
  async function sendCode(code, mid) {
    if (!code || (code === lastCode && mid === lastMessage)) return;
    lastCode = code; lastMessage = mid;
    await sleep(settings.emailFillDelay);
    try { await chrome.runtime.sendMessage({type:"wmph_email_code", code:code, messageId: mid, sourceWindowId: await getWindowId()}); }
    catch (e) {}
  }
  async function requestNewAddress() {
    try {
      var cands = Array.from(document.querySelectorAll("button,a")).filter(function (el) {
        var t = normalize(el.innerText || el.textContent).toLowerCase();
        return /nouvelle\s+adresse|new\s+address|r[ée]g[ée]n[ée]rer|regenerate|change\s+address/i.test(t);
      });
      var btn = cands[0];
      if (!btn) return null;
      lastAddress = null; lastCode = null; lastMessage = null;
      btn.click();
      await sleep(Math.max(200, Number(settings.rotationDelayMs) || 1200));
      var a = getAddress();
      if (a) { await sendAddress(a); return a; }
      return null;
    } catch (e) { return null; }
  }
  function scan() {
    var a = getAddress();
    if (a) sendAddress(a);
    var f = findNewestCode();
    if (f) sendCode(f.code, f.messageId);
  }
  function scheduleScan() {
    if (pollTimer) return;
    pollTimer = setTimeout(function () { pollTimer = null; scan(); }, Math.max(50, Number(settings.emailPollMs) || DEFAULTS.emailPollMs));
  }
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== "local" || !ch[STORAGE_KEY]) return;
    settings = Object.assign({}, DEFAULTS, ch[STORAGE_KEY].newValue || {});
    scheduleScan();
  });
  chrome.runtime.onMessage.addListener(function (msg, _s, send) {
    if (!msg || msg.type !== "wmph_email_rotate") return;
    requestNewAddress().then(function (a) { send({ok:!!a, address:a}); });
    return true;
  });
  var obs = new MutationObserver(scheduleScan);
  obs.observe(document.documentElement, {subtree:true, childList:true, characterData:true});
  loadSettings().then(function () {
    scan();
    setInterval(scan, Math.max(100, Number(settings.emailPollMs) || DEFAULTS.emailPollMs));
  });
})();
