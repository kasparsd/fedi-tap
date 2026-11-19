import { ACTIVITY_TYPE, ACTOR_ACCEPT, ACTOR_TYPES, AS_PROFILE, PUBLIC } from "../constants.js";
import { readJson } from "../http.js";
import {
  corsProblem,
  linkNotFound,
  notFediverse,
  otherKind,
  Problem,
  refused,
  uncertain,
} from "../problem.js";
import { requestSignal } from "../signal.js";
import { plainText, shortDate } from "../text.js";
import { httpsUrl, parseHandle } from "../url.js";

async function activityRequest(
  account,
  endpoint,
  body,
  contentType,
  signal = AbortSignal.timeout(20000),
) {
  const headers = { Authorization: `Bearer ${account.token}`, Accept: ACTOR_ACCEPT };
  if (contentType) headers["Content-Type"] = contentType;
  try {
    return await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers,
      body,
      signal,
    });
  } catch (error) {
    throw corsProblem("Couldn’t reach your server.", error.message);
  }
}

function activityId(value) {
  return httpsUrl(typeof value === "string" ? value : value?.id)?.href;
}

async function proxyRequest(account, id, renew) {
  const body = new URLSearchParams({ id });
  // Opening a link only reads, so the person may cancel it.
  const response = await activityRequest(account, account.proxy, body, undefined, requestSignal());
  if (response.status !== 401) return response;
  await renew();
  return activityRequest(account, account.proxy, body, undefined, requestSignal());
}

/**
 * The @user@host that names an author in a mention: from the actor when it has one, else from the
 * author's address (last path segment and host).
 */
export function mentionOf(handle, authorId) {
  if (handle.startsWith("@")) return handle;
  const url = new URL(authorId);
  const name = url.pathname.split("/").filter(Boolean).pop()?.replace(/^@/, "") || url.hostname;
  return `@${name}@${url.hostname}`;
}

function actorHandle(actor, id) {
  const known =
    parseHandle(actor?.webfinger) ||
    parseHandle(`${actor?.preferredUsername || ""}@${new URL(id).hostname}`);
  return known ? `@${known.handle}` : new URL(id).hostname;
}

/**
 * Returns the author's actor only when it proves who it is: its own id must equal the id the post
 * names. A session that ended is not hidden; any other failure just means "unverified".
 */
async function fetchAuthor(account, id, renew) {
  try {
    const response = await proxyRequest(account, id, renew);
    const actor = response.ok ? await readJson(response) : null;
    const types = Array.isArray(actor?.type) ? actor.type : [actor?.type];
    return activityId(actor) === id && types.some((type) => ACTOR_TYPES.has(type)) ? actor : null;
  } catch (failure) {
    if (failure?.sessionEnded) throw failure;
    return null;
  }
}

const PUBLIC_NAMES = new Set([PUBLIC, "as:Public", "Public"]);

/**
 * Who can see a post, in the words a Mastodon status uses, from its own addressing: `public`,
 * `unlisted`, `private` (followers only) or `direct`. Null when the post names no recipients at
 * all, because then nothing says how far a reply may reach.
 */
export function audienceOf(object, followers) {
  const names = (value) => (Array.isArray(value) ? value : [value]).map(activityId).filter(Boolean);
  const raw = (value) => (Array.isArray(value) ? value : [value]).filter(Boolean);
  const isPublic = (value) => PUBLIC_NAMES.has(typeof value === "string" ? value : value?.id);
  const to = raw(object?.to);
  const cc = raw(object?.cc);
  if (to.length + cc.length === 0) return null;
  if (to.some(isPublic)) return "public";
  if (cc.some(isPublic)) return "unlisted";
  return followers && [...names(to), ...names(cc)].includes(followers) ? "private" : "direct";
}

function linkOrigins(value) {
  const links = Array.isArray(value) ? value : [value];
  return links.map((link) => httpsUrl(typeof link === "string" ? link : link?.href)?.origin);
}

/** Opens a post or profile through the account's proxy and checks it is what was asked for. */
export async function resolveTarget(account, target, renew) {
  const requested = new URL(target);
  const response = await proxyRequest(account, target, renew);
  if (!response.ok) {
    throw response.status === 404 || response.status === 410
      ? linkNotFound(target, `HTTP ${response.status}`)
      : new Problem("Couldn’t open this link", "Your server couldn’t load it.", {
          steps:
            "Try again in a moment. If it keeps happening, the post may not be available to your server.",
          detail: `HTTP ${response.status}`,
        });
  }
  const object = await readJson(response);
  const idUrl = httpsUrl(object?.id);
  const id = idUrl?.href;
  const types = Array.isArray(object?.type) ? object.type : [object?.type];
  const isActor = types.some((type) => ACTOR_TYPES.has(type));
  const authors = Array.isArray(object?.attributedTo)
    ? object.attributedTo
    : [object?.attributedTo];
  const claimed = isActor ? id : authors.map(activityId).find(Boolean);
  const kind = types.find((type) => typeof type === "string" && type);
  // Not an object with an id and a type, as a web page or a plain API answer is: not Fediverse data.
  if (!id || !kind) {
    throw notFediverse(target, "The response had no HTTPS id or ActivityStreams type.");
  }
  if (!claimed) throw otherKind(target, kind);
  // The object must live at the link that was opened. A proxy may resolve an alias address, but then
  // the object has to name that address itself.
  if (idUrl.origin !== requested.origin && !linkOrigins(object.url).includes(requested.origin)) {
    throw new Problem(
      "This link doesn’t match",
      "Your server returned something from a different address.",
      { detail: `Opened ${requested.origin}, received ${idUrl.origin}` },
    );
  }
  const actor = isActor ? object : await fetchAuthor(account, claimed, renew);
  const verified = Boolean(actor);
  const handle = verified ? actorHandle(actor, claimed) : idUrl.hostname;
  return {
    id,
    author: verified ? claimed : null,
    mention: verified ? mentionOf(handle, claimed) : "",
    isActor,
    handle,
    name: verified
      ? plainText(actor.name, 100) || plainText(actor.preferredUsername, 100) || handle
      : "",
    excerpt: plainText(
      isActor ? object.summary : object.content || object.summary || object.name,
      600,
    ),
    date: shortDate(object.published),
    visibility: isActor ? null : audienceOf(object, activityId(actor?.followers)),
  };
}

/** Blank lines separate paragraphs, single newlines become line breaks, and every character is escaped. */
export function replyHtml(text, mention = "") {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (index === 0 && mention ? `${mention} ${paragraph}` : paragraph))
    .map((paragraph) => {
      const escaped = paragraph
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return `<p>${escaped.replaceAll("\n", "<br>")}</p>`;
    })
    .join("");
}

/**
 * A reply reaches the people the post reached, never more: public to the public, unlisted to the
 * followers with the public only on cc, followers-only to the followers, direct to the author alone.
 * Whatever can't be addressed that way is refused rather than widened.
 */
function replyAddressing(visibility, author, account) {
  const mentioned = author ? [author] : [];
  if (visibility === "public") return { to: [PUBLIC], cc: mentioned };
  if (visibility === "unlisted" && account.followers) {
    return { to: [account.followers], cc: [PUBLIC, ...mentioned] };
  }
  if (visibility === "private" && account.followers) {
    return { to: [account.followers], cc: mentioned };
  }
  if (visibility === "direct" && author) return { to: [author], cc: [] };
  throw new Error("FediTap can’t tell who may see this post, so it won’t reply to it.");
}

export function makeActivity(action, target, account, reply) {
  const { id, author, isActor, mention } = target;
  const context = { "@context": AS_PROFILE };
  if (action === "follow") {
    if (!author) throw new Error("The author couldn’t be verified, so there is no one to follow.");
    return { ...context, type: "Follow", object: author, to: [author] };
  }
  if (isActor) throw new Error("Only Follow is available for a profile.");
  const addressing = { to: author ? [author] : [PUBLIC], cc: author ? [PUBLIC] : [] };
  if (action === "like") return { ...context, type: "Like", object: id, ...addressing };
  if (action === "repost") {
    return { ...context, type: "Announce", object: id, to: [PUBLIC], cc: [account.followers] };
  }
  if (!reply) throw new Error("Write a reply first.");
  const replying = replyAddressing(target.visibility, author, account);
  const note = {
    type: "Note",
    inReplyTo: id,
    content: replyHtml(reply, author ? mention : ""),
    ...replying,
  };
  if (author) note.tag = [{ type: "Mention", href: author, name: mention }];
  return { ...context, type: "Create", ...replying, object: note };
}

/**
 * Sends an activity through the outbox, refreshing the token once on a 401. Resolves with the new
 * activity's ID only when the server exposes its Location header to this page (CORS), else null.
 */
async function postActivity(account, activity, renew) {
  const body = JSON.stringify(activity);
  const send = async () => {
    try {
      return await activityRequest(account, account.outbox, body, ACTIVITY_TYPE);
    } catch (failure) {
      // A timeout or dropped connection says nothing about whether the server got the request.
      throw uncertain(failure.detail);
    }
  };
  let response = await send();
  if (response.status === 401) {
    await renew();
    response = await send();
  }
  if (response.status === 401) {
    throw refused();
  }
  if (response.status >= 500 || response.status === 408) throw uncertain(`HTTP ${response.status}`);
  if (!response.ok) {
    throw new Problem(null, "Your server rejected it.", {
      steps: "Try again in a moment.",
      detail: `HTTP ${response.status}`,
    });
  }
  const id = httpsUrl(response.headers.get("Location"));
  return id && id.origin === new URL(account.outbox).origin && !id.hash ? id.href : null;
}

export async function sendActivity(account, action, target, reply, renew) {
  const activity = makeActivity(action, target, account, reply);
  const id = await postActivity(account, activity, renew);
  return { id, to: activity.to, cc: activity.cc, undo: Boolean(id) };
}

export function undoActivity(account, sent, renew) {
  const undo = { "@context": AS_PROFILE, type: "Undo", object: sent.id, to: sent.to };
  if (sent.cc) undo.cc = sent.cc;
  return postActivity(account, undo, renew);
}
