/** Single source for hosts, storage keys, messages, and timer defaults. */

export const VERSION = "2.10.0";

export const WIKI_HOSTS = ["www.wiki-masters.com", "wiki-masters.com"];
export const WIKI_SIGNUP_URL = "https://www.wiki-masters.com/signup";
export const MAIL_HOST = "10minutemail.com";
export const MAIL_URL = "https://10minutemail.com/";

export const STORAGE_KEYS = {
  settings: "wmph_settings",
  accounts: "wmph_accounts",
  currentEmail: "wmph_current_email"
};

export const MESSAGE = {
  popup: "wmph",
  emailAddress: "wmph_email_address",
  emailCode: "wmph_email_code",
  emailRotate: "wmph_email_rotate",
  signupResult: "wmph_signup_result"
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  pollMs: 120,
  actionDelay: 250,
  viewDelay: 180,
  retryDelay: 500,
  navigationDelay: 150,
  emailPollMs: 500,
  emailFillDelay: 150,
  signupFillDelay: 150,
  signupSubmitDelay: 150,
  signupButtonPollMs: 75,
  signupButtonTimeoutMs: 15000,
  otpSubmitDelay: 150,
  autoStartupGate: true,
  autoSignup: true,
  signupResultTimeoutMs: 20000,
  signupResultPollMs: 250,
  usernameMinLength: 3,
  usernameMaxLength: 24,
  rotationDelayMs: 1200
};

export const SLIDER_KEYS = [
  "pollMs",
  "actionDelay",
  "viewDelay",
  "retryDelay",
  "navigationDelay",
  "emailPollMs",
  "emailFillDelay",
  "signupFillDelay",
  "signupSubmitDelay",
  "signupButtonPollMs",
  "signupButtonTimeoutMs",
  "otpSubmitDelay",
  "signupResultTimeoutMs",
  "signupResultPollMs"
];

export const TOGGLE_KEYS = ["autoStartupGate", "autoSignup"];
