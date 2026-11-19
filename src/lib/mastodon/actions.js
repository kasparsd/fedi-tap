import { readJson } from "../http.js";
import { linkNotFound, Problem, uncertain } from "../problem.js";
import { plainText, shortDate } from "../text.js";
import { randomString } from "../token.js";
import { httpsUrl } from "../url.js";
import { call, rejected } from "./api.js";

const first = (list) => (Array.isArray(list) ? list[0] : undefined);
const lives = (origin, ...urls) => urls.some((url) => httpsUrl(url)?.origin === origin);

/** `user@host` for an account: the server leaves the host off accounts of its own. */
function fullAcct(account, home) {
  const acct = typeof account?.acct === "string" ? account.acct : "";
  return acct.includes("@") ? acct : `${acct}@${home.split("@").pop()}`;
}

/** Opens a post or profile by searching for its address on the account's server. */
export async function resolve(account, url, renew) {
  const requested = new URL(url);
  const query = new URLSearchParams({ q: url, resolve: "true", limit: "1" });
  const response = await call(account, `/api/v2/search?${query}`, {}, renew);
  if (!response.ok) {
    throw new Problem("Couldn’t open this link", "Your server couldn’t load it.", {
      steps:
        "Try again in a moment. If it keeps happening, the post may not be available to your server.",
      detail: `HTTP ${response.status}`,
    });
  }
  const result = await readJson(response);
  const status = first(result?.statuses);
  const profile = status ? null : first(result?.accounts);
  const object = status ?? profile;
  if (!object) throw linkNotFound(url, "The search returned no post or profile.");

  const author = status ? status.account : profile;
  const authorId = httpsUrl(author?.uri)?.href;
  const idUrl = httpsUrl(status ? status.uri : author?.uri);
  if (!idUrl || typeof object.id !== "string" || !authorId || typeof author.id !== "string") {
    throw new Problem("This isn’t a post or profile", "No post or profile came back.", {
      detail: "The response had no HTTPS id or author.",
    });
  }
  // The object must live at the link that was opened, as with ActivityPub.
  if (!lives(requested.origin, idUrl.href, object.url)) {
    throw new Problem(
      "This link doesn’t match",
      "Your server returned something from a different address.",
      { detail: `Opened ${requested.origin}, received ${idUrl.origin}` },
    );
  }
  const acct = fullAcct(author, account.handle);
  return {
    id: idUrl.href,
    author: authorId,
    mention: `@${acct}`,
    isActor: !status,
    handle: `@${acct}`,
    name: plainText(author.display_name, 100) || plainText(author.username, 100) || `@${acct}`,
    excerpt: plainText(status ? status.content || status.spoiler_text : profile.note, 600),
    date: status ? shortDate(status.created_at) : "",
    statusId: status ? object.id : null,
    accountId: author.id,
    visibility: typeof status?.visibility === "string" ? status.visibility : "public",
  };
}

async function post(account, path, options, renew) {
  const response = await call(account, path, { method: "POST", ...options }, renew);
  if (!response.ok) throw await rejected(response);
  return response;
}

/** A reply is plain text. The author's mention opens it, so they are notified. */
function replyText(text, mention) {
  const body = text.replace(/\r\n?/g, "\n").trim();
  return mention ? `${mention} ${body}` : body;
}

const id = encodeURIComponent;

/** Sends like, repost, reply or follow. The result says what undoing it needs. */
export async function act(account, action, target, text, renew) {
  if (action === "follow") {
    if (!target.author || !target.accountId) {
      throw new Error("The author couldn’t be verified, so there is no one to follow.");
    }
    await post(account, `/api/v1/accounts/${id(target.accountId)}/follow`, {}, renew);
    return { undo: true, action, accountId: target.accountId };
  }
  if (target.isActor) throw new Error("Only Follow is available for a profile.");
  const statusId = target.statusId;
  if (action === "like") {
    await post(account, `/api/v1/statuses/${id(statusId)}/favourite`, {}, renew);
    return { undo: true, action, statusId };
  }
  if (action === "repost") {
    await post(account, `/api/v1/statuses/${id(statusId)}/reblog`, {}, renew);
    return { undo: true, action, statusId };
  }
  if (!text?.trim()) throw new Error("Write a reply first.");
  const options = {
    form: {
      status: replyText(text, target.author ? target.mention : ""),
      in_reply_to_id: statusId,
      visibility: target.visibility,
    },
    headers: { "Idempotency-Key": randomString() },
  };
  try {
    await post(account, "/api/v1/statuses", options, renew);
  } catch (failure) {
    // Not every server honors the idempotency key, so a lost answer may hide a reply that was posted.
    if (failure?.detail?.startsWith("Possible CORS block") || /^HTTP 5\d\d/.test(failure?.detail)) {
      throw uncertain(failure.detail);
    }
    throw failure;
  }
  return { undo: false, action };
}

const UNDO = {
  like: (sent) => `/api/v1/statuses/${id(sent.statusId)}/unfavourite`,
  repost: (sent) => `/api/v1/statuses/${id(sent.statusId)}/unreblog`,
  follow: (sent) => `/api/v1/accounts/${id(sent.accountId)}/unfollow`,
};

export async function undo(account, sent, renew) {
  const path = UNDO[sent?.action]?.(sent);
  if (!path) throw new Error("This can’t be undone.");
  await post(account, path, {}, renew);
}
