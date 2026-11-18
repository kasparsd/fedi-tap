import { homeEndpoint } from "../url.js";
import { resolveTarget, sendActivity, undoActivity } from "./activity.js";
import { complete, prepare } from "./signin.js";

/** The ActivityPub client-to-server backend (WordPress and servers with the ActivityPub API). */
export const activitypub = {
  type: "activitypub",
  resolve: resolveTarget,
  act: sendActivity,
  undo: undoActivity,
  /** True when the saved account's addresses are all on its own origin. */
  valid: (account, origin) =>
    [account.token_endpoint, account.proxy, account.outbox].every((url) =>
      homeEndpoint(url, origin),
    ),
  prepare,
  complete,
};
