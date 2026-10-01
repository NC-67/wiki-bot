import { MAIL_URL, MESSAGE, WIKI_SIGNUP_URL } from "../shared/constants.js";
import { sleep } from "../shared/util.js";
import { isMailHost, isWikiSignup } from "../shared/url.js";

const handledWindows = new Set();
const configuringWindows = new Set();

async function waitForIncognitoTabs(windowId, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const win = await chrome.windows.get(windowId);
      if (!win.incognito) return [];
      const tabs = await chrome.tabs.query({ windowId });
      if (tabs.length > 0) return tabs.sort((a, b) => (a.index || 0) - (b.index || 0));
    } catch (e) {
      return [];
    }
    await sleep(100);
  }
  return [];
}

export async function closeAllIncognitoWindows() {
  const windows = await chrome.windows.getAll();
  const incognito = windows.filter((win) => win && win.incognito && win.id != null && win.id !== chrome.windows.WINDOW_ID_NONE);
  let closed = 0;
  for (const win of incognito) {
    try {
      await chrome.windows.remove(win.id);
      closed++;
    } catch (e) {}
  }
  return closed;
}

export async function openPrivateTabs(windowId) {
  if (configuringWindows.has(windowId) || handledWindows.has(windowId)) return;
  configuringWindows.add(windowId);
  try {
    const win = await chrome.windows.get(windowId);
    if (!win.incognito) return;
    const tabs = await waitForIncognitoTabs(windowId);
    if (!tabs.length) return;
    await chrome.tabs.update(tabs[0].id, { url: MAIL_URL, active: false });
    await sleep(200);
    const current = await chrome.tabs.query({ windowId });
    const wikiTabs = current.filter((tab) => isWikiSignup(tab.url) && new URL(tab.url).pathname === "/signup");
    let wiki = wikiTabs[0] || null;
    for (const extra of wikiTabs.slice(1)) {
      try { await chrome.tabs.remove(extra.id); } catch (e) {}
    }
    if (!wiki) wiki = await chrome.tabs.create({ windowId, url: WIKI_SIGNUP_URL, active: true });
    else await chrome.tabs.update(wiki.id, { active: true });
    if (wiki && wiki.id) {
      try { await chrome.windows.update(windowId, { focused: true }); } catch (e) {}
    }
    handledWindows.add(windowId);
  } catch (e) {
    console.warn("[WMPH] openPrivateTabs:", e);
  } finally {
    configuringWindows.delete(windowId);
  }
}

export async function rotateMailboxForWindow(windowId) {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    const mailTab = tabs.find((tab) => isMailHost(tab.url));
    if (!mailTab || !mailTab.id) return null;
    const response = await chrome.tabs.sendMessage(mailTab.id, { type: MESSAGE.emailRotate });
    return (response && response.address) || null;
  } catch (e) {
    return null;
  }
}

export async function refillSignupForWindow(windowId, email) {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    const targets = tabs.filter((tab) => isWikiSignup(tab.url));
    let sent = 0;
    for (const tab of targets) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: MESSAGE.popup, action: "retrySignup", email: String(email) });
        sent++;
      } catch (e) {}
    }
    return sent;
  } catch (e) {
    return 0;
  }
}

chrome.windows.onCreated.addListener((win) => {
  if (win && win.incognito) {
    handledWindows.delete(win.id);
    setTimeout(() => openPrivateTabs(win.id), 250);
  }
});

chrome.windows.onRemoved.addListener((id) => {
  handledWindows.delete(id);
  configuringWindows.delete(id);
});
