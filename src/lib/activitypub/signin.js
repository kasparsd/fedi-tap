import { photoUrl } from "../accounts.js";
import { SCOPE } from "../constants.js";
import { fetchActor, oauthEndpoints } from "../discovery.js";
import { Problem, signInProblem } from "../problem.js";
import { clientIdentity, exchange, renewableCredentials } from "../token.js";
import { httpsUrl, parseHandle } from "../url.js";
import { actorSettings } from "./discovery.js";

/** What the authorization request needs from this server, found from the profile. */
export async function prepare({ actor, id, profile, webfinger }) {
  actorSettings(actor, id.origin);
  const { endpoints } = await oauthEndpoints(id.origin, {
    named: {
      authorize: actor.endpoints?.oauthAuthorizationEndpoint,
      token: actor.endpoints?.oauthTokenEndpoint,
    },
  });
  const client = await clientIdentity();
  return {
    endpoints: { ...endpoints, profile: profile.href, actor: id.href, webfinger: webfinger?.href },
    client: { ...client, scope: SCOPE },
  };
}

/** Exchanges the code and returns the account to save. */
export async function complete({ endpoints, origin, profile, tokenEndpoint, code, code_verifier }) {
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

  const result = await exchange(tokenEndpoint, { ...client, code, code_verifier });
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
  return {
    type: "activitypub",
    handle,
    actor: id.href,
    avatar: photoUrl(actor.icon),
    ...fields,
    ...credentials,
    token_endpoint: tokenEndpoint.href,
    client_id: client.client_id,
  };
}
