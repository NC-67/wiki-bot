import { isWikiHost } from "../../shared/url.js";

export function isWiki() {
  return isWikiHost(location.hostname);
}

export function isPullsPage() {
  try {
    return isWiki() && new URL(location.href).pathname.startsWith("/pulls");
  } catch (e) {
    return false;
  }
}

export function isPullStartupPage() {
  try {
    return isWiki() && /^\/pull\/?$/.test(new URL(location.href).pathname);
  } catch (e) {
    return false;
  }
}

export function isSignupPage() {
  try {
    return isWiki() && new URL(location.href).pathname.startsWith("/signup");
  } catch (e) {
    return false;
  }
}
