import { Problem, sessionEnded } from "./problem.js";
import { renewableCredentials, requestToken } from "./token.js";
import { homeEndpoint, httpsUrl } from "./url.js";

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
  if (raw === null) return { accounts: {}, selectedActorId: null };
  try {
    const store = JSON.parse(raw);
    if (store?.accounts && typeof store.accounts === "object" && !Array.isArray(store.accounts))
      return store;
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
  const { response, result } = await requestToken(account.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: account.client_id,
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
 * Runs a task as one account with a fresh token. The task gets the account and a `renew` function
 * that refreshes the token again (after a 401).
 */
export function withAccount(actorId, task) {
  return useStore(async (store) => {
    const account = store.accounts[actorId];
    if (!account) throw new Error("That account was removed. Choose another.");
    if (account.needsReauth) throw sessionEnded(account);
    const origin = httpsUrl(actorId)?.origin;
    if (
      ![account.token_endpoint, account.proxy, account.outbox].every((url) =>
        homeEndpoint(url, origin),
      )
    ) {
      requireReconnect(store, account);
    }
    if (account.expires <= Date.now() / 1000 + 60) {
      await refreshAccount(store, account);
    }
    return task(account, () => refreshAccount(store, account));
  });
}
