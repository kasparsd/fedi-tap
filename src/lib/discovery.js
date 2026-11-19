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

/**
 * Reads the actor document. Servers that require signed requests refuse it with 401 or 403; when
 * `allowRefused` is set that is not fatal: the address is still the actor's ID, but its document
 * stays unread (`actor` is null) and only a backend that doesn't need it can go on.
 */
export async function fetchActor(url, { allowRefused = false } = {}) {
  let detail = "The profile ID is on a different server than the address.";
  try {
    const actor = await getJson(url, ACTOR_ACCEPT);
    const id = httpsUrl(actor?.id);
    if (id?.origin === url.origin) return { actor, id };
  } catch (error) {
    // The browser reports CORS and other network failures the same way.
    detail = error.message;
    if (allowRefused && /^HTTP (401|403)$/.test(detail)) return { actor: null, id: url };
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
      "The addresses for connecting are on a different site.",
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
  // An address WebFinger vouched for may be a server that refuses unsigned reads of it.
  const { actor, id } = await fetchActor(profile, { allowRefused: Boolean(webfinger) });
  return { actor, id, profile, webfinger };
}

// What a person's own server can open for them, by FEP-3b86 link relation. Each intent names the
// placeholder its template fills with the post or profile address. The legacy OStatus subscribe
// link (`{uri}`) is the older form of "Object": it opens whatever address it is given.
const FEP = "https://w3id.org/fep/3b86/";
const OSTATUS_SUBSCRIBE = "http://ostatus.org/schema/1.0/subscribe";
export const INTENTS = {
  reply: { rels: [`${FEP}Create`], placeholder: "{inReplyTo}" },
  like: { rels: [`${FEP}Like`], placeholder: "{object}" },
  repost: { rels: [`${FEP}Announce`], placeholder: "{object}" },
  follow: { rels: [`${FEP}Follow`], placeholder: "{object}" },
  open: { rels: [`${FEP}Object`, OSTATUS_SUBSCRIBE], placeholder: "{object}" },
};
// The subscribe link names its placeholder differently.
const SUBSCRIBE_PLACEHOLDER = "{uri}";

function placeholderFor(rel, intent) {
  return rel === OSTATUS_SUBSCRIBE ? SUBSCRIBE_PLACEHOLDER : INTENTS[intent].placeholder;
}

/**
 * Fills a template with an address, or returns null when it isn't a sound link on `origin`: the
 * placeholder once and no other placeholder.
 */
function fillTemplate(template, placeholder, origin, address) {
  if (typeof template !== "string") return null;
  const parts = template.split(placeholder);
  if (parts.length !== 2 || parts.some((part) => /[{}]/.test(part))) return null;
  return homeEndpoint(parts.join(encodeURIComponent(address)), origin)?.href ?? null;
}

/**
 * The link templates the person's own server publishes for opening a reply, like, repost, follow or
 * the post itself on that server, by intent. Best effort: the account works without them, so every
 * failure means none.
 */
export async function findIntents(handle, origin) {
  const url = new URL("/.well-known/webfinger", origin);
  url.searchParams.set("resource", `acct:${handle}`);
  const record = await getJson(url, "application/jrd+json, application/json").catch(() => null);
  const links = Array.isArray(record?.links) ? record.links : [];
  const found = {};
  for (const [intent, { rels }] of Object.entries(INTENTS)) {
    for (const rel of rels) {
      const link = links.find(
        (candidate) =>
          candidate?.rel === rel &&
          fillTemplate(
            candidate.template,
            placeholderFor(rel, intent),
            origin,
            "https://example.com/",
          ),
      );
      if (link) {
        found[intent] = { rel, template: link.template };
        break;
      }
    }
  }
  return found;
}

/** The address that opens `intent` for `address` on the account's own server, or null. */
export function intentLink(account, intent, address) {
  const origin = httpsUrl(account?.actor)?.origin;
  const saved = account?.intents?.[intent];
  if (!origin || !httpsUrl(address) || !saved) return null;
  return fillTemplate(saved.template, placeholderFor(saved.rel, intent), origin, address);
}

const SERVER_ACTIONS = ["like", "repost", "reply", "follow", "open"];

/**
 * The actions the person's own server can open for the loaded post or profile, as `{ intent, href }`
 * in button order. A post offers all five (Follow goes to its verified author); a profile only
 * Follow and Open.
 */
export function serverActions(account, target) {
  if (!account || !target) return [];
  const address = (intent) =>
    target.isActor
      ? { follow: target.id, open: target.id }[intent]
      : intent === "follow"
        ? target.author
        : target.id;
  return SERVER_ACTIONS.flatMap((intent) => {
    const href = intentLink(account, intent, address(intent));
    return href ? [{ intent, href }] : [];
  });
}
