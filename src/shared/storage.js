import { STORAGE_KEYS, VERSION } from "./constants.js";

export async function wmphGetAccounts() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.accounts);
  return data[STORAGE_KEYS.accounts] || {};
}

export async function wmphSetAccounts(accounts) {
  await chrome.storage.local.set({ [STORAGE_KEYS.accounts]: accounts });
}

export async function wmphUpsertAccount(email, patch) {
  if (!email) return null;
  const accounts = await wmphGetAccounts();
  const existing = accounts[email] || {
    email,
    username: email.split("@")[0] || "",
    password: email,
    createdAt: new Date().toISOString(),
    signupStatus: "pending",
    packs: [],
    totalPacks: 0
  };
  const merged = Object.assign({}, existing, patch, { lastUpdated: new Date().toISOString() });
  accounts[email] = merged;
  await wmphSetAccounts(accounts);
  return merged;
}

export async function wmphGetAccount(email) {
  const accounts = await wmphGetAccounts();
  return accounts[email] || null;
}

export async function wmphSetCurrentEmail(email) {
  await chrome.storage.local.set({ [STORAGE_KEYS.currentEmail]: email || "" });
}

export async function wmphGetCurrentEmail() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.currentEmail);
  return data[STORAGE_KEYS.currentEmail] || null;
}

export async function wmphAppendPack(email, pack) {
  if (!email || !pack) return null;
  const accounts = await wmphGetAccounts();
  const account = accounts[email];
  if (!account) return null;
  account.packs = account.packs || [];
  account.packs.push(pack);
  account.totalPacks = (account.totalPacks || 0) + 1;
  account.lastUpdated = new Date().toISOString();
  accounts[email] = account;
  await wmphSetAccounts(accounts);
  return account;
}

export async function wmphDeleteAccount(email) {
  const accounts = await wmphGetAccounts();
  delete accounts[email];
  await wmphSetAccounts(accounts);
}

export async function wmphClearAll() {
  await chrome.storage.local.remove([STORAGE_KEYS.accounts, STORAGE_KEYS.currentEmail]);
}

export async function wmphExportJSON() {
  const accounts = await wmphGetAccounts();
  const cleaned = {};
  for (const [email, acc] of Object.entries(accounts)) {
    cleaned[email] = {
      email: acc.email,
      username: acc.username,
      password: acc.password,
      createdAt: acc.createdAt,
      signupStatus: acc.signupStatus,
      failureReason: acc.failureReason || null,
      totalPacks: acc.totalPacks || 0,
      lastUpdated: acc.lastUpdated || null,
      packs: (acc.packs || []).map((pack) => ({
        packId: pack.packId || null,
        openedAt: pack.openedAt || null,
        closedAt: pack.closedAt || null,
        cardCount: (pack.cards || []).length,
        cards: (pack.cards || []).map((card) => ({
          name: card.name || "",
          rarity: card.rarity || "unknown",
          imgAlt: card.imgAlt || ""
        }))
      }))
    };
  }
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: VERSION,
    accountCount: Object.keys(cleaned).length,
    accounts: cleaned
  }, null, 2);
}

export async function wmphExportCSV() {
  const accounts = await wmphGetAccounts();
  const esc = (value) => '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
  const header = [
    "email", "username", "password", "createdAt", "signupStatus", "failureReason",
    "totalPacks", "lastUpdated",
    "packId", "packOpenedAt", "packClosedAt", "packCardCount",
    "cardIndex", "cardName", "cardRarity", "cardImgAlt"
  ];
  const rows = [header];
  for (const acc of Object.values(accounts)) {
    const packs = acc.packs || [];
    if (!packs.length) {
      rows.push([
        acc.email, acc.username, acc.password, acc.createdAt, acc.signupStatus, acc.failureReason || "",
        acc.totalPacks || 0, acc.lastUpdated || "", "", "", "", "", "", "", "", ""
      ]);
      continue;
    }
    for (const pack of packs) {
      const cards = pack.cards || [];
      if (!cards.length) {
        rows.push([
          acc.email, acc.username, acc.password, acc.createdAt, acc.signupStatus, acc.failureReason || "",
          acc.totalPacks || 0, acc.lastUpdated || "",
          pack.packId || "", pack.openedAt || "", pack.closedAt || "", 0, "", "", "", ""
        ]);
        continue;
      }
      cards.forEach((card, index) => {
        rows.push([
          acc.email, acc.username, acc.password, acc.createdAt, acc.signupStatus, acc.failureReason || "",
          acc.totalPacks || 0, acc.lastUpdated || "",
          pack.packId || "", pack.openedAt || "", pack.closedAt || "", cards.length, index,
          card.name || "", card.rarity || "unknown", card.imgAlt || ""
        ]);
      });
    }
  }
  return rows.map((row) => row.map(esc).join(",")).join("\n");
}
