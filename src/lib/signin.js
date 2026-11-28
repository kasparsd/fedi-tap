import { freeColour, selectAccount } from "./accounts.js";
import { backendFor, detect } from "./backend.js";
import { SIGN_IN_KEY } from "./constants.js";
import { findActor, findIntents } from "./discovery.js";
import { oauthProblem, signInProblem } from "./problem.js";
import { stamp } from "./refresh.js";
import { saveStore, useStore } from "./store.js";
import { base64url, randomString } from "./token.js";
import { homeEndpoint, httpsUrl } from "./url.js";

/**
 * Starts sign-in: finds the server and its kind, remembers what the callback needs in this tab and
 * sends the browser to the server's authorization page. `target` is a shared link to reopen afterwards.
 */
export async function authorize(value, { target, profileLinkOnly } = {}) {
  const found = await findActor(value, { profileLinkOnly });
  const backend = await detect(found);
  const { endpoints, client } = await backend.prepare(found);
  const state = randomString();
  const code_verifier = randomString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
  const url = new URL(endpoints.authorize);
  const params = {
    ...client,
    response_type: "code",
    state,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: "S256",
  };
  for (const [name, param] of Object.entries(params)) url.searchParams.set(name, param);
  sessionStorage.setItem(
    SIGN_IN_KEY,
    JSON.stringify({
      type: backend.type,
      state,
      code_verifier,
      endpoints,
      target: httpsUrl(target)?.href,
      account: value,
    }),
  );
  location.assign(url.href);
  return "Opening your server…";
}

/**
 * Finishes sign-in from the callback parameters and saves the account. `onStarted` is told what the
 * sign-in started with (the shared `target` link and the `account` that was typed), before anything can
 * fail, so a failed return can show both again.
 */
export async function completeSignIn(params, onStarted) {
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(SIGN_IN_KEY));
  } catch {
    // A damaged record is treated like a missing one.
  }
  sessionStorage.removeItem(SIGN_IN_KEY);
  const states = params.getAll("state");
  if (!pending?.state || states.length !== 1 || states[0] !== pending.state) {
    throw signInProblem("This isn’t the sign-in you started in this tab.");
  }
  const target = httpsUrl(pending.target);
  onStarted({ target, account: typeof pending.account === "string" ? pending.account : "" });
  if (params.has("error")) throw oauthProblem(params.get("error"), params.get("error_description"));
  const codes = params.getAll("code");
  const { endpoints, code_verifier } = pending;
  const backend = backendFor(pending);
  const origin = httpsUrl(endpoints?.actor)?.origin;
  const profile = httpsUrl(endpoints?.profile);
  const tokenEndpoint = homeEndpoint(endpoints?.token, origin);
  if (
    !backend ||
    codes.length !== 1 ||
    !codes[0] ||
    !profile ||
    profile.origin !== origin ||
    !tokenEndpoint ||
    !homeEndpoint(endpoints.authorize, origin) ||
    !code_verifier
  ) {
    throw signInProblem("Your server returned an incomplete sign-in.");
  }
  const issuers = params.getAll("iss");
  if (
    (endpoints.requireIssuer || issuers.length) &&
    (issuers.length !== 1 || issuers[0] !== (endpoints.issuer ?? origin))
  ) {
    throw signInProblem(
      "The response didn’t come from your server’s OAuth issuer.",
      `iss: ${issuers.join(", ").slice(0, 200)}`,
    );
  }

  const account = await backend.complete({
    endpoints,
    origin,
    profile,
    tokenEndpoint,
    code: codes[0],
    code_verifier,
  });
  const intents = await findIntents(account.handle, origin);
  if (intents) {
    if (Object.keys(intents).length) account.intents = intents;
    account.refreshed = stamp();
  }
  await useStore((store) => {
    // Connecting an account again keeps its colour; its photo is whatever the server says now.
    const colour = store.accounts[account.actor]?.colour ?? freeColour(store.accounts);
    store.accounts[account.actor] = { ...account, colour };
    selectAccount(store, account.actor);
    saveStore(store);
  });
}
