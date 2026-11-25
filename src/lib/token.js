import { WP_SETTING } from "./constants.js";
import { getJson, readJson } from "./http.js";
import { apiOff, networkProblem, oauthProblem, Problem } from "./problem.js";
import { httpsUrl } from "./url.js";

/** This page's address (where sign-in returns to), which must be HTTPS. */
export function pageAddress() {
  const page = new URL("./", location.href);
  if (!httpsUrl(page.href) || !crypto.subtle) {
    throw new Problem("Can’t connect here", "Open the published HTTPS page.");
  }
  return page;
}

/** Reads the OAuth client identity (client.json) and checks it matches this page's address. */
export async function clientIdentity() {
  const page = pageAddress();
  const client = new URL("client.json", page);
  const identity = await getJson(client).catch(() => null);
  if (
    identity?.client_id !== client.href ||
    !Array.isArray(identity.redirect_uris) ||
    !identity.redirect_uris.includes(page.href)
  ) {
    throw new Problem("This page can’t connect", "Its OAuth client identity doesn’t match.", {
      steps: "Check client.json and open the published HTTPS address.",
      detail: "client_id or redirect_uris in client.json don’t match the page URL.",
    });
  }
  return { client_id: client.href, redirect_uri: page.href };
}

export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomString() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function requestToken(endpoint, params) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "application/json" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw networkProblem(error);
  }
  if (response.type === "opaqueredirect") {
    throw new Problem(
      "Connection was redirected",
      "The token address redirected the request, which isn’t allowed.",
      {
        steps: "Ask the server administrator to check the advertised token URL.",
        detail: "The token endpoint answered with a redirect.",
      },
    );
  }
  return { response, result: await readJson(response) };
}

export async function exchange(endpoint, params) {
  const { response, result } = await requestToken(endpoint, {
    grant_type: "authorization_code",
    ...params,
  });
  if (result?.error) throw oauthProblem(result.error, result.error_description);
  if (response.status === 404) {
    throw apiOff(
      "The token endpoint answered HTTP 404.",
      `Ask the site administrator to turn it on. ${WP_SETTING} If it is already on, ask them to check the token URL and clear cached profile responses.`,
    );
  }
  if (!response.ok || !result) {
    throw new Problem("Connection failed", "Your server couldn’t finish it.", {
      steps: "Try again in a moment.",
      detail: `HTTP ${response.status}`,
    });
  }
  return result;
}

/** Access token, refresh token and expiry from a token response, or null when it isn't renewable. */
export function renewableCredentials(result, previousRefreshToken) {
  const expiresIn = Number(result?.expires_in);
  const refreshToken = result?.refresh_token ?? previousRefreshToken;
  if (
    typeof result?.access_token !== "string" ||
    !result.access_token ||
    typeof refreshToken !== "string" ||
    !refreshToken ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  )
    return null;

  return {
    token: result.access_token,
    refresh_token: refreshToken,
    expires: Math.floor(Date.now() / 1000 + expiresIn),
  };
}

/**
 * The access token from a token response, with a refresh token and expiry when it came with them.
 * Mastodon-compatible servers usually issue a token that never expires.
 */
export function accessCredentials(result, previousRefreshToken) {
  const renewable = renewableCredentials(result, previousRefreshToken);
  if (renewable) return renewable;
  if (typeof result?.access_token !== "string" || !result.access_token) return null;
  return { token: result.access_token };
}
