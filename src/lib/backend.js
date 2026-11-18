import { hasClientApi } from "./activitypub/discovery.js";
import { activitypub } from "./activitypub/index.js";
import { probeInstance } from "./mastodon/discovery.js";
import { mastodon } from "./mastodon/index.js";
import { unsupportedServer } from "./problem.js";

// A backend is the part that talks to one kind of home server. Every backend has:
//
//   resolve(account, url, renew)                    -> target
//   act(account, action, target, text, renew)       -> sent   ({ undo, ... })
//   undo(account, sent, renew)                      -> void
//   valid(account, origin)                          -> true when the saved addresses are sound
//   prepare(found)                                  -> { endpoints, client } for the authorization request
//   complete({ endpoints, origin, profile, tokenEndpoint, code, code_verifier }) -> account to save
//
// A target has `id`, `author`, `mention`, `isActor`, `handle`, `name`, `excerpt` and `date`, plus
// fields only its own backend reads.
const BACKENDS = { activitypub, mastodon };

/** The backend an account signed in with, or undefined when the saved account has no known type. */
export const backendFor = (account) => BACKENDS[account?.type];

/** Which kind of server holds this profile: the ActivityPub API first, then a Mastodon API. */
export async function detect({ actor, id }) {
  if (hasClientApi(actor)) return BACKENDS.activitypub;
  if (await probeInstance(id.origin)) return BACKENDS.mastodon;
  throw unsupportedServer("No ActivityPub API or Mastodon API answered.");
}

/**
 * What identifies a finished action: account, target and kind. Following goes to the author, so it
 * is keyed by the author, not the post.
 */
export function activityKey(actorId, object, action) {
  return `${actorId} ${action === "follow" ? object.author : object.id} ${action}`;
}
