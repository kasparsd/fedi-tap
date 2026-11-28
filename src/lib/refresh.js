// What a saved account shows that its server can change: the photo and the links to the server's own
// pages. Both are read at sign-in and refreshed quietly afterwards. Where tokens and posts go
// changes only by signing in again.

import { findIntents } from "./discovery.js";
import { readStore, saveStore, useStore } from "./store.js";
import { httpsUrl } from "./url.js";

/** Raise this when a release starts saving something new here, so every account fills it in. */
export const REFRESH_VERSION = 1;
const MAX_AGE = 24 * 60 * 60 * 1000;
const TIMEOUT = 20000;

/** What marks an account as up to date. */
export const stamp = () => ({ at: Date.now(), version: REFRESH_VERSION });

/** Whether an account is due: never refreshed, by an older version, or more than a day ago. */
export function isStale(account, now = Date.now()) {
  const { at, version } = account.refreshed ?? {};
  const age = now - at;
  // A time that is missing, or ahead of the clock, says nothing.
  return version !== REFRESH_VERSION || !(age >= 0 && age < MAX_AGE);
}

/**
 * Reads one account's photo and links again and saves what its server answered. A failed read keeps
 * the saved value and leaves the account stale. It never renews or drops a token. True when what the
 * page shows changed.
 */
export async function refreshProfile(actorId, backendFor) {
  const before = readStore().accounts[actorId];
  const origin = httpsUrl(actorId)?.origin;
  if (!before || !backendFor(before)?.valid(before, origin)) return false;
  const started = Date.now();
  const signal = AbortSignal.timeout(TIMEOUT);
  // Outside the store's lock: a slow server must not hold up opening links or switching.
  const [photo, intents] = await Promise.allSettled([
    backendFor(before).photo(before, signal),
    findIntents(before.handle, origin, signal),
  ]);
  const gotPhoto = photo.status === "fulfilled";
  const gotIntents = intents.status === "fulfilled" && intents.value !== null;
  if (!gotPhoto && !gotIntents) return false;

  return useStore((store) => {
    const account = store.accounts[actorId];
    // Removed meanwhile, or signed in again, which read everything afresh.
    if (!account || account.refreshed?.at >= started) return false;
    const shown = () => JSON.stringify([account.avatar, account.intents]);
    const was = shown();
    if (gotPhoto) {
      if (photo.value) account.avatar = photo.value;
      else delete account.avatar;
    }
    if (gotIntents) {
      if (Object.keys(intents.value).length) account.intents = intents.value;
      else delete account.intents;
    }
    if (gotPhoto && gotIntents) account.refreshed = stamp();
    saveStore(store);
    return shown() !== was;
  });
}
