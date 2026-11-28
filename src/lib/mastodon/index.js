import { homeEndpoint } from "../url.js";
import { act, resolve, undo } from "./actions.js";
import { complete, photo, prepare } from "./signin.js";

/** The Mastodon API backend (Mastodon, GoToSocial, Pleroma, Akkoma and similar). */
export const mastodon = {
  type: "mastodon",
  resolve,
  act,
  undo,
  /** True when the saved account's addresses are all on its own origin. */
  valid: (account, origin) =>
    account.api === origin && Boolean(homeEndpoint(account.token_endpoint, origin)),
  prepare,
  complete,
  photo,
};
