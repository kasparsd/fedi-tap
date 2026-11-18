import { Problem, sessionEnded } from "./problem.js";
import { renewableCredentials, requestToken } from "./token.js";
import { httpsUrl } from "./url.js";

// One saved record per page address, so copies of the app on one origin keep separate accounts.
export const STORE_KEY = `feditap.accounts:${new URL("./", location.href).pathname}`;

/** "blocked": the browser refuses storage. "damaged": this app's saved data is not valid JSON. */
export class StoreError extends Error {
  constructor(kind) {
    super(
      kind === "damaged"
        ? "Saved data is damaged. Reload the page to reset it."
        : "Browser storage is blocked. Allow website data for this page.",
    );
    this.kind = kind;
  }
}

export function readStore() {
  let raw;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    throw new StoreError("blocked");
  }
  if (raw === null) return { accounts: {}, clients: {}, selectedActorId: null };
  try {
    const store = JSON.parse(raw);
    if (store?.accounts && typeof store.accounts === "object" && !Array.isArray(store.accounts)) {
      // OAuth apps registered on Mastodon-compatible servers, by origin.
      if (!store.clients || typeof store.clients !== "object") store.clients = {};
      return store;
    }
  } catch {
    // Falls through to the same message.
  }
  throw new StoreError("damaged");
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    throw new StoreError("blocked");
  }
}

export function resetStore() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Blocked storage has nothing to reset.
  }
}

/** Runs a callback with the saved accounts while holding a lock shared by every tab. */
export function useStore(callback) {
  return navigator.locks.request(STORE_KEY, () => callback(readStore()));
}

function requireReconnect(store, account) {
  delete account.token;
  delete account.refresh_token;
  delete account.expires;
  account.needsReauth = true;
  saveStore(store);
  throw sessionEnded(account);
}

async function refreshAccount(store, account) {
  // A token without a refresh token (the usual Mastodon kind) can only be replaced by signing in.
  if (!account.refresh_token) requireReconnect(store, account);
  const secret = store.clients?.[httpsUrl(account.actor)?.origin]?.client_secret;
  const { response, result } = await requestToken(account.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: account.client_id,
    ...(secret && { client_secret: secret }),
  });
  if (result?.error === "invalid_grant" || response.status === 401) {
    requireReconnect(store, account);
  }
  if (!response.ok) {
    throw new Problem("Couldn’t renew your sign-in", "Your server didn’t renew the session.", {
      steps: "Try again in a moment.",
      detail: `HTTP ${response.status}`,
    });
  }
  const credentials = renewableCredentials(result, account.refresh_token);
  if (!credentials) requireReconnect(store, account);
  Object.assign(account, credentials);
  saveStore(store);
}

/**
 * Runs a task as one account with a fresh token. `backendFor` says which backend an account uses
 * and whether its saved addresses are still sound. The task gets the account and a `renew`
 * function that refreshes the token again (after a 401).
 */
export function withAccount(actorId, backendFor, task) {
  return useStore(async (store) => {
    const account = store.accounts[actorId];
    if (!account) throw new Error("That account was removed. Choose another.");
    if (account.needsReauth) throw sessionEnded(account);
    const origin = httpsUrl(actorId)?.origin;
    if (!backendFor(account)?.valid(account, origin)) requireReconnect(store, account);
    if (account.expires <= Date.now() / 1000 + 60) {
      await refreshAccount(store, account);
    }
    return task(account, () => refreshAccount(store, account));
  });
}
