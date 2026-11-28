import { CORS_HELP, MAX_RESPONSE, WORDPRESS_HELP, WP_SETTING } from "./constants.js";

/**
 * A failure the person can act on: a title, one sentence of cause, optional steps, link and
 * technical detail (HTTP codes, raw messages) and buttons. Shown by the Problem component.
 */
const FEDIVERSE_LINKS =
  "FediTap opens posts and profiles from Mastodon, WordPress and other ActivityPub servers. Check the link, or open it in your browser to see what it is.";

export class Problem extends Error {
  constructor(title, cause, extra = {}) {
    super(cause);
    this.title = title;
    Object.assign(this, extra);
  }
}

/** Turns any failure into a Problem, filling in a default title and buttons. */
export function problemOf(failure, title, actions) {
  const problem =
    failure instanceof Problem ? failure : new Problem(null, failure?.message || "Try again.");
  problem.title ??= title ?? "Something went wrong";
  problem.actions ??= typeof actions === "function" ? actions(problem) : actions;
  return problem;
}

export function apiOff(detail, steps = `Ask the site administrator to turn it on. ${WP_SETTING}`) {
  return new Problem("Server not supported", "It has no ActivityPub API.", {
    steps,
    link: WORDPRESS_HELP,
    detail,
  });
}

/** Neither the ActivityPub API nor a Mastodon-compatible API answered on the account's server. */
export function unsupportedServer(detail) {
  return new Problem(
    "Server not supported",
    "It has neither the ActivityPub API nor a Mastodon-compatible API.",
    {
      steps: `Use a Mastodon-compatible server (Mastodon, GoToSocial, Pleroma, Akkoma) or one with the ActivityPub API. ${WP_SETTING}`,
      link: WORDPRESS_HELP,
      detail,
    },
  );
}

/** The link the person typed, offered back so they can see in their own browser what it is. */
const viewLink = (target) => ({ href: target, text: "Open the link in your browser" });

/** The server can't find what the link points at, which is also what a non-Fediverse link looks like. */
export function linkNotFound(target, detail) {
  return new Problem(
    "Couldn’t open this link",
    "Your server can’t find it. It may be private, deleted or blocked, or the link may not be a Fediverse post or profile.",
    { steps: FEDIVERSE_LINKS, link: viewLink(target), detail },
  );
}

/** The link answered, but not with Fediverse (ActivityPub) data: most likely an ordinary web page. */
export function notFediverse(target, detail) {
  return new Problem(
    "Not a Fediverse post or profile",
    "The link answered, but not with ActivityPub data. It may be an ordinary web page.",
    { steps: FEDIVERSE_LINKS, link: viewLink(target), detail },
  );
}

/** It is Fediverse data, but of a kind FediTap can't act on (a collection, an activity ...). */
export function otherKind(target, kind) {
  return new Problem(
    "This isn’t a post or profile",
    `It is a Fediverse ${kind ? `“${kind}”` : "item"}, not a post or a profile.`,
    { steps: FEDIVERSE_LINKS, link: viewLink(target), detail: kind ? `Type: ${kind}` : undefined },
  );
}

/**
 * A request that never got an answer. A timeout is the server being slow, not a CORS block or being
 * offline, and for a request that changes something (`sent`) it may still have gone through, so the
 * person is told to check before sending it again.
 */
export function networkProblem(error, { sent = false } = {}) {
  if (error?.name === "TimeoutError") {
    return new Problem(
      "Your server took too long.",
      sent
        ? "It may still have gone through. Check before you try again."
        : "It didn’t answer in time. Try again in a moment.",
      { detail: "The request timed out." },
    );
  }
  return corsProblem("Couldn’t reach your server.", error?.message);
}

export function corsProblem(title, detail) {
  const cause =
    navigator.onLine === false
      ? "You appear to be offline."
      : "It may block this page, or you’re offline.";
  return new Problem(title, cause, {
    steps:
      "Ask the server administrator to allow this page. If you’re offline, reconnect and try again.",
    link: CORS_HELP,
    detail: `Possible CORS block. ${detail}`,
  });
}

export function mismatch(cause, detail) {
  return new Problem("Connection settings don’t match", cause, {
    steps: "Ask the server administrator to check the site address and OAuth settings.",
    detail,
  });
}

export function tooLarge() {
  return new Problem("Response too large", "Your server sent more data than this page accepts.", {
    detail: `Limit: ${MAX_RESPONSE} bytes`,
  });
}

export function oauthProblem(error, description) {
  const detail = [error, description]
    .filter((value) => typeof value === "string" && value)
    .join(" — ")
    .slice(0, 500);
  if (error === "access_denied") {
    return new Problem("Connection cancelled", "Your server didn’t allow access.", {
      steps: "Try again and approve FediTap on your server.",
      detail,
    });
  }
  return new Problem("Connection failed", "Your server refused it.", {
    steps: "Try again. If it keeps failing, check the account on your server.",
    detail,
  });
}

export function signInProblem(cause, detail) {
  return new Problem("Connection couldn’t finish", cause, {
    steps: "Try connecting again.",
    detail,
  });
}

export function sessionEnded(account) {
  return new Problem("Connection expired", `Reconnect as @${account.handle}.`, {
    sessionEnded: true,
  });
}

export function refused() {
  return new Problem("Connection refused", "Connect the account again.", {
    steps: "Choose your account at the top of the page, then connect it again under Add account.",
    detail: "HTTP 401",
  });
}

export function uncertain(detail) {
  return new Problem(
    "It may already have gone through",
    "Your server didn’t answer clearly. Check your account on your server before sending again.",
    { ambiguous: true, detail },
  );
}
