"use strict";

const SCOPE = "read write";
const SIGN_IN_KEY = "fedishare.sign-in";
const STORE_KEY = `feditap.accounts:${new URL("./", location.href).pathname}`;
const AS_PROFILE = "https://www.w3.org/ns/activitystreams";
const PUBLIC = `${AS_PROFILE}#Public`;
const ACTIVITY_TYPE = `application/ld+json; profile="${AS_PROFILE}"`;
const ACTOR_TYPES = new Set(["Person", "Service", "Group", "Organization", "Application"]);
const ACTIONS = {
  like: { idle: "Like", done: "Liked", noun: "like", sent: "Liked", undone: "Like undone" },
  repost: { idle: "Repost", done: "Reposted", noun: "repost", sent: "Reposted", undone: "Repost undone" },
  reply: { idle: "Reply", done: "Replied", noun: "reply", sent: "Reply sent" },
  follow: { idle: "Follow", done: "Follow requested", noun: "follow request", sent: "Follow request sent", undone: "Follow request withdrawn" }
};
const REPLY_LIMIT = 500;
const ACTOR_ACCEPT = `application/activity+json, application/ld+json; profile="${AS_PROFILE}"`;
const WP_SETTING = "On WordPress, turn on Settings › ActivityPub › Advanced › ActivityPub API.";
const WORDPRESS_HELP = { href: "https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/", text: "WordPress setup instructions" };
const CORS_HELP = { href: "https://github.com/kasparsd/fedi-tap/blob/main/docs/development.md#cors", text: "Troubleshoot CORS" };
const SHORTCUT_KEY = "feditap.shortcut";
const PURPOSE = "Use your Fediverse account to like, repost, reply to or follow a post.";
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const $ = (id) => document.getElementById(id);
const main = document.querySelector("main");
const form = $("sign-in");
const input = $("account-input");
const targetInput = $("post-url");
const lookup = $("lookup");
const actionForm = $("action-form");
const chip = $("account-chip");
const sheet = $("accounts-sheet");
const removeSheet = $("remove-sheet");
const replySheet = $("reply-sheet");
const replyText = $("reply-text");
const controls = [
  $("sign-in-controls"), $("lookup-controls"), $("action-controls"), $("reauth-controls"), $("sheet-controls"),
  $("reply-controls")
];
const MESSAGE_IDS = {
  auth: ["status", "error"],
  actions: ["action-status", "action-error"],
  sheet: ["sheet-status", "sheet-error"],
  reply: ["reply-status", "reply-error"],
  reauth: ["reauth-status", "reauth-error"]
};
let busy = false;
let loading = false;
let resolved = null;
let accounts = [];
let current = null;
let sheetMode = "list";
let removing = null;
let shortcut = readShortcut();
let unsupported = null;
let done = new Map();
let outcome = null;
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
  const problem = failure instanceof Problem ? failure : new Problem(null, failure?.message || "Try again.");
  problem.title ??= title ?? "Something went wrong";
  problem.actions ??= actions;
  return problem;
}

function apiOff(detail, steps = `Ask the site administrator to turn it on. ${WP_SETTING}`) {
  return new Problem("This server isn’t set up yet", "The ActivityPub API is turned off.", {
    steps, link: WORDPRESS_HELP, detail
  });
}

function corsProblem(title, detail) {
  const cause = navigator.onLine === false
    ? "You appear to be offline."
    : "Your server didn’t allow this page to connect (CORS), or the connection failed.";
  return new Problem(title, cause, {
    steps: "Ask the server administrator to allow requests from this page. If you are offline, reconnect and try again.",
    link: CORS_HELP,
    detail
  });
}

function mismatch(cause, detail) {
  return new Problem("Sign-in settings don’t match", cause, {
    steps: "Ask the server administrator to check the site address and the OAuth settings.", detail
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

async function getJson(url, accept = "application/json") {
  const response = await fetch(url, {
    headers: { Accept: accept },
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(20000)
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
  return /^application\/activity\+json(?:\s*;|$)/i.test(type) ||
    (/^application\/ld\+json\s*;/i.test(type) &&
      /;\s*profile\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(type)?.slice(1).includes(AS_PROFILE));
}

async function webfingerActor(url) {
  const record = await getJson(url, "application/jrd+json, application/json");
  const links = Array.isArray(record?.links) ? record.links : [];
  return links.filter(isActorLink).map((link) => httpsUrl(link.href)).find(Boolean);
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
  throw new Problem("Couldn’t read your profile", "Your server didn’t return a matching ActivityPub profile, or it blocked this page (CORS).", {
    steps: "Enter the canonical HTTPS profile URL, and make sure the site allows cross-origin requests from this page.",
    link: CORS_HELP,
    detail
  });
}

async function oauthEndpoints(actor, origin) {
  const metadata = await getJson(new URL("/.well-known/oauth-authorization-server", origin))
    .catch(() => null);
  const advertisedIssuer = metadata?.issuer;
  const issuerUrl = homeEndpoint(advertisedIssuer, origin);
  if (advertisedIssuer !== undefined && (!issuerUrl || issuerUrl.search)) {
    throw mismatch("Your server’s OAuth issuer isn’t your account’s address.", `Issuer: ${String(advertisedIssuer).slice(0, 200)}`);
  }
  const authorizeUrl = metadata?.authorization_endpoint ?? actor.endpoints?.oauthAuthorizationEndpoint;
  const tokenUrl = metadata?.token_endpoint ?? actor.endpoints?.oauthTokenEndpoint;
  if (!authorizeUrl || !tokenUrl) throw apiOff("No authorization or token endpoint is advertised.");

  const authorize = homeEndpoint(authorizeUrl, origin);
  const token = homeEndpoint(tokenUrl, origin);
  if (!authorize || !token) {
    throw mismatch("The sign-in addresses belong to a different site than your account.", "Authorization and token endpoints must use the account’s HTTPS origin.");
  }
  return {
    authorize: authorize.href,
    token: token.href,
    issuer: advertisedIssuer ?? origin,
    requireIssuer: metadata?.authorization_response_iss_parameter_supported === true
  };
}

function actorSettings(actor, origin) {
  const endpoints = {
    outbox: httpsUrl(actor.outbox)?.href,
    proxy: httpsUrl(actor.endpoints?.proxyUrl)?.href,
    followers: httpsUrl(actor.followers)?.href
  };
  for (const [key, url] of Object.entries(endpoints)) {
    if (!url) {
      const field = key === "proxy" ? "proxyUrl" : key;
      throw apiOff(`The profile has no HTTPS ${field}.`, `Ask the site administrator to check the ActivityPub API. ${WP_SETTING}`);
    }
  }
  if (!homeEndpoint(endpoints.outbox, origin) || !homeEndpoint(endpoints.proxy, origin)) {
    throw mismatch("The outbox and proxy addresses belong to a different site than your account.", "The outbox and proxy must use the account’s HTTPS origin.");
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
      input.setAttribute("aria-describedby", "error");
      throw new Problem("Check the account", input.type === "url"
        ? "Enter an HTTPS profile URL."
        : "Enter a handle like you@example.com or an HTTPS profile URL.", { actions: [] });
    }
    webfinger = new URL("/.well-known/webfinger", account.origin);
    webfinger.searchParams.set("resource", `acct:${account.handle}`);
    profile = await webfingerActor(webfinger).catch(() => null);
    if (!profile) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "error");
      throw new Problem(`Couldn’t find ${account.handle}`, "Your server didn’t answer for this handle. Check the spelling, or use your profile link.", {
        actions: [
          { label: "Use a profile link instead", run: useProfileLink },
          { label: "Try again", run: retrySignIn }
        ]
      });
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
    throw new Problem("Can’t sign in here", "Open the published HTTPS page to sign in.");
  }
  const identity = await getJson(client).catch(() => null);
  if (identity?.client_id !== client.href ||
      !Array.isArray(identity.redirect_uris) ||
      !identity.redirect_uris.includes(page.href)) {
    throw new Problem("This page can’t sign in", "The OAuth client identity doesn’t match this page.", {
      steps: "Check client.json and open the published HTTPS address.",
      detail: "client_id or redirect_uris in client.json don’t match the page URL."
    });
  }
  return { client_id: client.href, redirect_uri: page.href };
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
    code_challenge_method: "S256"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const target = httpsUrl(targetInput.value.trim())?.href;
  sessionStorage.setItem(SIGN_IN_KEY, JSON.stringify({ state, code_verifier, endpoints, target }));
  location.assign(url.href);
  return "Opening your server’s sign-in page…";
}

function oauthProblem(error, description) {
  const detail = [error, description].filter((value) => typeof value === "string" && value).join(" — ").slice(0, 500);
  if (error === "access_denied") {
    return new Problem("Sign-in cancelled", "Your server didn’t give this page access.", {
      steps: "Try again and choose Allow on your server’s page.", detail, actions: [{ label: "Try again", run: retrySignIn }]
    });
  }
  return new Problem("Sign-in failed", "Your server refused the sign-in.", {
    steps: "Try again. If it keeps failing, check the account on your server.", detail, actions: [{ label: "Try again", run: retrySignIn }]
  });
}

function signInProblem(cause, detail) {
  return new Problem("Sign-in couldn’t finish", cause, { steps: "Try signing in again.", detail, actions: [{ label: "Try again", run: retrySignIn }] });
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
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw corsProblem("Couldn’t reach your server", error.message);
  }
  if (response.type === "opaqueredirect") {
    throw new Problem("Sign-in was redirected", "Your server’s token address redirected the request, which isn’t allowed.", {
      steps: "Ask the server administrator to check the advertised token URL.",
      detail: "The token endpoint answered with a redirect."
    });
  }
  return { response, result: await response.json().catch(() => null) };
}

async function exchange(endpoint, params) {
  const { response, result } = await requestToken(endpoint, { grant_type: "authorization_code", ...params });
  if (result?.error) throw oauthProblem(result.error, result.error_description);
  if (response.status === 404) {
    throw apiOff("The token endpoint answered HTTP 404.",
      `Ask the site administrator to turn it on. ${WP_SETTING} If it is already on, ask them to check the token URL and clear cached profile responses.`);
  }
  if (!response.ok || !result) {
    throw new Problem("Sign-in failed", "Your server couldn’t complete the sign-in.", {
      steps: "Try again in a moment.", detail: `HTTP ${response.status}`, actions: [{ label: "Try again", run: retrySignIn }]
    });
  }
  return result;
}

async function completeSignIn(params) {
  const saved = sessionStorage.getItem(SIGN_IN_KEY);
  sessionStorage.removeItem(SIGN_IN_KEY);
  const pending = JSON.parse(saved);
  const states = params.getAll("state");
  if (!pending?.state || states.length !== 1 || states[0] !== pending.state) {
    throw signInProblem("This sign-in doesn’t match the one started in this tab.");
  }
  const target = httpsUrl(pending.target);
  if (target) setTarget(target);
  if (params.has("error")) throw oauthProblem(params.get("error"), params.get("error_description"));
  const codes = params.getAll("code");
  const { endpoints, code_verifier } = pending;
  const origin = httpsUrl(endpoints?.actor)?.origin;
  const profile = httpsUrl(endpoints?.profile);
  const tokenEndpoint = homeEndpoint(endpoints?.token, origin);
  if (codes.length !== 1 || !codes[0] || !profile || profile.origin !== origin || !tokenEndpoint ||
      !homeEndpoint(endpoints.authorize, origin) || !code_verifier) {
    throw signInProblem("Your server returned an incomplete or invalid sign-in.");
  }
  const issuers = params.getAll("iss");
  if ((endpoints.requireIssuer || issuers.length) &&
      (issuers.length !== 1 || issuers[0] !== (endpoints.issuer ?? origin))) {
    throw signInProblem("The sign-in response didn’t come from your server’s OAuth issuer.", `iss: ${issuers.join(", ").slice(0, 200)}`);
  }

  const client = await clientIdentity();
  const { actor, id } = await fetchActor(profile);
  if (id.href !== endpoints.actor) {
    throw signInProblem("The account profile changed during sign-in.");
  }
  const fields = actorSettings(actor, origin);
  const handle = parseHandle(actor.webfinger)?.handle ||
    parseHandle(httpsUrl(endpoints.webfinger)?.searchParams.get("resource"))?.handle ||
    parseHandle(`${actor.preferredUsername || ""}@${id.hostname}`)?.handle;
  if (!handle) throw signInProblem("Your profile didn’t include a handle. Check your ActivityPub profile on the server.");

  const result = await exchange(tokenEndpoint, { ...client, code: codes[0], code_verifier });
  const authenticatedActor = result.activitypub_actor_id ?? result.me;
  if (authenticatedActor !== undefined && httpsUrl(authenticatedActor)?.href !== id.href) {
    throw new Problem("Wrong account", `Your server signed in a different profile. Sign in as ${handle}.`, {
      detail: `Authorized: ${String(authenticatedActor).slice(0, 200)}`, actions: [{ label: "Try again", run: retrySignIn }]
    });
  }
  const credentials = renewableCredentials(result);
  if (!credentials) {
    throw signInProblem("Your server didn’t return a token that can be renewed.", "Check that the WordPress ActivityPub plugin is up to date.");
  }
  await useStore((store) => {
    store.accounts[id.href] = {
      handle,
      actor: id.href,
      ...fields,
      ...credentials,
      token_endpoint: tokenEndpoint.href,
      client_id: client.client_id
    };
    store.selectedActorId = id.href;
    saveStore(store);
  });
  refresh();
}

function renewableCredentials(result, previousRefreshToken) {
  const expiresIn = Number(result?.expires_in);
  const refreshToken = result?.refresh_token ?? previousRefreshToken;
  if (typeof result?.access_token !== "string" || !result.access_token ||
      typeof refreshToken !== "string" || !refreshToken ||
      !Number.isFinite(expiresIn) || expiresIn <= 0) return null;

  return {
    token: result.access_token,
    refresh_token: refreshToken,
    expires: Math.floor(Date.now() / 1000 + expiresIn)
  };
}

function readStore() {
  try {
    const store = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!store) return { accounts: {}, selectedActorId: null };
    if (store.accounts && typeof store.accounts === "object" && !Array.isArray(store.accounts)) return store;
  } catch {
    // A blocked or malformed store needs the same recovery.
  }
  throw new Error("FediTap couldn’t read browser storage. Enable site storage or clear this site’s saved data.");
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    throw new Error("FediTap couldn’t save your account. Allow this site to use browser storage.");
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
  throw new Problem("Session ended", `Sign in again to use @${account.handle}.`);
}

async function refreshAccount(store, account) {
  const { response, result } = await requestToken(account.token_endpoint, {
    grant_type: "refresh_token",
    refresh_token: account.refresh_token,
    client_id: account.client_id
  });
  if (result?.error === "invalid_grant" || response.status === 401) {
    requireReconnect(store, account);
  }
  if (!response.ok) {
    throw new Problem("Couldn’t renew your sign-in", "Your server didn’t renew the session.", {
      steps: "Try again in a moment.", detail: `HTTP ${response.status}`
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
    if (!account) throw new Error("Connect a Fediverse account first.");
    if (account.needsReauth) throw new Problem("Session ended", `Sign in again to use @${account.handle}.`);
    const origin = httpsUrl(actorId)?.origin;
    if (![account.token_endpoint, account.proxy, account.outbox].every((url) => homeEndpoint(url, origin))) {
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
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    throw corsProblem("Couldn’t reach your server", error.message);
  }
}

// Refreshes the token while telling the person, so a 401 never needs another tap.
async function reconnect(refresh) {
  say("Reconnecting…");
  await refresh();
  say();
}

function say(text = liveMessage) {
  if (liveStatus) liveStatus.textContent = text;
}

function activityId(value) {
  return httpsUrl(typeof value === "string" ? value : value?.id)?.href;
}

async function proxyRequest(account, id, refresh) {
  const body = new URLSearchParams({ id });
  const response = await activityRequest(account, account.proxy, body);
  if (response.status !== 401) return response;
  await reconnect(refresh);
  return activityRequest(account, account.proxy, body);
}

function plainText(html, limit) {
  if (typeof html !== "string") return "";
  const markup = html.replace(/<\/p>|<br\s*\/?>/gi, "\n");
  const text = new DOMParser().parseFromString(markup, "text/html").body.textContent;
  return text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim().slice(0, limit);
}

function fallbackHandle(id) {
  const url = new URL(id);
  const name = url.pathname.split("/").filter(Boolean).pop()?.replace(/^@/, "");
  return name ? `@${name}@${url.hostname}` : url.hostname;
}

function actorHandle(actor, id) {
  const known = parseHandle(actor?.webfinger) ||
    parseHandle(`${actor?.preferredUsername || ""}@${new URL(id).hostname}`);
  return known ? `@${known.handle}` : fallbackHandle(id);
}

async function fetchAuthor(account, id, refresh) {
  try {
    const response = await proxyRequest(account, id, refresh);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function resolveTarget(account, target, refresh) {
  const response = await proxyRequest(account, target, refresh);
  if (!response.ok) {
    throw response.status === 404
      ? new Problem("Couldn’t open this link", "Your server couldn’t find it. It may be private or deleted.", { detail: "HTTP 404" })
      : new Problem("Couldn’t open this link", "Your server couldn’t load it.", {
        steps: "Try again in a moment. If it keeps happening, the post may not be available to your server.",
        detail: `HTTP ${response.status}`
      });
  }
  const object = await response.json().catch(() => null);
  const id = activityId(object);
  const types = Array.isArray(object?.type) ? object.type : [object?.type];
  const isActor = types.some((type) => ACTOR_TYPES.has(type));
  const authors = Array.isArray(object?.attributedTo) ? object.attributedTo : [object?.attributedTo];
  const author = isActor ? id : authors.map(activityId).find(Boolean);
  if (!id || !types.some((type) => typeof type === "string" && type) || !author) {
    throw new Problem("This isn’t a post or profile", "Your server didn’t return an ActivityPub post or profile with an author.", {
      detail: "The response had no HTTPS id, type or author."
    });
  }
  const actor = isActor ? object : await fetchAuthor(account, author, refresh);
  const handle = actorHandle(actor, author);
  const published = new Date(object.published);
  return {
    id,
    author,
    isActor,
    handle,
    name: plainText(actor?.name, 100) || plainText(actor?.preferredUsername, 100) || handle,
    excerpt: plainText(isActor ? object.summary : object.content || object.summary || object.name, 600),
    date: Number.isNaN(published.getTime()) ? "" : published.toLocaleDateString(undefined, { dateStyle: "medium" })
  };
}

function makeActivity(action, { id, author, isActor }, account, reply) {
  const context = { "@context": AS_PROFILE };
  if (action === "follow") return { ...context, type: "Follow", object: author, to: [author] };
  if (isActor) throw new Error("Only Follow is available for a profile.");
  const addressing = { to: [author], cc: [PUBLIC] };
  if (action === "like") return { ...context, type: "Like", object: id, ...addressing };
  if (action === "repost") {
    return { ...context, type: "Announce", object: id, to: [PUBLIC], cc: [account.followers] };
  }
  if (!reply) throw new Error("Write a reply before sending it.");
  const escaped = reply.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return {
    ...context,
    type: "Create",
    ...addressing,
    object: { type: "Note", inReplyTo: id, content: `<p>${escaped}</p>`, ...addressing }
  };
}

// Sends an activity through the outbox, refreshing the token once on a 401. Resolves with the new
// activity's ID only when the server exposes its Location header to this page (CORS), else null.
async function postActivity(account, activity, refresh) {
  const body = JSON.stringify(activity);
  let response = await activityRequest(account, account.outbox, body, ACTIVITY_TYPE);
  if (response.status === 401) {
    await reconnect(refresh);
    response = await activityRequest(account, account.outbox, body, ACTIVITY_TYPE);
  }
  if (response.status === 401) {
    throw new Problem("Your server didn’t accept the sign-in", "The renewed sign-in was refused too.", {
      steps: "Open your account at the top and sign in again.", detail: "HTTP 401"
    });
  }
  if (!response.ok) {
    throw new Problem(null, "Your server rejected it.", { steps: "Try again in a moment.", detail: `HTTP ${response.status}` });
  }
  const id = httpsUrl(response.headers.get("Location"));
  return id && id.origin === new URL(account.outbox).origin && !id.hash ? id.href : null;
}

async function sendActivity(account, action, target, reply, refresh) {
  const activity = makeActivity(action, target, account, reply);
  const id = await postActivity(account, activity, refresh);
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

function checkSupport() {
  const cause = !navigator.locks || !AbortSignal.timeout || !globalThis.crypto?.subtle
    ? new Problem("Can’t sign in here", "This browser isn’t supported, or the page isn’t open over HTTPS.")
    : null;
  if (cause) return cause;
  try {
    localStorage.setItem("feditap.probe", "1");
    localStorage.removeItem("feditap.probe");
    readStore();
  } catch {
    return new Problem("Can’t save accounts", "This browser can’t keep your sign-in.");
  }
  return null;
}

function render() {
  const reauth = Boolean(current?.needsReauth);
  const state = unsupported ? "unsupported" : !current ? "signed-out" : resolved && !reauth ? "loaded" : "ready";
  const pending = targetInput.value;
  main.dataset.state = state;
  flag("data-pending", pending);
  flag("data-reauth", reauth);
  flag("data-loading", loading);
  flag("data-shortcut", !shortcut);
  flag("data-standalone", standalone);
  $("title").textContent = state === "unsupported" ? unsupported.title :
    state === "loaded" ? (resolved.isActor ? "Profile" : "Post") :
    state === "ready" ? "Open a link" : "Sign in";
  $("subtitle").textContent = pending ? "to continue with this link" : PURPOSE;
  $("pending-link").textContent = pending;
  $("loading-link").textContent = pending;
  $("reauth-text").textContent = reauth ? `Your server ended the session for @${current.handle}.` : "";
  if (unsupported) {
    $("unsupported-title").textContent = unsupported.title === "Can’t save accounts" ? "Storage is blocked" : "This browser isn’t supported";
    $("unsupported-text").textContent = unsupported.message;
  }
  chip.hidden = !current;
  chip.textContent = current ? `@${current.handle}` : "";
  chip.toggleAttribute("data-warn", reauth);
  $("action-next").hidden = !outcome;
  $("undo").hidden = !outcome?.undo;
  renderActions();
  renderReply();
  renderSheet();
}

function renderActions() {
  const target = resolved;
  $("action-hint").textContent = target?.isActor && !done.has("follow") && current
    ? `Sends a follow request from @${current.handle}.` : "";
  if (!target) return;
  for (const button of actionForm.querySelectorAll("button[data-act]")) {
    const act = button.dataset.act;
    const finished = done.has(act);
    button.textContent = finished ? ACTIONS[act].done : act === "follow" ? `Follow ${target.name}` : ACTIONS[act].idle;
    button.disabled = finished;
    button.toggleAttribute("data-done", finished);
    button.hidden = target.isActor && act !== "follow";
  }
}

function renderReply() {
  const length = [...replyText.value].length;
  $("reply-count").textContent = `${length} / ${REPLY_LIMIT}`;
  $("reply-count").toggleAttribute("data-over", length > REPLY_LIMIT);
  $("reply-send").disabled = !replyText.value.trim() || length > REPLY_LIMIT;
  $("reply-context").textContent = current ? `As @${current.handle}. Public: anyone can see this reply.` : "";
  replyText.placeholder = resolved ? `Reply to ${resolved.name}` : "";
}

function syncAccounts() {
  const store = readStore();
  accounts = Object.values(store.accounts);
  current = accounts.find((account) => account.actor === store.selectedActorId) ?? accounts[0] ?? null;
  return current;
}

function refresh() {
  const selected = syncAccounts();
  render();
  return selected;
}

function accountRow(account) {
  const item = document.createElement("li");
  const select = document.createElement("button");
  const label = document.createElement("span");
  const detail = document.createElement("small");
  const check = document.createElement("span");
  select.type = "button";
  select.className = "row-main";
  select.dataset.action = "select";
  select.dataset.actor = account.actor;
  select.disabled = sheetMode === "edit";
  if (account.actor === current?.actor) select.setAttribute("aria-current", "true");
  label.className = "grow";
  detail.textContent = account.needsReauth ? "Sign in again" : new URL(account.actor).host;
  detail.classList.toggle("warn", Boolean(account.needsReauth));
  label.append(`@${account.handle}`, detail);
  check.className = "check";
  check.setAttribute("aria-hidden", "true");
  select.append(label, check);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "row-remove";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove @${account.handle}`);
  remove.dataset.action = "remove";
  remove.dataset.actor = account.actor;
  item.append(select, remove);
  return item;
}

function renderSheet() {
  const slot = sheet.open && sheetMode === "add" ? $("sheet-sign-in") : $("sign-in-slot");
  if ($("sign-in-panel").parentElement !== slot) slot.append($("sign-in-panel"));
  sheet.dataset.mode = sheetMode;
  $("sheet-title").textContent = sheetMode === "add" ? "Add account" : "Accounts";
  $("sheet-left").textContent = { list: "Edit", edit: "Done", add: "Cancel" }[sheetMode];
  if (sheet.open) $("account-list").replaceChildren(...accounts.map(accountRow));
}

function openSheet(mode = "list", keepMessages = false) {
  sheetMode = mode;
  if (!keepMessages) clearSheetMessages();
  if (!sheet.open) sheet.showModal();
  render();
  if (mode === "add" && !keepMessages) input.focus();
}

function clearSheetMessages() {
  for (const section of ["sheet", "auth"]) clearMessages(section);
}

function setSheetMode(mode) {
  sheetMode = mode;
  clearSheetMessages();
  render();
  if (mode === "add") input.focus();
}

// Messages: each section has a status line (role=status) and an error slot (role=alert).
function clearMessages(section) {
  const [statusId, errorId] = MESSAGE_IDS[section];
  $(statusId).textContent = "";
  $(errorId).replaceChildren();
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function problemView(problem) {
  const box = element("div", undefined, "banner err problem");
  box.append(element("strong", problem.title), element("p", problem.message));
  if (problem.steps || problem.link || problem.detail) {
    const more = element("details");
    more.append(element("summary", problem.steps || problem.link ? "What to do" : "Details"));
    if (problem.steps) more.append(element("p", problem.steps, "help"));
    if (problem.link) {
      const link = element("a", problem.link.text);
      link.href = problem.link.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      more.append(link);
    }
    if (problem.detail) more.append(element("p", `Technical detail: ${problem.detail}`, "meta"));
    box.append(more);
  }
  (problem.actions ?? []).forEach((action, index) => {
    const button = element("button", action.label, index === 0 ? "primary" : "");
    button.type = "button";
    button.addEventListener("click", () => action.run());
    box.append(button);
  });
  return box;
}

function showProblem(section, failure, title, actions) {
  $(MESSAGE_IDS[section][1]).replaceChildren(problemView(problemOf(failure, title, actions)));
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
  $("account-label").textContent = "ActivityPub profile URL";
  input.placeholder = "https://…";
  clearMessages("auth");
  input.focus();
}

function retrySignIn() {
  if (input.value.trim() && input.reportValidity()) form.requestSubmit();
  else input.focus();
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
  done = new Map();
  outcome = null;
  if (replySheet.open) replySheet.close();
  replyText.value = "";
  clearMessages("reply");
  if (!keepMessages) clearMessages("actions");
  render();
}

function showPreview(object) {
  resolved = object;
  done = new Map();
  outcome = null;
  $("target-name").textContent = object.name;
  $("target-handle").textContent = object.handle;
  $("target-excerpt").textContent = object.excerpt;
  $("target-excerpt").hidden = !object.excerpt;
  const host = $("target-link");
  host.href = object.id;
  host.textContent = new URL(object.id).hostname;
  $("target-date").textContent = object.date;
  actionForm.dataset.kind = object.isActor ? "profile" : "post";
  render();
}

// Runs one task with every control off. The pressed button shows a spinner, the section's status
// line says what is happening, and a failure becomes a structured error with its own buttons.
async function runTask(section, message, task, { button, title, actions } = {}) {
  if (busy) return false;
  const [statusId] = MESSAGE_IDS[section];
  const status = $(statusId);
  busy = true;
  for (const fieldset of controls) fieldset.disabled = true;
  clearMessages(section);
  status.textContent = message;
  status.toggleAttribute("data-busy", Boolean(message));
  button?.setAttribute("data-busy", "");
  liveStatus = status;
  liveMessage = message;
  try {
    status.textContent = await task() ?? "";
    return true;
  } catch (failure) {
    status.textContent = "";
    showProblem(section, failure, title, actions);
    const previous = current?.actor;
    try {
      const selected = refresh();
      if (selected?.needsReauth || previous !== selected?.actor) resetPreview(true);
    } catch {
      resetPreview(true);
    }
    return false;
  } finally {
    busy = false;
    liveStatus = null;
    status.removeAttribute("data-busy");
    button?.removeAttribute("data-busy");
    for (const fieldset of controls) fieldset.disabled = false;
  }
}

async function findTarget(focusResult = false) {
  if (busy || !current) return;
  resetPreview();
  const target = httpsUrl(targetInput.value.trim());
  if (!target) {
    fail("actions", "Check the link", "Enter an HTTPS post or profile URL.");
    targetInput.focus();
    return;
  }
  setTarget(target);
  const actorId = current.actor;
  loading = true;
  render();
  const found = await runTask("actions", "Looking up the link…", async () => {
    const object = await withAccount(actorId, (account, refresh) => resolveTarget(account, target.href, refresh));
    if (current?.actor !== actorId || targetInput.value !== target.href) return;
    showPreview(object);
  }, {
    title: "Couldn’t open this link",
    actions: [{ label: "Try again", run: () => findTarget(true) }, { label: "Change link", run: changeLink }]
  });
  loading = false;
  render();
  if (found && resolved && focusResult) $("target-card").focus();
}

function changeLink() {
  resetPreview();
  targetInput.focus();
  targetInput.select();
}

function settleFocus() {
  const active = document.activeElement;
  if (!active || active === document.body || active.disabled) $("target-card").focus({ preventScroll: true });
}

// Like, repost, follow and reply all end here. The target and account are captured up front, so a
// slow response can't mark a different link or account as done.
async function perform(action, text = "") {
  if (!resolved || !current || busy) return;
  const actorId = current.actor;
  const object = resolved;
  const handle = current.handle;
  const labels = ACTIONS[action];
  const inSheet = action === "reply";
  const section = inSheet ? "reply" : "actions";
  let message = "";
  outcome = null;
  render();
  const sent = await runTask(section, "Sending…", async () => {
    const result = await withAccount(actorId, (account, refresh) => sendActivity(account, action, object, text, refresh));
    if (current?.actor !== actorId || resolved !== object) return "";
    done.set(action, result);
    outcome = { undo: Boolean(result.id) && action !== "reply", action };
    message = `${labels.sent} as @${handle}`;
    return inSheet ? "" : message;
  }, {
    button: inSheet ? $("reply-send") : actionForm.querySelector(`[data-act="${action}"]`),
    title: `Couldn’t send the ${labels.noun}`,
    actions: [{ label: "Try again", run: () => perform(action, text) }]
  });
  if (sent && inSheet && message) {
    replyText.value = "";
    replySheet.close();
    $("action-status").textContent = message;
  }
  render();
  settleFocus();
}

async function undoLast(action) {
  const sent = done.get(action);
  if (!sent?.id || busy || !current) return;
  const actorId = current.actor;
  const object = resolved;
  outcome = null;
  render();
  const undone = await runTask("actions", "Undoing…", async () => {
    await withAccount(actorId, (account, refresh) => postActivity(account, makeUndo(sent), refresh));
    if (current?.actor !== actorId || resolved !== object) return "";
    done.delete(action);
    outcome = { undo: false };
    return ACTIONS[action].undone;
  }, { title: "Couldn’t undo", actions: [{ label: "Try again", run: () => undoLast(action) }] });
  if (!undone) outcome = { undo: true, action };
  render();
  settleFocus();
}

lookup.addEventListener("submit", (event) => {
  event.preventDefault();
  void findTarget(true);
});

$("paste-link").addEventListener("click", async () => {
  const previous = targetInput.value;
  let copied;
  try {
    copied = await navigator.clipboard.readText();
  } catch {
    if (busy || !current || targetInput.value !== previous) return;
    fail("actions", "Can’t read the clipboard", "Type or paste the link into the field instead.");
    targetInput.focus();
    return;
  }
  if (busy || !current || targetInput.value !== previous) return;
  const target = httpsUrl(copied.trim());
  if (!target) {
    fail("actions", "Nothing to paste", "Copy an HTTPS post or profile link, then try Paste again.");
    return;
  }
  targetInput.value = target.href;
  await findTarget(true);
});

targetInput.addEventListener("input", () => {
  resetPreview();
  dropTargetParam();
});

$("change-link").addEventListener("click", changeLink);

$("another-link").addEventListener("click", () => {
  resetPreview();
  targetInput.value = "";
  dropTargetParam();
  render();
  $("paste-link").focus();
});

$("undo").addEventListener("click", () => {
  if (outcome?.undo) void undoLast(outcome.action);
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

replySheet.addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
});

replySheet.addEventListener("click", (event) => {
  if (event.target === replySheet && !busy) replySheet.close();
});

replySheet.addEventListener("close", settleFocus);

actionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const action = event.submitter?.dataset.act;
  if (action && action !== "reply") void perform(action);
});

chip.addEventListener("click", () => openSheet("list"));

sheet.addEventListener("close", () => {
  sheetMode = "list";
  render();
  (current ? chip : input).focus();
});

sheet.addEventListener("click", (event) => {
  if (event.target === sheet) sheet.close();
});

$("sheet-right").addEventListener("click", () => sheet.close());

$("sheet-left").addEventListener("click", () => {
  if (sheetMode === "list") setSheetMode("edit");
  else setSheetMode("list");
});

$("add-account").addEventListener("click", () => setSheetMode("add"));

$("account-list").addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const actorId = button.dataset.actor;
  if (button.dataset.action === "remove") {
    const account = accounts.find((item) => item.actor === actorId);
    removing = actorId;
    $("remove-title").textContent = `Remove @${account.handle}?`;
    removeSheet.showModal();
    return;
  }
  if (actorId === current?.actor) return sheet.close();
  resetPreview();
  const selected = await runTask("sheet", "", async () => {
    await useStore((store) => {
      if (!store.accounts[actorId]) throw new Error("That account was removed in another tab.");
      store.selectedActorId = actorId;
      saveStore(store);
    });
    refresh();
  }, { title: "Couldn’t switch accounts" });
  if (!selected) return;
  sheet.close();
  if (targetInput.value) await findTarget();
});

$("remove-cancel").addEventListener("click", () => removeSheet.close());

removeSheet.addEventListener("click", (event) => {
  if (event.target === removeSheet) removeSheet.close();
});

$("remove-confirm").addEventListener("click", async () => {
  const actorId = removing;
  removeSheet.close();
  const wasCurrent = actorId === current?.actor;
  const removed = await runTask("sheet", "", async () => {
    await useStore((store) => {
      delete store.accounts[actorId];
      if (store.selectedActorId === actorId) {
        store.selectedActorId = Object.keys(store.accounts)[0] ?? null;
      }
      saveStore(store);
    });
    if (wasCurrent) resetPreview();
    refresh();
  }, { title: "Couldn’t remove the account" });
  if (!removed) return;
  if (!current) sheet.close();
  else $("account-list").querySelector(".row-remove")?.focus();
});

function reauthenticate() {
  const account = current;
  if (!account) return;
  void runTask("reauth", "Looking up your account…", () => authorize(account.actor), {
    button: $("reauth-sign-in"),
    title: "Couldn’t start sign-in",
    actions: [{ label: "Try again", run: reauthenticate }]
  });
}

$("reauth-sign-in").addEventListener("click", reauthenticate);

$("reauth-other").addEventListener("click", () => openSheet("add"));

$("add-shortcut").addEventListener("click", () => saveShortcut("dismissed"));

$("shortcut-have").addEventListener("click", () => saveShortcut("yes"));

window.addEventListener("storage", (event) => {
  if (event.key !== STORE_KEY && event.key !== null) return;
  const previous = current?.actor;
  try {
    const selected = refresh();
    if (previous !== selected?.actor || selected?.needsReauth) resetPreview();
  } catch (error) {
    resetPreview();
    showProblem(current ? "actions" : "auth", error, "Couldn’t read your accounts");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
  await runTask("auth", "Looking up your account…", () => authorize(input.value.trim()), {
    button: $("continue"),
    title: "Couldn’t sign in",
    actions: [{ label: "Try again", run: retrySignIn }]
  });
  if (input.hasAttribute("aria-invalid")) input.focus();
});

input.addEventListener("input", () => {
  if (!input.hasAttribute("aria-invalid")) return;
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
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
  for (const fieldset of controls) fieldset.disabled = false;

  const callback = new URL(location.href);
  const shared = httpsUrl(callback.searchParams.get("url"));
  // A link the page wrote itself (paste, type, reload) carries history.state; a fresh one came from outside.
  const arrived = callback.searchParams.get("via") === "shortcut" || (shared && !history.state?.local);
  const oauthParams = ["code", "state", "error", "error_description", "error_uri", "iss"];
  const params = ["code", "state", "error"].some((key) => callback.searchParams.has(key))
    ? new URLSearchParams(callback.search)
    : null;
  if (params) for (const key of oauthParams) callback.searchParams.delete(key);
  callback.searchParams.delete("via");
  if (params || callback.href !== location.href) history.replaceState(history.state, "", callback.href);
  if (arrived && !shortcut) saveShortcut("yes");
  if (shared) setTarget(shared, Boolean(history.state?.local));
  if (params) {
    // With an account already connected the sign-in form lives in the accounts sheet, so a failed
    // return opens it there with the error beside the form.
    if (current) openSheet("add", true);
    const signedIn = await runTask("auth", "Finishing sign-in…", async () => {
      await completeSignIn(params);
      input.value = "";
      input.type = "text";
      input.placeholder = "you@example.com";
      $("account-label").textContent = "Fediverse handle or profile URL";
    }, { title: "Sign-in failed", actions: [{ label: "Try again", run: retrySignIn }] });
    if (!signedIn) return;
    if (sheet.open) sheet.close();
    $("action-status").textContent = `Signed in as @${current.handle}`;
  }
  if (targetInput.value && current) await findTarget();
}

void start().catch((error) => {
  showProblem("auth", error, "Something went wrong");
});
