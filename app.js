"use strict";

const SCOPE = "read write";
const SIGN_IN_KEY = "fedishare.sign-in";
const STORE_KEY = `feditap.accounts:${new URL("./", location.href).pathname}`;
const AS_PROFILE = "https://www.w3.org/ns/activitystreams";
const PUBLIC = `${AS_PROFILE}#Public`;
const ACTIVITY_TYPE = `application/ld+json; profile="${AS_PROFILE}"`;
const ACTOR_TYPES = new Set(["Person", "Service", "Group", "Organization", "Application"]);
const ACTIONS = {
  like: { idle: "Like", done: "Liked", sent: "Liked", noun: "Like", verb: "like", quiet: true },
  repost: {
    idle: "Repost",
    done: "Reposted",
    sent: "Reposted",
    noun: "Repost",
    verb: "repost",
    quiet: true,
  },
  reply: { idle: "Reply", done: "Replied", sent: "Reply sent.", noun: "Reply", verb: "reply" },
  follow: {
    idle: "Follow",
    done: "Follow requested",
    sent: "Follow request sent.",
    noun: "Follow request",
    verb: "follow",
  },
};
const ACTOR_ACCEPT = `application/activity+json, application/ld+json; profile="${AS_PROFILE}"`;
const WP_SETTING = "On WordPress, turn on Settings › ActivityPub › Advanced › ActivityPub API.";
const MAX_RESPONSE = 1000000;
const MAX_HTML = 20000;
const DRAFT_KEY = "feditap.draft";
const WORDPRESS_HELP = {
  href: "https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/",
  text: "WordPress setup instructions",
};
const CORS_HELP = {
  href: "https://github.com/kasparsd/fedi-tap/blob/main/docs/development.md#cors",
  text: "Troubleshoot CORS",
};
const SHORTCUT_KEY = "feditap.shortcut";
const standalone =
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// The Shortcut and the Home Screen hint are for iPhone and iPad (iPadOS reports itself as a Mac with touch).
const ios =
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const $ = (id) => document.getElementById(id);
const main = document.querySelector("main");
const form = $("sign-in");
const input = $("account-input");
const targetInput = $("post-url");
const lookup = $("lookup");
const actionControls = $("action-controls");
const switcher = $("account-select");
const ADD_VALUE = "add";
const sheet = $("accounts-sheet");
const removeSheet = $("remove-sheet");
const replySheet = $("reply-sheet");
const replyText = $("reply-text");
// Fieldsets and buttons switched off while a task runs. The two input forms are not here: their
// fields stay editable-looking and keep focus (see FIELD_LOCKS).
const controls = [
  $("action-controls"),
  $("reauth-controls"),
  $("sheet-controls"),
  $("reply-controls"),
  $("sheet-done"),
  switcher,
];
const gated = [$("sign-in-controls"), $("lookup-controls")];
const FIELD_LOCKS = {
  auth: { fields: [input], buttons: [$("continue")] },
  lookup: { fields: [targetInput], buttons: [$("paste-link"), $("open-link")] },
};
const MESSAGE_IDS = {
  auth: ["status", "error"],
  lookup: ["lookup-status", "lookup-error"],
  actions: ["action-status", "action-error"],
  sheet: ["sheet-status", "sheet-error"],
  reply: ["reply-status", "reply-error"],
  reauth: ["reauth-status", "reauth-error"],
};
let busy = false;
let resolved = null;
let accounts = [];
let current = null;
let removing = null;
let shortcut = readShortcut();
let unsupported = null;
const done = new Map();
let liveStatus = null;
let liveMessage = "";

// A failure the person can act on: a title, one sentence of cause, optional steps, link and
// technical detail (HTTP codes, raw messages) and buttons. Rendered by problemView().
class Problem extends Error {
  constructor(title, cause, extra = {}) {
    super(cause);
    this.title = title;
    Object.assign(this, extra);
  }
}

function problemOf(failure, title, actions) {
  const problem =
    failure instanceof Problem ? failure : new Problem(null, failure?.message || "Try again.");
  problem.title ??= title ?? "Something went wrong";
  problem.actions ??= typeof actions === "function" ? actions(problem) : actions;
  return problem;
}

function apiOff(detail, steps = `Ask the site administrator to turn it on. ${WP_SETTING}`) {
  return new Problem("Server not supported", "It has no ActivityPub API.", {
    steps,
    link: WORDPRESS_HELP,
    detail,
  });
}

function corsProblem(title, detail) {
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

function mismatch(cause, detail) {
  return new Problem("Sign-in settings don’t match", cause, {
    steps: "Ask the server administrator to check the site address and OAuth settings.",
    detail,
  });
}

function httpsUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function homeEndpoint(value, origin) {
  const url = httpsUrl(value);
  return url && url.origin === origin && !url.hash ? url : null;
}

function tooLarge() {
  return new Problem("Response too large", "Your server sent more data than this page accepts.", {
    detail: `Limit: ${MAX_RESPONSE} bytes`,
  });
}

// Reads a JSON body without trusting its size: refuses anything over the limit before parsing.
async function readJson(response, limit = MAX_RESPONSE) {
  if (Number(response.headers.get("Content-Length")) > limit) throw tooLarge();
  let text = "";
  const reader = response.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let size = 0;
    for (;;) {
      const { done: finished, value: chunk } = await reader.read();
      if (finished) break;
      size += chunk.byteLength;
      if (size > limit) {
        reader.cancel().catch(() => {});
        throw tooLarge();
      }
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
  } else {
    text = await response.text();
    if (text.length > limit) throw tooLarge();
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getJson(url, accept = "application/json") {
  const response = await fetch(url, {
    headers: { Accept: accept },
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (httpsUrl(response.url)?.origin !== url.origin) {
    throw new Error("Discovery redirected to a different server.");
  }
  return response.json();
}

function parseHandle(value) {
  if (typeof value !== "string") return null;
  const match = /^(?:acct:)?@?([^@\s/?#]+)@([^@\s/?#:\\]+)$/u.exec(value);
  if (!match) return null;
  const domain = httpsUrl(`https://${match[2]}`);
  if (!domain) return null;
  return { handle: `${match[1]}@${domain.hostname}`, origin: domain.origin };
}

function isActorLink(link) {
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

async function fetchActor(url) {
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

async function oauthEndpoints(actor, origin) {
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
  const authorizeUrl =
    metadata?.authorization_endpoint ?? actor.endpoints?.oauthAuthorizationEndpoint;
  const tokenUrl = metadata?.token_endpoint ?? actor.endpoints?.oauthTokenEndpoint;
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
    authorize: authorizeEndpoint.href,
    token: token.href,
    issuer: advertisedIssuer ?? origin,
    requireIssuer: metadata?.authorization_response_iss_parameter_supported === true,
  };
}

function actorSettings(actor, origin) {
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

async function discover(value) {
  let profile = httpsUrl(value);
  let webfinger;
  if (!profile) {
    const account = parseHandle(value);
    if (!account || input.type === "url") {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "error-text");
      throw new Problem(
        "Check the account",
        input.type === "url"
          ? "Enter a link that starts with https://."
          : "Use @you@example.com or a profile link.",
        { actions: [] },
      );
    }
    webfinger = new URL("/.well-known/webfinger", account.origin);
    webfinger.searchParams.set("resource", `acct:${account.handle}`);
    profile = await webfingerActor(webfinger).catch(() => null);
    if (!profile) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "error-text");
      throw new Problem(
        `Can’t find ${account.handle}`,
        "Check the spelling, or use a profile link.",
        {
          actions: [{ label: "Use profile link", run: useProfileLink }],
        },
      );
    }
  }

  const { actor, id } = await fetchActor(profile);
  actorSettings(actor, id.origin);
  const oauth = await oauthEndpoints(actor, id.origin);
  return { ...oauth, profile: profile.href, actor: id.href, webfinger: webfinger?.href };
}

async function clientIdentity() {
  const page = new URL("./", location.href);
  const client = new URL("client.json", page);
  if (!httpsUrl(page.href) || !crypto.subtle) {
    throw new Problem("Can’t sign in here", "Open the published HTTPS page.");
  }
  const identity = await getJson(client).catch(() => null);
  if (
    identity?.client_id !== client.href ||
    !Array.isArray(identity.redirect_uris) ||
    !identity.redirect_uris.includes(page.href)
  ) {
    throw new Problem("This page can’t sign in", "Its OAuth client identity doesn’t match.", {
      steps: "Check client.json and open the published HTTPS address.",
      detail: "client_id or redirect_uris in client.json don’t match the page URL.",
    });
  }
  return { client_id: client.href, redirect_uri: page.href };
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function authorize(value) {
  const endpoints = await discover(value);
  const client = await clientIdentity();
  const state = randomString();
  const code_verifier = randomString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
  const url = new URL(endpoints.authorize);
  const params = {
    ...client,
    response_type: "code",
    scope: SCOPE,
    state,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: "S256",
  };
  for (const [name, param] of Object.entries(params)) url.searchParams.set(name, param);
  const target = httpsUrl(targetInput.value.trim())?.href;
  sessionStorage.setItem(SIGN_IN_KEY, JSON.stringify({ state, code_verifier, endpoints, target }));
  location.assign(url.href);
  return "Opening your server…";
}

function oauthProblem(error, description) {
  const detail = [error, description]
    .filter((value) => typeof value === "string" && value)
    .join(" — ")
    .slice(0, 500);
  if (error === "access_denied") {
    return new Problem("Sign-in cancelled", "Your server didn’t allow access.", {
      steps: "Try again and approve FediTap on your server.",
      detail,
    });
  }
  return new Problem("Sign-in failed", "Your server refused it.", {
    steps: "Try again. If it keeps failing, check the account on your server.",
    detail,
  });
}

function signInProblem(cause, detail) {
  return new Problem("Sign-in couldn’t finish", cause, {
    steps: "Try signing in again.",
    detail,
  });
}

async function requestToken(endpoint, params) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "application/json" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw corsProblem("Couldn’t reach your server.", error.message);
  }
  if (response.type === "opaqueredirect") {
    throw new Problem(
      "Sign-in was redirected",
      "The token address redirected the request, which isn’t allowed.",
      {
        steps: "Ask the server administrator to check the advertised token URL.",
        detail: "The token endpoint answered with a redirect.",
      },
    );
  }
  return { response, result: await response.json().catch(() => null) };
}

async function exchange(endpoint, params) {
  const { response, result } = await requestToken(endpoint, {
    grant_type: "authorization_code",
    ...params,
  });
  if (result?.error) throw oauthProblem(result.error, result.error_description);
  if (response.status === 404) {
    throw apiOff(
      "The token endpoint answered HTTP 404.",
      `Ask the site administrator to turn it on. ${WP_SETTING} If it is already on, ask them to check the token URL and clear cached profile responses.`,
    );
  }
  if (!response.ok || !result) {
    throw new Problem("Sign-in failed", "Your server couldn’t finish it.", {
      steps: "Try again in a moment.",
      detail: `HTTP ${response.status}`,
    });
  }
  return result;
}

async function completeSignIn(params) {
  let pending = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(SIGN_IN_KEY));
  } catch {
    // A damaged record is treated like a missing one.
  }
  sessionStorage.removeItem(SIGN_IN_KEY);
  const states = params.getAll("state");
  if (!pending?.state || states.length !== 1 || states[0] !== pending.state) {
    throw signInProblem("This isn’t the sign-in you started in this tab.");
  }
  const target = httpsUrl(pending.target);
  if (target) setTarget(target);
  if (params.has("error")) throw oauthProblem(params.get("error"), params.get("error_description"));
  const codes = params.getAll("code");
  const { endpoints, code_verifier } = pending;
  const origin = httpsUrl(endpoints?.actor)?.origin;
  const profile = httpsUrl(endpoints?.profile);
  const tokenEndpoint = homeEndpoint(endpoints?.token, origin);
  if (
    codes.length !== 1 ||
    !codes[0] ||
    !profile ||
    profile.origin !== origin ||
    !tokenEndpoint ||
    !homeEndpoint(endpoints.authorize, origin) ||
    !code_verifier
  ) {
    throw signInProblem("Your server returned an incomplete sign-in.");
  }
  const issuers = params.getAll("iss");
  if (
    (endpoints.requireIssuer || issuers.length) &&
    (issuers.length !== 1 || issuers[0] !== (endpoints.issuer ?? origin))
  ) {
    throw signInProblem(
      "The response didn’t come from your server’s OAuth issuer.",
      `iss: ${issuers.join(", ").slice(0, 200)}`,
    );
  }

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

  const result = await exchange(tokenEndpoint, { ...client, code: codes[0], code_verifier });
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
  await useStore((store) => {
    store.accounts[id.href] = {
      handle,
      actor: id.href,
      ...fields,
      ...credentials,
      token_endpoint: tokenEndpoint.href,
      client_id: client.client_id,
    };
    store.selectedActorId = id.href;
    saveStore(store);
  });
  refresh();
}

function renewableCredentials(result, previousRefreshToken) {
  const expiresIn = Number(result?.expires_in);
  const refreshToken = result?.refresh_token ?? previousRefreshToken;
  if (
    typeof result?.access_token !== "string" ||
    !result.access_token ||
    typeof refreshToken !== "string" ||
    !refreshToken ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  )
    return null;

  return {
    token: result.access_token,
    refresh_token: refreshToken,
    expires: Math.floor(Date.now() / 1000 + expiresIn),
  };
}

// "blocked": the browser refuses storage. "damaged": this app's saved data is not valid JSON.
class StoreError extends Error {
  constructor(kind) {
    super(
      kind === "damaged"
        ? "Saved data is damaged. Reload the page to reset it."
        : "Browser storage is blocked. Allow website data for this page.",
    );
    this.kind = kind;
  }
}

function readStore() {
  let raw;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    throw new StoreError("blocked");
  }
  if (raw === null) return { accounts: {}, selectedActorId: null };
  try {
    const store = JSON.parse(raw);
    if (store?.accounts && typeof store.accounts === "object" && !Array.isArray(store.accounts))
      return store;
  } catch {
    // Falls through to the same message.
  }
  throw new StoreError("damaged");
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    throw new StoreError("blocked");
  }
}

function useStore(callback) {
  return navigator.locks.request(STORE_KEY, () => callback(readStore()));
}

function requireReconnect(store, account) {
  delete account.token;
  delete account.refresh_token;
  delete account.expires;
  account.needsReauth = true;
  saveStore(store);
  throw sessionEnded(account);
}

function sessionEnded(account) {
  return new Problem("Sign-in expired", `Sign in again as @${account.handle}.`, {
    sessionEnded: true,
  });
}

async function refreshAccount(store, account) {
  const { response, result } = await requestToken(account.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: account.client_id,
  });
  if (result?.error === "invalid_grant" || response.status === 401) {
    requireReconnect(store, account);
  }
  if (!response.ok) {
    throw new Problem("Couldn’t renew your sign-in", "Your server didn’t renew the session.", {
      steps: "Try again in a moment.",
      detail: `HTTP ${response.status}`,
    });
  }
  const credentials = renewableCredentials(result, account.refresh_token);
  if (!credentials) requireReconnect(store, account);
  Object.assign(account, credentials);
  saveStore(store);
}

function withAccount(actorId, task) {
  return useStore(async (store) => {
    const account = store.accounts[actorId];
    if (!account) throw new Error("That account was removed. Choose another.");
    if (account.needsReauth) throw sessionEnded(account);
    const origin = httpsUrl(actorId)?.origin;
    if (
      ![account.token_endpoint, account.proxy, account.outbox].every((url) =>
        homeEndpoint(url, origin),
      )
    ) {
      requireReconnect(store, account);
    }
    if (account.expires <= Date.now() / 1000 + 60) {
      await refreshAccount(store, account);
    }
    return task(account, () => refreshAccount(store, account));
  });
}

async function activityRequest(account, endpoint, body, contentType) {
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
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw corsProblem("Couldn’t reach your server.", error.message);
  }
}

// Refreshes the token while telling the person, so a 401 never needs another tap.
async function reconnect(renew) {
  say("Reconnecting…");
  await renew();
  say();
}

function say(text = liveMessage) {
  if (liveStatus) liveStatus.textContent = text;
}

function activityId(value) {
  return httpsUrl(typeof value === "string" ? value : value?.id)?.href;
}

async function proxyRequest(account, id, renew) {
  const body = new URLSearchParams({ id });
  const response = await activityRequest(account, account.proxy, body);
  if (response.status !== 401) return response;
  await reconnect(renew);
  return activityRequest(account, account.proxy, body);
}

function plainText(html, limit) {
  if (typeof html !== "string") return "";
  const markup = html.slice(0, MAX_HTML).replace(/<\/p>|<br\s*\/?>/gi, "\n");
  const text = new DOMParser().parseFromString(markup, "text/html").body.textContent;
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, limit);
}

// The @user@host that names an author in a mention: from the actor when it has one, else from the
// author's address (last path segment and host).
function mentionOf(handle, authorId) {
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

// Returns the author's actor only when it proves who it is: its own id must equal the id the post
// names. A session that ended is not hidden; any other failure just means "unverified".
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

function linkOrigins(value) {
  const links = Array.isArray(value) ? value : [value];
  return links.map((link) => httpsUrl(typeof link === "string" ? link : link?.href)?.origin);
}

async function resolveTarget(account, target, renew) {
  const requested = new URL(target);
  const response = await proxyRequest(account, target, renew);
  if (!response.ok) {
    throw response.status === 404
      ? new Problem(
          "Couldn’t open this link",
          "Your server can’t find it. It may be private or deleted.",
          { detail: "HTTP 404" },
        )
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
  if (!id || !types.some((type) => typeof type === "string" && type) || !claimed) {
    throw new Problem("This isn’t a post or profile", "No post or profile came back.", {
      detail: "The response had no HTTPS id, type or author.",
    });
  }
  // The object must live at the link that was opened. A proxy may resolve an alias address, but then
  // the object has to name that address itself.
  if (idUrl.origin !== requested.origin && !linkOrigins(object.url).includes(requested.origin)) {
    throw new Problem(
      "This link doesn’t match",
      "Your server returned something from a different address.",
      {
        detail: `Opened ${requested.origin}, received ${idUrl.origin}`,
      },
    );
  }
  const actor = isActor ? object : await fetchAuthor(account, claimed, renew);
  const verified = Boolean(actor);
  const handle = verified ? actorHandle(actor, claimed) : idUrl.hostname;
  const published = new Date(object.published);
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
    date: Number.isNaN(published.getTime())
      ? ""
      : published.toLocaleDateString(undefined, { dateStyle: "medium" }),
  };
}

// Blank lines separate paragraphs, single newlines become line breaks, and every character is escaped.
function replyHtml(text, mention = "") {
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

function makeActivity(action, { id, author, isActor, mention }, account, reply) {
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
  // A reply is public and mentions the author, so the author is notified.
  const replying = author ? { to: [PUBLIC], cc: [author] } : { to: [PUBLIC], cc: [] };
  const note = {
    type: "Note",
    inReplyTo: id,
    content: replyHtml(reply, author ? mention : ""),
    ...replying,
  };
  if (author) note.tag = [{ type: "Mention", href: author, name: mention }];
  return { ...context, type: "Create", ...replying, object: note };
}

function uncertain(detail) {
  return new Problem(
    "It may already have gone through",
    "Your server didn’t answer clearly. Check your account on your server before sending again.",
    {
      ambiguous: true,
      detail,
    },
  );
}

// Sends an activity through the outbox, refreshing the token once on a 401. Resolves with the new
// activity's ID only when the server exposes its Location header to this page (CORS), else null.
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
    await reconnect(renew);
    response = await send();
  }
  if (response.status === 401) {
    throw new Problem("Sign-in refused", "Sign in again from the account menu.", {
      steps: "Choose Add account in the account menu and sign in again.",
      detail: "HTTP 401",
    });
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

async function sendActivity(account, action, target, reply, renew) {
  const activity = makeActivity(action, target, account, reply);
  const id = await postActivity(account, activity, renew);
  return { id, to: activity.to, cc: activity.cc };
}

function makeUndo(sent) {
  const undo = { "@context": AS_PROFILE, type: "Undo", object: sent.id, to: sent.to };
  if (sent.cc) undo.cc = sent.cc;
  return undo;
}

function readShortcut() {
  try {
    return localStorage.getItem(SHORTCUT_KEY);
  } catch {
    return null;
  }
}

function saveShortcut(value) {
  shortcut = value;
  try {
    localStorage.setItem(SHORTCUT_KEY, value);
  } catch {
    // The card just comes back next time.
  }
  render();
}

function flag(name, on) {
  main.toggleAttribute(name, Boolean(on));
}

// What the unsupported screen shows: a heading, a one-line cause and optionally a reset button.
function checkSupport() {
  if (!navigator.locks || !AbortSignal.timeout || !globalThis.crypto?.subtle) {
    return {
      heading: "Browser not supported",
      title: "This browser isn’t supported.",
      message: "Open the published https page in a current browser.",
    };
  }
  const blocked = {
    heading: "Storage is blocked",
    title: "This browser can’t save your sign-in.",
    message: "Allow website data for this page.",
  };
  try {
    localStorage.setItem("feditap.probe", "1");
    localStorage.removeItem("feditap.probe");
  } catch {
    return blocked;
  }
  try {
    readStore();
  } catch (error) {
    return error.kind === "damaged"
      ? {
          heading: "Saved data is damaged",
          title: "FediTap can’t read its saved data.",
          message: "Reset it, then sign in again.",
          reset: true,
        }
      : blocked;
  }
  return null;
}

function render() {
  const reauth = Boolean(current?.needsReauth);
  const state = unsupported
    ? "unsupported"
    : !current
      ? "signed-out"
      : resolved && !reauth
        ? "loaded"
        : "ready";
  const pending = targetInput.value;
  main.dataset.state = state;
  flag("data-pending", pending);
  flag("data-reauth", reauth);
  flag("data-shortcut", !shortcut);
  flag("data-standalone", standalone);
  flag("data-ios", ios);
  $("title").textContent =
    state === "unsupported"
      ? unsupported.heading
      : state === "loaded"
        ? resolved.isActor
          ? "Profile"
          : "Post"
        : state === "ready"
          ? "Open a link"
          : "Sign in";
  $("pending-link").textContent = pending;
  $("reauth-text").textContent = reauth ? `Sign in again as @${current.handle}.` : "";
  if (unsupported) {
    $("unsupported-title").textContent = unsupported.title;
    $("unsupported-text").textContent = unsupported.message;
    $("reset-data").hidden = !unsupported.reset;
  }
  $("open-link").classList.toggle("primary", !reauth);
  renderSwitcher();
  renderActions();
  renderReply();
  renderSheet();
}

// A finished action is remembered by account, target and kind, so a send that completes after the
// person moved on is still recorded and can't be sent twice.
function doneKey(actorId, object, action) {
  return `${actorId} ${action === "follow" ? object.author : object.id} ${action}`;
}

function sentFor(action) {
  return resolved && current ? done.get(doneKey(current.actor, resolved, action)) : undefined;
}

function renderActions() {
  if (!resolved) return;
  for (const button of actionControls.querySelectorAll("button[data-act]")) {
    const act = button.dataset.act;
    const finished = Boolean(sentFor(act));
    button.textContent = finished
      ? ACTIONS[act].done
      : act === "follow" && !resolved.isActor
        ? "Follow author"
        : ACTIONS[act].idle;
    button.disabled = finished;
    if (finished) button.setAttribute("aria-pressed", "true");
    else button.removeAttribute("aria-pressed");
    // A profile offers only Follow; a post whose author couldn't be verified offers no Follow.
    button.hidden = resolved.isActor ? act !== "follow" : act === "follow" && !resolved.author;
  }
  for (const undo of actionControls.querySelectorAll("button[data-undo]")) {
    undo.hidden = !sentFor(undo.dataset.undo)?.id;
  }
}

function renderReply() {
  $("reply-send").disabled = !replyText.value.trim();
  $("reply-context").textContent = !current
    ? ""
    : resolved?.name
      ? `To ${resolved.name}, as @${current.handle}.`
      : `As @${current.handle}.`;
}

function syncAccounts() {
  const store = readStore();
  accounts = Object.values(store.accounts);
  current =
    accounts.find((account) => account.actor === store.selectedActorId) ?? accounts[0] ?? null;
  return current;
}

function refresh() {
  const selected = syncAccounts();
  render();
  return selected;
}

// The header's account switcher: a native select. Its last option opens the Accounts dialog; an account
// that needs signing in again says so in its option text.
function renderSwitcher() {
  switcher.hidden = !current;
  if (!current) {
    switcher.replaceChildren();
    delete switcher.dataset.signature;
    return;
  }
  const signature = JSON.stringify(
    accounts.map((a) => [a.actor, a.handle, Boolean(a.needsReauth)]),
  );
  if (switcher.dataset.signature !== signature) {
    const options = accounts.map((account) => {
      const option = element(
        "option",
        `@${account.handle}${account.needsReauth ? " (sign in again)" : ""}`,
      );
      option.value = account.actor;
      return option;
    });
    const add = element("option", "Add account");
    add.value = ADD_VALUE;
    switcher.replaceChildren(...options, add);
    switcher.dataset.signature = signature;
  }
  switcher.value = current.actor;
}

function accountRow(account) {
  const item = document.createElement("li");
  const remove = element("button", "Remove", "destructive");
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove @${account.handle}`);
  remove.dataset.actor = account.actor;
  item.append(element("span", `@${account.handle}`), remove);
  return item;
}

function renderSheet() {
  // The sign-in form lives in the page and moves into the Accounts dialog while it is open. Outside the
  // page the view rules don't apply, so it drops its data-views there.
  if (sheet.open) {
    form.removeAttribute("data-views");
    if (form.parentElement !== sheet) sheet.insertBefore(form, $("sheet-status"));
    $("account-list").replaceChildren(...accounts.map(accountRow));
  } else {
    form.dataset.views = "signed-out";
    if (form.parentElement !== main) main.insertBefore(form, $("unsupported"));
  }
}

function openSheet(keepMessages = false) {
  if (!keepMessages) clearSheetMessages();
  if (!sheet.open) sheet.showModal();
  render();
  if (!keepMessages) input.focus();
}

function clearSheetMessages() {
  for (const section of ["sheet", "auth"]) clearMessages(section);
}

// Messages: each section has a status line (role=status, always in the page so it is announced) and
// a slot for one problem (an alert, its buttons and an optional disclosure).
function clearMessages(section) {
  const [statusId, errorId] = MESSAGE_IDS[section];
  $(statusId).textContent = "";
  if (section === "actions") $("action-announce").textContent = "";
  $(errorId).replaceChildren();
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function problemView(problem, slotId) {
  const alert = element("p");
  alert.id = `${slotId}-text`;
  alert.setAttribute("role", "alert");
  alert.tabIndex = -1;
  alert.append(element("strong", problem.title), " ", problem.message);
  const nodes = [alert];
  for (const action of problem.actions ?? []) {
    const button = element("button", action.label);
    button.type = "button";
    button.addEventListener("click", () => action.run());
    nodes.push(button);
  }
  if (problem.steps || problem.link || problem.detail) {
    const more = element("details");
    more.append(element("summary", problem.steps || problem.link ? "What to do" : "Details"));
    if (problem.steps) more.append(element("p", problem.steps, "quiet"));
    if (problem.link) {
      const note = element("p", undefined, "quiet");
      const link = element("a", problem.link.text);
      link.href = problem.link.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      note.append(link);
      more.append(note);
    }
    if (problem.detail) more.append(element("p", `Technical detail: ${problem.detail}`, "quiet"));
    nodes.push(more);
  }
  return nodes;
}

function showProblem(section, failure, title, actions) {
  const slot = $(MESSAGE_IDS[section][1]);
  slot.replaceChildren(...problemView(problemOf(failure, title, actions), slot.id));
}

function focusProblem(section) {
  $(MESSAGE_IDS[section][1]).querySelector("[role=alert]")?.focus();
}

function fail(section, title, cause) {
  clearMessages(section);
  showProblem(section, new Problem(title, cause, { actions: [] }));
}

function useProfileLink() {
  input.type = "url";
  input.value = "";
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
  $("account-label").textContent = "Profile link";
  input.placeholder = "https://";
  clearMessages("auth");
  input.focus();
}

function setTarget(target, local = true) {
  const url = new URL(location.href);
  url.searchParams.set("url", target.href);
  history.replaceState(local ? { local: true } : null, "", url);
  targetInput.value = target.href;
  render();
}

function dropTargetParam() {
  const url = new URL(location.href);
  if (!url.searchParams.has("url")) return;
  url.searchParams.delete("url");
  history.replaceState(null, "", url);
}

function resetPreview(keepMessages = false) {
  resolved = null;
  if (replySheet.open) replySheet.close();
  replyText.value = "";
  clearMessages("reply");
  if (!keepMessages) {
    clearMessages("actions");
    clearMessages("lookup");
  }
  render();
}

function showPreview(object) {
  resolved = object;
  $("target-name").textContent = object.name;
  $("target-name").hidden = !object.name;
  $("target-meta").textContent = [object.handle, object.date].filter(Boolean).join(" · ");
  $("target-excerpt").textContent = object.excerpt;
  $("target-excerpt").hidden = !object.excerpt;
  const host = $("target-link");
  host.href = object.id;
  host.textContent = `View on ${new URL(object.id).hostname}`;
  render();
}

// Runs one task with the page's controls off. The pressed button says what it is doing, and a failure
// becomes an alert. The input of a form keeps its value and focus: it turns read-only and its buttons
// aria-disabled while the request is in flight, never disabled.
async function runTask(section, message, task, { button, busyLabel, title, actions } = {}) {
  if (busy) return false;
  const [statusId] = MESSAGE_IDS[section];
  const status = $(statusId);
  const idleLabel = button?.textContent;
  const lock = FIELD_LOCKS[section];
  busy = true;
  for (const control of controls) control.disabled = true;
  for (const field of lock?.fields ?? []) field.readOnly = true;
  for (const lockable of lock?.buttons ?? []) lockable.setAttribute("aria-disabled", "true");
  clearMessages(section);
  status.textContent = message;
  if (button) {
    button.setAttribute("aria-busy", "true");
    if (busyLabel) button.textContent = busyLabel;
  }
  liveStatus = status;
  liveMessage = message;
  try {
    status.textContent = (await task()) ?? "";
    return true;
  } catch (failure) {
    status.textContent = "";
    showProblem(section, failure, title, actions);
    const previous = current?.actor;
    try {
      const selected = refresh();
      // A reply keeps its draft and its sheet when the session ends; the person decides what next.
      const keepDraft =
        section === "reply" &&
        replySheet.open &&
        selected?.needsReauth &&
        previous === selected.actor;
      if (!keepDraft && (selected?.needsReauth || previous !== selected?.actor)) resetPreview(true);
      // The session-ended screen says it already; don't repeat it as this task's error.
      if (failure?.sessionEnded && !keepDraft) clearMessages(section);
    } catch {
      resetPreview(true);
    }
    return false;
  } finally {
    busy = false;
    liveStatus = null;
    if (button) {
      button.removeAttribute("aria-busy");
      if (busyLabel) button.textContent = idleLabel;
    }
    for (const control of controls) control.disabled = false;
    for (const field of lock?.fields ?? []) field.readOnly = false;
    for (const lockable of lock?.buttons ?? []) lockable.removeAttribute("aria-disabled");
  }
}

// Marks the input a message belongs to, so the alert below it is read with the field.
function markInvalid(field, slotId) {
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", `${slotId}-text`);
}

function clearInvalid(field) {
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");
}

async function findTarget() {
  if (busy || !current) return;
  if (current.needsReauth) {
    focusFirst($("reauth-sign-in"));
    return;
  }
  resetPreview();
  clearInvalid(targetInput);
  const target = httpsUrl(targetInput.value.trim());
  if (!target) {
    fail("lookup", "That isn’t a link.", "Enter a link that starts with https://.");
    markInvalid(targetInput, "lookup-error");
    targetInput.focus();
    return;
  }
  setTarget(target);
  const actorId = current.actor;
  const found = await runTask(
    "lookup",
    "Loading…",
    async () => {
      const object = await withAccount(actorId, (account, renew) =>
        resolveTarget(account, target.href, renew),
      );
      if (current?.actor !== actorId || targetInput.value !== target.href) return;
      showPreview(object);
    },
    { button: $("open-link"), busyLabel: "Opening…", title: "Couldn’t open this link" },
  );
  if (found) return;
  if (current && !current.needsReauth) {
    markInvalid(targetInput, "lookup-error");
    targetInput.focus();
  }
}

function focusFirst(...candidates) {
  for (const candidate of candidates) {
    if (!candidate || candidate.closest("[hidden]")) continue;
    candidate.focus({ preventScroll: true });
    if (document.activeElement === candidate) return;
  }
}

// After a task, focus must not fall to the page behind a sheet or onto a control that is off.
function settleFocus() {
  const active = document.activeElement;
  if (active && active !== document.body && !active.matches(":disabled")) return;
  if (replySheet.open) focusFirst(replyText);
  else if (!sheet.open && !removeSheet.open) {
    const enabled = [...actionControls.querySelectorAll("button:not(:disabled)")];
    focusFirst(...enabled, targetInput, switcher);
  }
}

// Like, repost, follow and reply all end here. The target and account are captured up front, so a
// slow response is recorded against the link and account it was sent for, even if the page moved on.
async function perform(action, text = "") {
  if (!resolved || !current || busy) return;
  const actorId = current.actor;
  const object = resolved;
  const labels = ACTIONS[action];
  const inSheet = action === "reply";
  const section = inSheet ? "reply" : "actions";
  let message = "";
  render();
  const sent = await runTask(
    section,
    "",
    async () => {
      const result = await withAccount(actorId, (account, renew) =>
        sendActivity(account, action, object, text, renew),
      );
      done.set(doneKey(actorId, object, action), result);
      const same = current?.actor === actorId && resolved === object;
      message = same ? labels.sent : `${labels.noun} sent for the earlier link.`;
      // Like and Repost are confirmed by the button itself; screen readers get a hidden line.
      if (same && labels.quiet) {
        $("action-announce").textContent = labels.sent;
        return "";
      }
      return inSheet ? "" : message;
    },
    {
      button: inSheet ? $("reply-send") : actionControls.querySelector(`[data-act="${action}"]`),
      busyLabel: "Sending…",
      title: `Couldn’t ${labels.verb}.`,
      actions: (failure) =>
        failure.sessionEnded && inSheet ? [{ label: "Sign in", run: signInFromReply }] : [],
    },
  );
  if (sent && inSheet && message) {
    replyText.value = "";
    replySheet.close();
    $("action-status").textContent = message;
  }
  render();
  if (!sent && inSheet && replySheet.open) focusProblem("reply");
  settleFocus();
}

async function undoLast(action) {
  const sent = sentFor(action);
  if (!sent?.id || busy || !current) return;
  const actorId = current.actor;
  const object = resolved;
  const undone = await runTask(
    "actions",
    "",
    async () => {
      await withAccount(actorId, (account, renew) => postActivity(account, makeUndo(sent), renew));
      done.delete(doneKey(actorId, object, action));
      if (current?.actor === actorId && resolved === object) {
        $("action-announce").textContent = `${ACTIONS[action].noun} undone`;
      }
      return "";
    },
    {
      button: actionControls.querySelector(`[data-undo="${action}"]`),
      busyLabel: "Undoing…",
      title: "Couldn’t undo.",
    },
  );
  if (!undone) focusProblem("actions");
  render();
  settleFocus();
}

// Keeps a reply draft across the redirect to the server's sign-in page.
function signInFromReply() {
  const text = replyText.value;
  if (text.trim()) {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ target: targetInput.value, text }));
    } catch {
      // Without session storage the draft stays only until the page unloads.
    }
  }
  replySheet.close();
  reauthenticate();
}

function restoreDraft() {
  let draft = null;
  try {
    draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // A damaged draft is dropped.
  }
  if (resolved && draft?.target === targetInput.value && typeof draft.text === "string") {
    replyText.value = draft.text;
    renderReply();
    $("action-status").textContent = "Reply draft restored.";
  }
}

// Escape, Cancel and a tap on the backdrop must not close a sheet while its task is running.
function guardSheet(dialog) {
  dialog.addEventListener("cancel", (event) => {
    if (busy) event.preventDefault();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && busy) event.preventDefault();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog || busy) return;
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    ) {
      dialog.close();
    }
  });
}

guardSheet(sheet);
guardSheet(replySheet);
guardSheet(removeSheet);

lookup.addEventListener("submit", (event) => {
  event.preventDefault();
  void findTarget();
});

// Paste sits inside the link field: it reads the clipboard, fills the field and opens the link at once.
$("paste-link").addEventListener("click", async () => {
  if (busy || !current) return;
  const previous = targetInput.value;
  let copied = "";
  try {
    copied = await navigator.clipboard.readText();
  } catch {
    // Denied or unavailable: the person types instead.
  }
  if (busy || !current || targetInput.value !== previous) return;
  const target = httpsUrl(copied.trim());
  if (!target) {
    if (copied) fail("lookup", "No link copied.", "Copy a post or profile link first.");
    else fail("lookup", "Can’t paste.", "Type the link instead.");
    targetInput.setAttribute("aria-describedby", "lookup-error-text");
    targetInput.focus();
    return;
  }
  targetInput.value = target.href;
  await findTarget();
});

// Editing keeps the loaded post until the new link is submitted, and clears the old message.
targetInput.addEventListener("input", () => {
  clearInvalid(targetInput);
  clearMessages("lookup");
  dropTargetParam();
});

$("write-reply").addEventListener("click", () => {
  clearMessages("reply");
  replySheet.showModal();
  render();
  replyText.focus();
});

replyText.addEventListener("input", renderReply);

$("reply-send").addEventListener("click", () => {
  const text = replyText.value.trim();
  if (text) void perform("reply", text);
});

$("reply-cancel").addEventListener("click", () => replySheet.close());

replySheet.addEventListener("close", settleFocus);

actionControls.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.undo) void undoLast(button.dataset.undo);
  else if (button.dataset.act && button.dataset.act !== "reply") void perform(button.dataset.act);
});

// Choosing the last option opens the Accounts dialog and leaves the active account selected; choosing an
// account switches to it, and one that needs signing in goes straight to its sign-in.
switcher.addEventListener("change", () => {
  const value = switcher.value;
  if (value === ADD_VALUE) {
    switcher.value = current?.actor ?? "";
    openSheet();
  } else {
    void switchAccount(value);
  }
});

async function switchAccount(actorId) {
  if (busy || !actorId || actorId === current?.actor) {
    renderSwitcher();
    return;
  }
  resetPreview();
  const switched = await runTask(
    "lookup",
    "",
    async () => {
      await useStore((store) => {
        if (!store.accounts[actorId]) throw new Error("That account was removed in another tab.");
        store.selectedActorId = actorId;
        saveStore(store);
      });
      refresh();
    },
    { title: "Couldn’t switch accounts" },
  );
  if (!switched) return;
  if (current?.needsReauth) reauthenticate();
  else if (targetInput.value) await findTarget();
}

sheet.addEventListener("close", () => {
  render();
  (current ? switcher : input).focus();
});

$("sheet-done").addEventListener("click", () => sheet.close());

$("account-list").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const account = accounts.find((item) => item.actor === button.dataset.actor);
  if (!account) {
    // Removed in another tab: show what is left instead of asking about a ghost.
    try {
      refresh();
    } catch {
      resetPreview();
    }
    return;
  }
  removing = account.actor;
  $("remove-title").textContent = `Remove @${account.handle}?`;
  removeSheet.showModal();
});

$("remove-cancel").addEventListener("click", () => removeSheet.close());

$("remove-confirm").addEventListener("click", async () => {
  const actorId = removing;
  removing = null;
  removeSheet.close();
  if (!actorId) return;
  const wasCurrent = actorId === current?.actor;
  const removed = await runTask(
    "sheet",
    "",
    async () => {
      await useStore((store) => {
        delete store.accounts[actorId];
        if (store.selectedActorId === actorId) {
          store.selectedActorId = Object.keys(store.accounts)[0] ?? null;
        }
        saveStore(store);
      });
      if (wasCurrent) resetPreview();
      refresh();
    },
    { title: "Couldn’t remove the account" },
  );
  if (!removed) return;
  if (!current) sheet.close();
  else $("account-list").querySelector("button")?.focus();
});

function reauthenticate() {
  const account = current;
  if (!account) return;
  void runTask("reauth", "", () => authorize(account.actor), {
    button: $("reauth-sign-in"),
    busyLabel: "Looking up…",
    title: "Couldn’t start sign-in",
    actions: [{ label: "Try again", run: reauthenticate }],
  });
}

$("reauth-sign-in").addEventListener("click", reauthenticate);

$("reauth-other").addEventListener("click", () => openSheet());

$("reset-data").addEventListener("click", () => {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Blocked storage has nothing to reset.
  }
  location.reload();
});

$("add-shortcut").addEventListener("click", () => saveShortcut("dismissed"));

$("shortcut-have").addEventListener("click", () => saveShortcut("yes"));

window.addEventListener("storage", (event) => {
  if (event.key !== STORE_KEY && event.key !== null) return;
  const previous = current?.actor;
  try {
    const selected = refresh();
    if (previous !== selected?.actor || selected?.needsReauth) resetPreview();
    // No account left (removed in another tab): an open list of accounts has nothing to show.
    if (!selected && sheet.open) sheet.close();
  } catch (error) {
    resetPreview();
    unsupported = checkSupport();
    if (unsupported) render();
    else showProblem(current ? "actions" : "auth", error, "Couldn’t read your accounts");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  clearInvalid(input);
  const started = await runTask("auth", "", () => authorize(input.value.trim()), {
    button: $("continue"),
    busyLabel: "Looking up…",
    title: "Couldn’t sign in",
  });
  if (started) return;
  markInvalid(input, "error");
  input.focus();
});

input.addEventListener("input", () => {
  if (!input.hasAttribute("aria-invalid")) return;
  clearInvalid(input);
  clearMessages("auth");
});

async function start() {
  unsupported = checkSupport();
  if (unsupported) {
    render();
    return;
  }
  refresh();
  $("setup-unavailable").hidden = true;
  for (const control of [...controls, ...gated]) control.disabled = false;

  const callback = new URL(location.href);
  const shared = httpsUrl(callback.searchParams.get("url"));
  // A link the page wrote itself (paste, type, reload) carries history.state; a fresh one came from outside.
  const arrived =
    callback.searchParams.get("via") === "shortcut" || (shared && !history.state?.local);
  const oauthParams = ["code", "state", "error", "error_description", "error_uri", "iss"];
  const params = ["code", "state", "error"].some((key) => callback.searchParams.has(key))
    ? new URLSearchParams(callback.search)
    : null;
  if (params) for (const key of oauthParams) callback.searchParams.delete(key);
  callback.searchParams.delete("via");
  if (params || callback.href !== location.href)
    history.replaceState(history.state, "", callback.href);
  if (arrived && !shortcut) saveShortcut("yes");
  if (shared) setTarget(shared, Boolean(history.state?.local));
  if (params) {
    // With an account already connected the sign-in form lives in the accounts sheet, so a failed
    // return opens it there with the error beside the form.
    if (current) openSheet(true);
    const signedIn = await runTask(
      "auth",
      "",
      async () => {
        await completeSignIn(params);
        input.value = "";
        input.type = "text";
        input.placeholder = "you@example.com";
        $("account-label").textContent = "Account";
      },
      { button: $("continue"), busyLabel: "Signing in…", title: "Sign-in failed" },
    );
    if (!signedIn) {
      markInvalid(input, "error");
      return;
    }
    if (sheet.open) sheet.close();
  }
  if (targetInput.value && current && !current.needsReauth) await findTarget();
  restoreDraft();
}

void start().catch((error) => {
  showProblem("auth", error, "Something went wrong");
});
