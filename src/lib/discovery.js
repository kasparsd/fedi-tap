import { ACTOR_ACCEPT, AS_PROFILE, CORS_HELP } from "./constants.js";
import { getJson } from "./http.js";
import { apiOff, mismatch, Problem } from "./problem.js";
import { homeEndpoint, httpsUrl, parseHandle } from "./url.js";

export function isActorLink(link) {
  if (link?.rel !== "self") return false;
  const type = link.type || "";
  return (
    /^application\/activity\+json(?:\s*;|$)/i.test(type) ||
    (/^application\/ld\+json\s*;/i.test(type) &&
      /;\s*profile\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(type)?.slice(1).includes(AS_PROFILE))
  );
}

async function webfingerActor(url) {
  const record = await getJson(url, "application/jrd+json, application/json");
  const links = Array.isArray(record?.links) ? record.links : [];
  return links
    .filter(isActorLink)
    .map((link) => httpsUrl(link.href))
    .find(Boolean);
}

export async function fetchActor(url) {
  let detail = "The profile ID is on a different server than the address.";
  try {
    const actor = await getJson(url, ACTOR_ACCEPT);
    const id = httpsUrl(actor?.id);
    if (id?.origin === url.origin) return { actor, id };
  } catch (error) {
    // The browser reports CORS and other network failures the same way.
    detail = error.message;
  }
  throw new Problem(
    "Couldn’t read your profile",
    "Your server returned no matching profile, or blocked this page.",
    {
      steps:
        "Enter the canonical HTTPS profile URL, and allow requests from this page on the server.",
      link: CORS_HELP,
      detail,
    },
  );
}

/**
 * Reads the server's OAuth metadata and returns the authorization and token addresses, all on the
 * account's own origin. `fallback` names addresses to use when the metadata has none. The raw
 * metadata comes back too, for the backend that wants more from it.
 */
export async function oauthEndpoints(origin, fallback = {}) {
  const metadata = await getJson(new URL("/.well-known/oauth-authorization-server", origin)).catch(
    () => null,
  );
  const advertisedIssuer = metadata?.issuer;
  const issuerUrl = homeEndpoint(advertisedIssuer, origin);
  if (advertisedIssuer !== undefined && (!issuerUrl || issuerUrl.search)) {
    throw mismatch(
      "The OAuth issuer isn’t your account’s address.",
      `Issuer: ${String(advertisedIssuer).slice(0, 200)}`,
    );
  }
  const authorizeUrl = metadata?.authorization_endpoint ?? fallback.authorize;
  const tokenUrl = metadata?.token_endpoint ?? fallback.token;
  if (!authorizeUrl || !tokenUrl) throw apiOff("No authorization or token endpoint is advertised.");

  const authorizeEndpoint = homeEndpoint(authorizeUrl, origin);
  const token = homeEndpoint(tokenUrl, origin);
  if (!authorizeEndpoint || !token) {
    throw mismatch(
      "The sign-in addresses are on a different site.",
      "Authorization and token endpoints must use the account’s HTTPS origin.",
    );
  }
  return {
    endpoints: {
      authorize: authorizeEndpoint.href,
      token: token.href,
      issuer: advertisedIssuer ?? origin,
      requireIssuer: metadata?.authorization_response_iss_parameter_supported === true,
    },
    metadata,
  };
}

/**
 * Finds the profile for a handle or profile link. With `profileLinkOnly` a handle is refused. A
 * Problem with `offerProfileLink` means WebFinger found nothing.
 */
export async function findActor(value, { profileLinkOnly = false } = {}) {
  let profile = httpsUrl(value);
  let webfinger;
  if (!profile) {
    const account = parseHandle(value);
    if (!account || profileLinkOnly) {
      throw new Problem(
        "Check the account",
        profileLinkOnly
          ? "Enter a link that starts with https://."
          : "Use @you@example.com or a profile link.",
        { actions: [] },
      );
    }
    webfinger = new URL("/.well-known/webfinger", account.origin);
    webfinger.searchParams.set("resource", `acct:${account.handle}`);
    profile = await webfingerActor(webfinger).catch(() => null);
    if (!profile) {
      throw new Problem(
        `Can’t find ${account.handle}`,
        "Check the spelling, or use a profile link.",
        { offerProfileLink: true },
      );
    }
  }
  const { actor, id } = await fetchActor(profile);
  return { actor, id, profile, webfinger };
}
