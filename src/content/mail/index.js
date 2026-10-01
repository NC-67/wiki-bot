import { DEFAULT_SETTINGS, MAIL_HOST, MESSAGE, STORAGE_KEYS } from "../../shared/constants.js";
import { loadSettings } from "../../shared/settings.js";
import { normalize, sleep } from "../../shared/util.js";

if (location.hostname === MAIL_HOST) {
  let settings = Object.assign({}, DEFAULT_SETTINGS);
  let lastCode = null;
  let lastMessage = null;
  let lastAddress = null;
  let pollTimer = null;

  async function getWindowId() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return (tabs[0] && tabs[0].windowId) || null;
    } catch (e) {
      return null;
    }
  }

  function getAddress() {
    const input = document.querySelector("#mail_address");
    const value = normalize((input && input.value) || (input && input.getAttribute("value")) || "");
    if (/^[^\s@]+@[^\s@]+$/.test(value)) return value;
    const display = document.querySelector(".mail_address_display");
    const text = normalize((display && display.textContent) || "");
    if (/^[^\s@]+@[^\s@]+$/.test(text)) return text;
    return null;
  }

  async function sendAddress(address) {
    if (!address || address === lastAddress) return;
    lastAddress = address;
    await sleep(settings.signupFillDelay);
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE.emailAddress,
        email: address,
        sourceWindowId: await getWindowId()
      });
    } catch (e) {}
  }

  function isWikiMsg(block) {
    const text = normalize((block && block.innerText) || (block && block.textContent));
    return /wiki-masters\.com/i.test(text) || /WikiMasters/i.test(text);
  }

  function extractCode(block) {
    if (!block || !isWikiMsg(block)) return null;
    const body = block.querySelector(".message_bottom") || block;
    const text = normalize(body.innerText || body.textContent);
    const match = text.match(/code(?:\s+de\s+v[ée]rification)?[^0-9]{0,120}(\d{6,12})/i);
    if (match) return match[1];
    const parts = Array.from(body.querySelectorAll("p,h1,h2,h3,strong")).map((el) => normalize(el.textContent)).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const code = parts[i].match(/^(\d{6,12})$/);
      if (code) return code[1];
    }
    return null;
  }

  function findNewestCode() {
    const blocks = Array.from(document.querySelectorAll(".mail_message"));
    for (let i = 0; i < blocks.length; i++) {
      const code = extractCode(blocks[i]);
      if (!code) continue;
      return { code, messageId: blocks[i].getAttribute("data-message-index") || code };
    }
    return null;
  }

  async function sendCode(code, messageId) {
    if (!code || (code === lastCode && messageId === lastMessage)) return;
    lastCode = code;
    lastMessage = messageId;
    await sleep(settings.emailFillDelay);
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE.emailCode,
        code,
        messageId,
        sourceWindowId: await getWindowId()
      });
    } catch (e) {}
  }

  async function requestNewAddress() {
    try {
      const candidates = Array.from(document.querySelectorAll("button,a")).filter((el) => {
        const text = normalize(el.innerText || el.textContent).toLowerCase();
        return /nouvelle\s+adresse|new\s+address|r[ée]g[ée]n[ée]rer|regenerate|change\s+address/i.test(text);
      });
      const button = candidates[0];
      if (!button) return null;
      lastAddress = null;
      lastCode = null;
      lastMessage = null;
      button.click();
      await sleep(Math.max(200, Number(settings.rotationDelayMs) || 1200));
      const address = getAddress();
      if (address) {
        await sendAddress(address);
        return address;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function scan() {
    const address = getAddress();
    if (address) sendAddress(address);
    const found = findNewestCode();
    if (found) sendCode(found.code, found.messageId);
  }

  function scheduleScan() {
    if (pollTimer) return;
    pollTimer = setTimeout(() => {
      pollTimer = null;
      scan();
    }, Math.max(50, Number(settings.emailPollMs) || 500));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEYS.settings]) return;
    settings = Object.assign({}, DEFAULT_SETTINGS, changes[STORAGE_KEYS.settings].newValue || {});
    scheduleScan();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (!msg || msg.type !== MESSAGE.emailRotate) return;
    requestNewAddress().then((address) => send({ ok: !!address, address }));
    return true;
  });

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  loadSettings().then((loaded) => {
    settings = loaded;
    scan();
    setInterval(scan, Math.max(100, Number(settings.emailPollMs) || 500));
  });
}
