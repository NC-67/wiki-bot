importScripts("storage.js");
"use strict";
const WIKI_SIGNUP = "https://www.wiki-masters.com/signup";
const MAIL_URL = "https://10minutemail.com/";
const handledWindows = new Set();
const configuringWindows = new Set();
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitForIncognitoTabs(windowId, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const win = await chrome.windows.get(windowId);
      if (!win.incognito) return [];
      const tabs = await chrome.tabs.query({windowId});
      if (tabs.length > 0) return tabs.sort((a,b) => (a.index||0)-(b.index||0));
    } catch (e) { return []; }
    await sleep(100);
  }
  return [];
}
async function closeAllIncognitoWindows() {
  const windows = await chrome.windows.getAll();
  const inc = windows.filter(w => w && w.incognito && w.id != null && w.id !== chrome.windows.WINDOW_ID_NONE);
  let closed = 0;
  for (const w of inc) { try { await chrome.windows.remove(w.id); closed++; } catch (e) {} }
  return closed;
}
async function openPrivateTabs(windowId) {
  if (configuringWindows.has(windowId) || handledWindows.has(windowId)) return;
  configuringWindows.add(windowId);
  try {
    const win = await chrome.windows.get(windowId);
    if (!win.incognito) return;
    const tabs = await waitForIncognitoTabs(windowId);
    if (!tabs.length) return;
    await chrome.tabs.update(tabs[0].id, {url: MAIL_URL, active: false});
    await sleep(200);
    const current = await chrome.tabs.query({windowId});
    const wikiTabs = current.filter(t => {
      try {
        const u = new URL(t.url || "");
        return u.protocol === "https:" &&
          (u.hostname === "www.wiki-masters.com" || u.hostname === "wiki-masters.com") &&
          u.pathname === "/signup";
      } catch (e) { return false; }
    });
    let wiki = wikiTabs[0] || null;
    for (const d of wikiTabs.slice(1)) { try { await chrome.tabs.remove(d.id); } catch (e) {} }
    if (!wiki) wiki = await chrome.tabs.create({windowId, url: WIKI_SIGNUP, active: true});
    else await chrome.tabs.update(wiki.id, {active: true});
    if (wiki && wiki.id) { try { await chrome.windows.update(windowId, {focused: true}); } catch (e) {} }
    handledWindows.add(windowId);
  } catch (e) { console.warn("[WMPH] openPrivateTabs:", e); }
  finally { configuringWindows.delete(windowId); }
}
async function rotateMailboxForWindow(windowId) {
  try {
    const tabs = await chrome.tabs.query({windowId});
    const mailTab = tabs.find(t => {
      try { return new URL(t.url || "").hostname === "10minutemail.com"; } catch (e) { return false; }
    });
    if (!mailTab || !mailTab.id) return null;
    const r = await chrome.tabs.sendMessage(mailTab.id, {type: "wmph_email_rotate"});
    return (r && r.address) || null;
  } catch (e) { return null; }
}
async function refillSignupForWindow(windowId, email) {
  try {
    const tabs = await chrome.tabs.query({windowId});
    const targets = tabs.filter(t => {
      try {
        const u = new URL(t.url || "");
        return u.protocol === "https:" &&
          (u.hostname === "www.wiki-masters.com" || u.hostname === "wiki-masters.com") &&
          u.pathname.startsWith("/signup");
      } catch (e) { return false; }
    });
    let sent = 0;
    for (const t of targets) {
      try { await chrome.tabs.sendMessage(t.id, {type:"wmph", action:"retrySignup", email:String(email)}); sent++; } catch (e) {}
    }
    return sent;
  } catch (e) { return 0; }
}
chrome.windows.onCreated.addListener(w => {
  if (w && w.incognito) { handledWindows.delete(w.id); setTimeout(() => openPrivateTabs(w.id), 250); }
});
chrome.windows.onRemoved.addListener(id => { handledWindows.delete(id); configuringWindows.delete(id); });
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  if (!msg || msg.type !== "wmph" || msg.action !== "closeAllIncognitoWindows") return;
  closeAllIncognitoWindows().then(n => send({ok:true, closed:n})).catch(e => send({ok:false, error:String(e)}));
  return true;
});
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (!msg || msg.type !== "wmph_email_code" || !msg.code) return;
  (async () => {
    try {
      const wid = (sender && sender.tab && sender.tab.windowId) || msg.sourceWindowId;
      if (wid == null) { send({ok:false, error:"no window"}); return; }
      const tabs = await chrome.tabs.query({windowId: wid});
      const targets = tabs.filter(t => {
        try {
          const u = new URL(t.url || "");
          return u.protocol === "https:" && (u.hostname === "www.wiki-masters.com" || u.hostname === "wiki-masters.com");
        } catch (e) { return false; }
      });
      let sent = 0;
      for (const t of targets) {
        try { await chrome.tabs.sendMessage(t.id, {type:"wmph", action:"fillOtp", code:String(msg.code)}); sent++; } catch (e) {}
      }
      send({ok:true, sent});
    } catch (e) { send({ok:false, error:String(e)}); }
  })();
  return true;
});
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (!msg || msg.type !== "wmph_email_address" || !msg.email) return;
  (async () => {
    try {
      const wid = (sender && sender.tab && sender.tab.windowId) || msg.sourceWindowId;
      if (wid == null) { send({ok:false, error:"no window"}); return; }
      const tabs = await chrome.tabs.query({windowId: wid});
      const targets = tabs.filter(t => {
        try {
          const u = new URL(t.url || "");
          return u.protocol === "https:" &&
            (u.hostname === "www.wiki-masters.com" || u.hostname === "wiki-masters.com") &&
            u.pathname.startsWith("/signup");
        } catch (e) { return false; }
      });
      let sent = 0;
      for (const t of targets) {
        try { await chrome.tabs.sendMessage(t.id, {type:"wmph", action:"fillSignup", email:String(msg.email), delay:msg.delay}); sent++; } catch (e) {}
      }
      send({ok:true, sent});
    } catch (e) { send({ok:false, error:String(e)}); }
  })();
  return true;
});
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (!msg || msg.type !== "wmph_signup_result") return;
  (async () => {
    try {
      if (msg.ok) { send({ok:true, noop:true}); return; }
      const wid = sender && sender.tab && sender.tab.windowId;
      if (wid == null) { send({ok:false, error:"no window"}); return; }
      const reason = String(msg.reason || "");
      const dup = /d[ée]j[àa]|existe|pris|utilis/i.test(reason);
      const to = reason === "timeout";
      if (!dup && !to) { send({ok:false, retried:false, reason}); return; }
      const newAddr = await rotateMailboxForWindow(wid);
      if (!newAddr) { send({ok:false, retried:false, error:"rotation failed"}); return; }
      const sent = await refillSignupForWindow(wid, newAddr);
      send({ok:true, retried: sent > 0, newAddress: newAddr, sent});
    } catch (e) { send({ok:false, error:String(e)}); }
  })();
  return true;
});
