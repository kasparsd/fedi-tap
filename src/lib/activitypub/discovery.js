import { WP_SETTING } from "../constants.js";
import { apiOff, mismatch } from "../problem.js";
import { homeEndpoint, httpsUrl } from "../url.js";

/** True when the profile advertises the ActivityPub client-to-server API. */
export function hasClientApi(actor) {
  const { proxyUrl, oauthAuthorizationEndpoint, oauthTokenEndpoint } = actor?.endpoints ?? {};
  return Boolean(proxyUrl || oauthAuthorizationEndpoint || oauthTokenEndpoint);
}

/** The outbox, proxy and followers addresses an account needs, all on its own origin. */
export function actorSettings(actor, origin) {
  const endpoints = {
    outbox: httpsUrl(actor.outbox)?.href,
    proxy: httpsUrl(actor.endpoints?.proxyUrl)?.href,
    followers: httpsUrl(actor.followers)?.href,
  };
  for (const [key, url] of Object.entries(endpoints)) {
    if (!url) {
      const field = key === "proxy" ? "proxyUrl" : key;
      throw apiOff(
        `The profile has no HTTPS ${field}.`,
        `Ask the site administrator to check the ActivityPub API. ${WP_SETTING}`,
      );
    }
  }
  if (!homeEndpoint(endpoints.outbox, origin) || !homeEndpoint(endpoints.proxy, origin)) {
    throw mismatch(
      "The outbox and proxy addresses are on a different site.",
      "The outbox and proxy must use the account’s HTTPS origin.",
    );
  }
  return endpoints;
}
