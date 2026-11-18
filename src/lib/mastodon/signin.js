import { oauthEndpoints } from "../discovery.js";
import { Problem, signInProblem } from "../problem.js";
import { readStore, saveStore, useStore } from "../store.js";
import { accessCredentials, exchange, pageAddress, requestToken } from "../token.js";
import { homeEndpoint, httpsUrl, parseHandle } from "../url.js";
import { call } from "./api.js";

export const GRANULAR_SCOPE =
  "read:accounts read:search write:favourites write:statuses write:follows";
export const BROAD_SCOPE = "read write follow";

/** Granular scopes when the server lists them all (or lists nothing), else the broad ones. */
export function chooseScope(metadata) {
  const supported = metadata?.scopes_supported;
  if (!Array.isArray(supported)) return GRANULAR_SCOPE;
  return GRANULAR_SCOPE.split(" ").every((scope) => supported.includes(scope))
    ? GRANULAR_SCOPE
    : BROAD_SCOPE;
}

/** True when the granted scopes include `wanted`, directly or through its parent (`read`, `write`). */
export function covers(granted, wanted) {
  const has = (scope) => granted.includes(scope);
  return (
    has(wanted) ||
    has(wanted.split(":")[0]) ||
    (wanted === "write:follows" && has("follow")) ||
    (wanted === "follow" && has("follow"))
  );
}

async function register(endpoint, page, scope) {
  const attempt = (scopes) =>
    requestToken(endpoint, {
      client_name: "FediTap",
      redirect_uris: page,
      scopes,
      website: page,
    });
  let used = scope;
  let { response, result } = await attempt(used);
  // An older or stricter server may not know the granular scopes.
  if (!response.ok && used === GRANULAR_SCOPE && response.status >= 400 && response.status < 500) {
    used = BROAD_SCOPE;
    ({ response, result } = await attempt(used));
  }
  if (
    !response.ok ||
    typeof result?.client_id !== "string" ||
    typeof result?.client_secret !== "string"
  ) {
    throw new Problem("Couldn’t register with your server", "Your server didn’t accept FediTap.", {
      steps: "Try again in a moment. If it keeps happening, ask the server administrator.",
      detail: `HTTP ${response.status}`,
    });
  }
  return {
    client_id: result.client_id,
    client_secret: result.client_secret,
    redirect_uri: page,
    scope: used,
  };
}

/** The app registered on this server for this page: reused when it fits, else registered once. */
function appFor(origin, registration, page, scope) {
  return useStore(async (store) => {
    const known = store.clients[origin];
    if (known?.redirect_uri === page && known.scope === scope) return known;
    const client = await register(registration, page, scope);
    store.clients[origin] = client;
    saveStore(store);
    return client;
  });
}

/** What the authorization request needs from this server: its addresses and a registered app. */
export async function prepare({ id, profile, webfinger }) {
  const origin = id.origin;
  const { endpoints, metadata } = await oauthEndpoints(origin, {
    authorize: `${origin}/oauth/authorize`,
    token: `${origin}/oauth/token`,
  });
  const registration =
    homeEndpoint(metadata?.registration_endpoint, origin)?.href ?? `${origin}/api/v1/apps`;
  const page = pageAddress().href;
  const client = await appFor(origin, registration, page, chooseScope(metadata));
  return {
    endpoints: {
      ...endpoints,
      profile: profile.href,
      actor: id.href,
      webfinger: webfinger?.href,
      client_id: client.client_id,
      scope: client.scope,
    },
    client: { client_id: client.client_id, redirect_uri: page, scope: client.scope },
  };
}

/** Exchanges the code, checks who signed in and returns the account to save. */
export async function complete({ endpoints, origin, tokenEndpoint, code, code_verifier }) {
  // The secret stays in the saved data, never in the tab's sign-in record.
  const client = readStore().clients[origin];
  if (!client?.client_secret || client.client_id !== endpoints.client_id) {
    throw signInProblem("FediTap isn’t registered on your server.");
  }
  const result = await exchange(tokenEndpoint, {
    client_id: client.client_id,
    client_secret: client.client_secret,
    redirect_uri: client.redirect_uri,
    code,
    code_verifier,
  });
  const wanted = String(endpoints.scope ?? "")
    .split(" ")
    .filter(Boolean);
  if (typeof result.scope === "string") {
    const granted = result.scope.split(" ");
    const missing = wanted.filter((scope) => !covers(granted, scope));
    if (missing.length) {
      throw new Problem(
        "Sign-in needs more access",
        "Your server allowed less than FediTap asked.",
        {
          steps: "Try again and approve every permission.",
          detail: `Missing: ${missing.join(" ")}`.slice(0, 300),
        },
      );
    }
  }
  const credentials = accessCredentials(result);
  if (!credentials) throw signInProblem("Your server sent no access token.");

  const response = await call(
    { api: origin, token: credentials.token },
    "/api/v1/accounts/verify_credentials",
  );
  const profile = response.ok ? await response.json().catch(() => null) : null;
  const uri = httpsUrl(profile?.uri ?? profile?.url)?.href;
  if (!uri) throw signInProblem("Your server didn’t say who signed in.");
  if (uri !== endpoints.actor) {
    throw new Problem("Wrong account", "Your server signed you in as a different account.", {
      detail: `Authorized: ${uri.slice(0, 200)}`,
    });
  }
  const id = new URL(endpoints.actor);
  const handle =
    parseHandle(httpsUrl(endpoints.webfinger)?.searchParams.get("resource"))?.handle ||
    parseHandle(`${profile.username || ""}@${id.hostname}`)?.handle;
  if (!handle) throw signInProblem("Your profile has no handle. Check it on your server.");
  return {
    type: "mastodon",
    handle,
    actor: id.href,
    api: origin,
    ...credentials,
    token_endpoint: tokenEndpoint.href,
    client_id: client.client_id,
  };
}
