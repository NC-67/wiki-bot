import { DEFAULT_SETTINGS } from "../../shared/constants.js";

/** Mutable state of the wiki tab. Feature modules share this object. */
export const session = {
  settings: Object.assign({}, DEFAULT_SETTINGS),
  halted: false,
  busy: false,
  observer: null,
  timer: null,
  navigationTimer: null,
  lastUrl: location.href,
  inPulls: false,
  inPullStartup: false,
  startupListenerInstalled: false,
  startupValidated: false,
  startupWaitingForPack: false,
  startupWatchTimer: null,
  startupGateObserver: null,
  urlWatcher: null,
  navigationHooksInstalled: false,
  startupUserGestureAt: 0,
  signupResultWatcher: null,
  lastSignupEmail: null,
  currentAccountEmail: null,
  currentPackCards: [],
  currentPackStartedAt: null,
  packCounter: 0,
  sawPullGate: false,
  captchaConfirmed: false,
  state: { status: "Repos", packs: 0 }
};

/** Calls registered by feature modules. Used when two modules need each other. */
export const api = {};
