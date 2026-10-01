import { MAIL_HOST, WIKI_HOSTS } from "./constants.js";

export function httpsUrl(raw) {
  try {
    const url = new URL(raw || "");
    if (url.protocol !== "https:") return null;
    return url;
  } catch (e) {
    return null;
  }
}

export function isWikiHost(hostname) {
  return WIKI_HOSTS.indexOf(hostname) !== -1;
}

export function isWikiHttps(raw) {
  const url = httpsUrl(raw);
  return !!url && isWikiHost(url.hostname);
}

export function isWikiSignup(raw) {
  const url = httpsUrl(raw);
  return !!url && isWikiHost(url.hostname) && url.pathname.startsWith("/signup");
}

export function isMailHost(raw) {
  const url = httpsUrl(raw);
  return !!url && url.hostname === MAIL_HOST;
}
