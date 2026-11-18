"use strict";

const SHORTCUT_ICLOUD_URL = "";
const SHORTCUT_NAME = "FediTap";
const SCOPE = "read write";
const SIGN_IN_KEY = "fedishare.sign-in";
const LAST_HANDLE_KEY = `feditap.last-handle:${new URL("./", location.href).pathname}`;
const AS_PROFILE = "https://www.w3.org/ns/activitystreams";
const ACTOR_ACCEPT = `application/activity+json, application/ld+json; profile="${AS_PROFILE}"`;
const API_OFF = "This server doesn't support the ActivityPub API. On WordPress, turn on Settings › ActivityPub › Advanced › ActivityPub API.";
const CORS_ERROR = "Your server blocked the sign-in from this page (CORS).";
const $ = (id) => document.getElementById(id);
const form = $("sign-in");
const input = $("account-input");
const submit = $("continue");
const status = $("status");
let settings = "";

function httpsUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

async function getJson(url, accept = "application/json") {
  const response = await fetch(url, {
    headers: { Accept: accept },
    credentials: "omit",
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
  try {
    const actor = await getJson(url, ACTOR_ACCEPT);
    const id = httpsUrl(actor?.id);
    if (id) return { actor, id };
  } catch {
    // The browser reports CORS and other network failures the same way.
  }
  throw new Error("Couldn't read this ActivityPub profile. Check the profile URL and make sure the site allows cross-origin requests.");
}

async function oauthEndpoints(actor, origin) {
  let authorize = httpsUrl(actor.endpoints?.oauthAuthorizationEndpoint);
  let token = httpsUrl(actor.endpoints?.oauthTokenEndpoint);
  if (authorize && token) return { authorize: authorize.href, token: token.href };

  const metadata = await getJson(new URL("/.well-known/oauth-authorization-server", origin))
    .catch(() => null);
  authorize = httpsUrl(metadata?.authorization_endpoint);
  token = httpsUrl(metadata?.token_endpoint);
  if (authorize && token) {
    return { authorize: authorize.href, token: token.href, issuer: httpsUrl(metadata.issuer)?.href };
  }
  throw new Error(API_OFF);
}

function actorSettings(actor) {
  const endpoints = {
    outbox: httpsUrl(actor.outbox)?.href,
    proxy: httpsUrl(actor.endpoints?.proxyUrl)?.href,
    followers: httpsUrl(actor.followers)?.href
  };
  for (const [key, url] of Object.entries(endpoints)) {
    if (!url) {
      const field = key === "proxy" ? "proxyUrl" : key;
      throw new Error(`The profile is missing an HTTPS ${field}. On WordPress, check Settings › ActivityPub › Advanced › ActivityPub API.`);
    }
  }
  return endpoints;
}

async function discover(value) {
  let profile = httpsUrl(value);
  let webfinger;
  if (!profile) {
    const account = parseHandle(value);
    if (!account || input.type === "url") {
      throw new Error("Enter a handle like you@example.org or an HTTPS profile URL.");
    }
    webfinger = new URL("/.well-known/webfinger", account.origin);
    webfinger.searchParams.set("resource", `acct:${account.handle}`);
    profile = await webfingerActor(webfinger).catch(() => null);
    if (!profile) {
      input.type = "url";
      input.value = "";
      input.placeholder = "https://example.org/author/you";
      $("account-label").textContent = "ActivityPub profile URL";
      input.focus();
      throw new Error(`Couldn't look up ${account.handle}. Enter your profile URL instead.`);
    }
  }

  const { actor, id } = await fetchActor(profile);
  if (!httpsUrl(actor.outbox)) actorSettings(actor);
  const oauth = await oauthEndpoints(actor, id.origin);
  actorSettings(actor);
  return { ...oauth, profile: profile.href, actor: id.href, webfinger: webfinger?.href };
}

async function clientIdentity() {
  const page = new URL("./", location.href);
  const client = new URL("client.json", page);
  if (!httpsUrl(page.href) || !crypto.subtle) {
    throw new Error("Open the published HTTPS page to sign in.");
  }
  const identity = await getJson(client).catch(() => null);
  if (identity?.client_id !== client.href ||
      !Array.isArray(identity.redirect_uris) ||
      !identity.redirect_uris.includes(page.href)) {
    throw new Error("The OAuth client identity doesn’t match this page. Check client.json and open the published HTTPS URL.");
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
  sessionStorage.setItem(SIGN_IN_KEY, JSON.stringify({ state, code_verifier, endpoints }));
  status.textContent = "Opening your server’s sign-in page…";
  location.assign(url.href);
}

function oauthMessage(error, description) {
  const detail = [error, description].filter((value) => typeof value === "string" && value).join(" — ");
  return detail ? `Sign-in failed. ${detail.slice(0, 500)}. Try again.` : "Sign-in failed. Try again.";
}

async function exchange(endpoint, params) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", ...params })
    });
  } catch {
    throw new Error(CORS_ERROR);
  }
  if (response.type === "opaqueredirect") {
    throw new Error("The token endpoint redirected the sign-in request. Ask your server administrator to check the advertised token URL.");
  }
  const result = await response.json().catch(() => null);
  if (result?.error) throw new Error(oauthMessage(result.error, result.error_description));
  if (response.status === 404) {
    throw new Error(`${API_OFF} If it is already on, ask your administrator to check the token URL and clear cached profile responses.`);
  }
  if (!response.ok || !result) {
    throw new Error(`The server couldn’t complete sign-in (HTTP ${response.status}). Try again.`);
  }
  return result;
}

async function completeSignIn(params) {
  const saved = sessionStorage.getItem(SIGN_IN_KEY);
  sessionStorage.removeItem(SIGN_IN_KEY);
  const pending = JSON.parse(saved);
  const states = params.getAll("state");
  if (!pending?.state || states.length !== 1 || states[0] !== pending.state) {
    throw new Error("This sign-in doesn’t match the one started in this tab. Try again.");
  }
  if (params.has("error")) throw new Error(oauthMessage(params.get("error"), params.get("error_description")));
  const codes = params.getAll("code");
  const { endpoints, code_verifier } = pending;
  const tokenEndpoint = httpsUrl(endpoints?.token);
  if (codes.length !== 1 || !codes[0] || !tokenEndpoint || !code_verifier ||
      (params.has("iss") && endpoints.issuer && httpsUrl(params.get("iss"))?.href !== endpoints.issuer)) {
    throw new Error("The server returned an incomplete or invalid sign-in. Try again.");
  }

  const client = await clientIdentity();
  const { actor, id } = await fetchActor(httpsUrl(endpoints.profile));
  if (id.href !== endpoints.actor) {
    throw new Error("The account profile changed during sign-in. Try again.");
  }
  const fields = actorSettings(actor);
  const handle = parseHandle(actor.webfinger)?.handle ||
    parseHandle(httpsUrl(endpoints.webfinger)?.searchParams.get("resource"))?.handle ||
    parseHandle(`${actor.preferredUsername || ""}@${id.hostname}`)?.handle;
  if (!handle) throw new Error("The profile didn’t include a handle. Check your WordPress ActivityPub profile.");

  const result = await exchange(tokenEndpoint, { ...client, code: codes[0], code_verifier });
  const authenticatedActor = result.activitypub_actor_id ?? result.me;
  if (authenticatedActor !== undefined && httpsUrl(authenticatedActor)?.href !== id.href) {
    throw new Error(`WordPress authorized a different profile. Try again and sign in as ${handle}.`);
  }
  const expiresIn = Number(result.expires_in);
  if (typeof result.access_token !== "string" || !result.access_token ||
      typeof result.refresh_token !== "string" || !result.refresh_token ||
      !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("The server didn’t return a renewable token. Check that the WordPress ActivityPub plugin is up to date and try again.");
  }
  showConnect({
    fedishare: 3,
    kind: "activitypub",
    handle,
    actor: id.href,
    ...fields,
    token: result.access_token,
    refresh_token: result.refresh_token,
    expires: Math.floor(Date.now() / 1000 + expiresIn),
    token_endpoint: tokenEndpoint.href,
    client_id: client.client_id
  }, id.host);
}

function restoreHandle() {
  try {
    const handle = parseHandle(localStorage.getItem(LAST_HANDLE_KEY));
    if (handle) {
      input.value = handle.handle;
      $("resume").hidden = false;
    }
  } catch {
    // Sign-in also works when browser storage is disabled.
  }
}

function showConnect(payload, server) {
  try {
    localStorage.setItem(LAST_HANDLE_KEY, payload.handle);
  } catch {
    // Remembering the handle is optional.
  }
  input.value = payload.handle;
  $("resume").hidden = false;
  form.hidden = false;
  settings = JSON.stringify(payload);
  $("account").textContent = `@${payload.handle} · ${server}`;
  $("connect").href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(settings)}`;
  const shortcut = httpsUrl(SHORTCUT_ICLOUD_URL);
  if (shortcut?.hostname === "www.icloud.com" && shortcut.pathname.startsWith("/shortcuts/")) {
    $("get-shortcut").href = shortcut.href;
    $("get-shortcut").removeAttribute("download");
    $("get-shortcut").target = "_blank";
    $("get-shortcut").rel = "noopener noreferrer";
  }
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  $("desktop").hidden = isIOS;
  status.textContent = "";
  $("connected").hidden = false;
  $("connected-title").focus();
}

function showError(error, callback = false) {
  status.textContent = "";
  $("error").textContent = error.message || "Something went wrong. Try again.";
  $("cors-help").hidden = error.message !== CORS_ERROR;
  $("retry").hidden = !callback;
  $("failure").hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submit.disabled = true;
  $("failure").hidden = true;
  status.textContent = "Looking up your account…";
  try {
    await authorize(input.value.trim());
  } catch (error) {
    showError(error);
    submit.disabled = false;
  }
});

$("retry").addEventListener("click", () => {
  $("failure").hidden = true;
  form.hidden = false;
  input.focus();
});

$("copy").addEventListener("click", async () => {
  if (!settings) return;
  try {
    await navigator.clipboard.writeText(settings);
    $("copy-status").textContent = "Settings copied.";
  } catch {
    $("copy-status").textContent = "Clipboard access was blocked. Allow clipboard access and try again.";
  }
});

window.addEventListener("pagehide", () => {
  submit.disabled = false;
  status.textContent = "";
  if (!settings) return;
  settings = "";
  $("connect").removeAttribute("href");
  $("connected").hidden = true;
  $("copy-status").textContent = "";
  restoreHandle();
  form.hidden = false;
});

restoreHandle();
const callback = new URL(location.href);
const oauthParams = ["code", "state", "error", "error_description", "error_uri", "iss"];
if (["code", "state", "error"].some((key) => callback.searchParams.has(key))) {
  const params = new URLSearchParams(callback.search);
  for (const key of oauthParams) callback.searchParams.delete(key);
  history.replaceState(null, "", callback.href);
  status.textContent = "Finishing sign-in…";
  completeSignIn(params).catch((error) => showError(error, true));
} else {
  form.hidden = false;
}
