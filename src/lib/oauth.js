import { SCOPE, SIGN_IN_KEY } from "./constants.js";
import { actorSettings, discover, fetchActor } from "./discovery.js";
import { oauthProblem, Problem, signInProblem } from "./problem.js";
import { saveStore, useStore } from "./store.js";
import {
  base64url,
  clientIdentity,
  exchange,
  randomString,
  renewableCredentials,
} from "./token.js";
import { homeEndpoint, httpsUrl, parseHandle } from "./url.js";

/**
 * Starts sign-in: finds the server, remembers what the callback needs in this tab and sends the
 * browser to the server's authorization page. `target` is a shared link to reopen afterwards.
 */
export async function authorize(value, { target, profileLinkOnly } = {}) {
  const endpoints = await discover(value, { profileLinkOnly });
  const client = await clientIdentity();
  const state = randomString();
  const code_verifier = randomString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
  const url = new URL(endpoints.authorize);
  const params = {
    ...client,
    response_type: "code",
    scope: SCOPE,
    state,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: "S256",
  };
  for (const [name, param] of Object.entries(params)) url.searchParams.set(name, param);
  sessionStorage.setItem(
    SIGN_IN_KEY,
    JSON.stringify({ state, code_verifier, endpoints, target: httpsUrl(target)?.href }),
  );
  location.assign(url.href);
  return "Opening your server…";
}

/**
 * Finishes sign-in from the callback parameters and saves the account. `onTarget` is told about the
 * shared link that started the sign-in, before anything can fail.
 */
export async function completeSignIn(params, onTarget) {
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
  if (target) onTarget(target);
  if (params.has("error")) throw oauthProblem(params.get("error"), params.get("error_description"));
  const codes = params.getAll("code");
  const { endpoints, code_verifier } = pending;
  const origin = httpsUrl(endpoints?.actor)?.origin;
  const profile = httpsUrl(endpoints?.profile);
  const tokenEndpoint = homeEndpoint(endpoints?.token, origin);
  if (
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

  const client = await clientIdentity();
  const { actor, id } = await fetchActor(profile);
  if (id.href !== endpoints.actor) {
    throw signInProblem("The profile changed during sign-in.");
  }
  const fields = actorSettings(actor, origin);
  const handle =
    parseHandle(actor.webfinger)?.handle ||
    parseHandle(httpsUrl(endpoints.webfinger)?.searchParams.get("resource"))?.handle ||
    parseHandle(`${actor.preferredUsername || ""}@${id.hostname}`)?.handle;
  if (!handle) throw signInProblem("Your profile has no handle. Check it on your server.");

  const result = await exchange(tokenEndpoint, { ...client, code: codes[0], code_verifier });
  const authenticatedActor = result.activitypub_actor_id ?? result.me;
  if (authenticatedActor !== undefined && httpsUrl(authenticatedActor)?.href !== id.href) {
    throw new Problem("Wrong account", "Your server signed you in as a different account.", {
      detail: `Authorized: ${String(authenticatedActor).slice(0, 200)}`,
    });
  }
  const credentials = renewableCredentials(result);
  if (!credentials) {
    throw signInProblem(
      "Your server sent no renewable token.",
      "Update your ActivityPub plugin or server.",
    );
  }
  await useStore((store) => {
    store.accounts[id.href] = {
      handle,
      actor: id.href,
      ...fields,
      ...credentials,
      token_endpoint: tokenEndpoint.href,
      client_id: client.client_id,
    };
    store.selectedActorId = id.href;
    saveStore(store);
  });
}
