import { SHORTCUT_KEY } from "./constants.js";
import { readStore } from "./store.js";

export const standalone =
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// The Shortcut and the Home Screen hint are for iPhone and iPad (iPadOS reports itself as a Mac with touch).
export const ios =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function readShortcut() {
  try {
    return localStorage.getItem(SHORTCUT_KEY);
  } catch {
    return null;
  }
}

export function writeShortcut(value) {
  try {
    localStorage.setItem(SHORTCUT_KEY, value);
  } catch {
    // The card just comes back next time.
  }
}

/** What the unsupported screen shows (a heading, a one-line cause and optionally a reset button), or null. */
export function checkSupport() {
  if (!navigator.locks || !AbortSignal.timeout || !globalThis.crypto?.subtle) {
    return {
      heading: "Browser not supported",
      title: "This browser isn’t supported.",
      message: "Open the published https page in a current browser.",
    };
  }
  const blocked = {
    heading: "Storage is blocked",
    title: "This browser can’t save your sign-in.",
    message: "Allow website data for this page.",
  };
  try {
    localStorage.setItem("feditap.probe", "1");
    localStorage.removeItem("feditap.probe");
  } catch {
    return blocked;
  }
  try {
    readStore();
  } catch (error) {
    return error.kind === "damaged"
      ? {
          heading: "Saved data is damaged",
          title: "FediTap can’t read its saved data.",
          message: "Reset it, then sign in again.",
          reset: true,
        }
      : blocked;
  }
  return null;
}
