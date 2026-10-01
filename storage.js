"use strict";
const WMPH_ACCOUNTS_KEY = "wmph_accounts";
const WMPH_CURRENT_KEY = "wmph_current_email";
async function wmphGetAccounts() {
  const data = await chrome.storage.local.get(WMPH_ACCOUNTS_KEY);
  return data[WMPH_ACCOUNTS_KEY] || {};
}
async function wmphSetAccounts(accounts) {
  await chrome.storage.local.set({[WMPH_ACCOUNTS_KEY]: accounts});
}
async function wmphUpsertAccount(email, patch) {
  if (!email) return null;
  const accounts = await wmphGetAccounts();
  const existing = accounts[email] || {
    email, username: email.split("@")[0] || "", password: email,
    createdAt: new Date().toISOString(), signupStatus: "pending",
    packs: [], totalPacks: 0
  };
  const merged = Object.assign({}, existing, patch, {lastUpdated: new Date().toISOString()});
  accounts[email] = merged;
  await wmphSetAccounts(accounts);
  return merged;
}
async function wmphGetAccount(email) {
  const accounts = await wmphGetAccounts();
  return accounts[email] || null;
}
async function wmphSetCurrentEmail(email) {
  await chrome.storage.local.set({[WMPH_CURRENT_KEY]: email || ""});
}
async function wmphGetCurrentEmail() {
  const data = await chrome.storage.local.get(WMPH_CURRENT_KEY);
  return data[WMPH_CURRENT_KEY] || null;
}
async function wmphAppendPack(email, pack) {
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
async function wmphDeleteAccount(email) {
  const accounts = await wmphGetAccounts();
  delete accounts[email];
  await wmphSetAccounts(accounts);
}
async function wmphClearAll() {
  await chrome.storage.local.remove([WMPH_ACCOUNTS_KEY, WMPH_CURRENT_KEY]);
}
async function wmphExportJSON() {
  const accounts = await wmphGetAccounts();
  const cleaned = {};
  for (const [email, acc] of Object.entries(accounts)) {
    cleaned[email] = {
      email: acc.email, username: acc.username, password: acc.password,
      createdAt: acc.createdAt, signupStatus: acc.signupStatus,
      failureReason: acc.failureReason || null,
      totalPacks: acc.totalPacks || 0,
      lastUpdated: acc.lastUpdated || null,
      packs: (acc.packs || []).map(p => ({
        packId: p.packId || null, openedAt: p.openedAt || null, closedAt: p.closedAt || null,
        cardCount: (p.cards || []).length,
        cards: (p.cards || []).map(c => ({
          name: c.name || "", rarity: c.rarity || "unknown",
          imgAlt: c.imgAlt || ""
        }))
      }))
    };
  }
  return JSON.stringify({
    exportedAt: new Date().toISOString(), version: "2.9.2",
    accountCount: Object.keys(cleaned).length, accounts: cleaned
  }, null, 2);
}
async function wmphExportCSV() {
  const accounts = await wmphGetAccounts();
  const esc = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const header = [
    "email","username","password","createdAt","signupStatus","failureReason",
    "totalPacks","lastUpdated",
    "packId","packOpenedAt","packClosedAt","packCardCount",
    "cardIndex","cardName","cardRarity","cardImgAlt"
  ];
  const rows = [header];
  for (const acc of Object.values(accounts)) {
    const packs = acc.packs || [];
    if (!packs.length) {
      rows.push([acc.email,acc.username,acc.password,acc.createdAt,acc.signupStatus,acc.failureReason||"",
        acc.totalPacks||0,acc.lastUpdated||"","","","","","","","",""]);
      continue;
    }
    for (const pack of packs) {
      const cards = pack.cards || [];
      if (!cards.length) {
        rows.push([acc.email,acc.username,acc.password,acc.createdAt,acc.signupStatus,acc.failureReason||"",
          acc.totalPacks||0,acc.lastUpdated||"",
          pack.packId||"",pack.openedAt||"",pack.closedAt||"",0,"","","",""]);
        continue;
      }
      cards.forEach((card, i) => {
        rows.push([acc.email,acc.username,acc.password,acc.createdAt,acc.signupStatus,acc.failureReason||"",
          acc.totalPacks||0,acc.lastUpdated||"",
          pack.packId||"",pack.openedAt||"",pack.closedAt||"",cards.length,i,
          card.name||"",card.rarity||"unknown",card.imgAlt||""]);
      });
    }
  }
  return rows.map(r => r.map(esc).join(",")).join("\n");
}
