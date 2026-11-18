"use strict";

const SCOPE = "read write";
const SIGN_IN_KEY = "fedishare.sign-in";
const STORE_KEY = `feditap.accounts:${new URL("./", location.href).pathname}`;
const AS_PROFILE = "https://www.w3.org/ns/activitystreams";
const PUBLIC = `${AS_PROFILE}#Public`;
const ACTIVITY_TYPE = `application/ld+json; profile="${AS_PROFILE}"`;
const ACTOR_TYPES = new Set(["Person", "Service", "Group", "Organization", "Application"]);
const ACTION_LABELS = new Map([
  ["like", "Like"], ["repost", "Repost"], ["reply", "Reply"], ["follow", "Follow request"]
]);
const ACTOR_ACCEPT = `application/activity+json, application/ld+json; profile="${AS_PROFILE}"`;
const API_OFF = "This server doesn't support the ActivityPub API. On WordPress, turn on Settings › ActivityPub › Advanced › ActivityPub API.";
const CORS_ERROR = "Your server blocked the sign-in from this page (CORS).";
const $ = (id) => document.getElementById(id);
const form = $("sign-in");
const input = $("account-input");
const targetInput = $("post-url");
const accountPicker = $("selected-account");
const accountManagement = $("manage-accounts");
const lookup = $("lookup");
const actionForm = $("action-form");
const controls = [$("account-picker"), $("sign-in-controls"), $("lookup-controls"), $("action-controls")];
let busy = false;
let resolved = null;

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
  try {
    const actor = await getJson(url, ACTOR_ACCEPT);
    const id = httpsUrl(actor?.id);
    if (id?.origin === url.origin) return { actor, id };
  } catch {
    // The browser reports CORS and other network failures the same way.
  }
  throw new Error("Couldn't verify this ActivityPub profile. Enter its canonical HTTPS URL and make sure the site allows cross-origin requests.");
}

async function oauthEndpoints(actor, origin) {
  const metadata = await getJson(new URL("/.well-known/oauth-authorization-server", origin))
    .catch(() => null);
  const advertisedIssuer = metadata?.issuer;
  const issuerUrl = homeEndpoint(advertisedIssuer, origin);
  if (advertisedIssuer !== undefined && (!issuerUrl || issuerUrl.search)) {
    throw new Error("The OAuth issuer doesn’t match your account’s server.");
  }
  const authorizeUrl = metadata?.authorization_endpoint ?? actor.endpoints?.oauthAuthorizationEndpoint;
  const tokenUrl = metadata?.token_endpoint ?? actor.endpoints?.oauthTokenEndpoint;
  if (!authorizeUrl || !tokenUrl) throw new Error(API_OFF);

  const authorize = homeEndpoint(authorizeUrl, origin);
  const token = homeEndpoint(tokenUrl, origin);
  if (!authorize || !token) {
    throw new Error("The authorization and token endpoints must use your account’s HTTPS origin.");
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
      throw new Error(`The profile is missing an HTTPS ${field}. On WordPress, check Settings › ActivityPub › Advanced › ActivityPub API.`);
    }
  }
  if (!homeEndpoint(endpoints.outbox, origin) || !homeEndpoint(endpoints.proxy, origin)) {
    throw new Error("The outbox and proxy must use your account’s HTTPS origin.");
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
      throw new Error("Enter a handle like you@example.com or an HTTPS profile URL.");
    }
    webfinger = new URL("/.well-known/webfinger", account.origin);
    webfinger.searchParams.set("resource", `acct:${account.handle}`);
    profile = await webfingerActor(webfinger).catch(() => null);
    if (!profile) {
      input.type = "url";
      input.value = "";
      $("account-label").textContent = "ActivityPub profile URL";
      input.placeholder = "https://…";
      input.focus();
      throw new Error(`Couldn't look up ${account.handle}. Enter your profile URL instead.`);
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
  const target = httpsUrl(targetInput.value.trim())?.href;
  sessionStorage.setItem(SIGN_IN_KEY, JSON.stringify({ state, code_verifier, endpoints, target }));
  location.assign(url.href);
  return "Opening your server’s sign-in page…";
}

function oauthMessage(error, description) {
  const detail = [error, description].filter((value) => typeof value === "string" && value).join(" — ");
  return detail ? `Sign-in failed. ${detail.slice(0, 500)}. Try again.` : "Sign-in failed. Try again.";
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
  } catch {
    throw new Error(CORS_ERROR);
  }
  if (response.type === "opaqueredirect") {
    throw new Error("The token endpoint redirected the sign-in request. Ask your server administrator to check the advertised token URL.");
  }
  return { response, result: await response.json().catch(() => null) };
}

async function exchange(endpoint, params) {
  const { response, result } = await requestToken(endpoint, { grant_type: "authorization_code", ...params });
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
  const target = httpsUrl(pending.target);
  if (target) setTarget(target);
  if (params.has("error")) throw new Error(oauthMessage(params.get("error"), params.get("error_description")));
  const codes = params.getAll("code");
  const { endpoints, code_verifier } = pending;
  const origin = httpsUrl(endpoints?.actor)?.origin;
  const profile = httpsUrl(endpoints?.profile);
  const tokenEndpoint = homeEndpoint(endpoints?.token, origin);
  if (codes.length !== 1 || !codes[0] || !profile || profile.origin !== origin || !tokenEndpoint ||
      !homeEndpoint(endpoints.authorize, origin) || !code_verifier) {
    throw new Error("The server returned an incomplete or invalid sign-in. Try again.");
  }
  const issuers = params.getAll("iss");
  if ((endpoints.requireIssuer || issuers.length) &&
      (issuers.length !== 1 || issuers[0] !== (endpoints.issuer ?? origin))) {
    throw new Error("The sign-in response didn’t match your server’s OAuth issuer. Try again.");
  }

  const client = await clientIdentity();
  const { actor, id } = await fetchActor(profile);
  if (id.href !== endpoints.actor) {
    throw new Error("The account profile changed during sign-in. Try again.");
  }
  const fields = actorSettings(actor, origin);
  const handle = parseHandle(actor.webfinger)?.handle ||
    parseHandle(httpsUrl(endpoints.webfinger)?.searchParams.get("resource"))?.handle ||
    parseHandle(`${actor.preferredUsername || ""}@${id.hostname}`)?.handle;
  if (!handle) throw new Error("The profile didn’t include a handle. Check your WordPress ActivityPub profile.");

  const result = await exchange(tokenEndpoint, { ...client, code: codes[0], code_verifier });
  const authenticatedActor = result.activitypub_actor_id ?? result.me;
  if (authenticatedActor !== undefined && httpsUrl(authenticatedActor)?.href !== id.href) {
    throw new Error(`WordPress authorized a different profile. Try again and sign in as ${handle}.`);
  }
  const credentials = renewableCredentials(result);
  if (!credentials) {
    throw new Error("The server didn’t return a renewable token. Check that the WordPress ActivityPub plugin is up to date and try again.");
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
  renderAccounts();
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

function renderAccounts() {
  const store = readStore();
  const accounts = Object.values(store.accounts);
  const selected = accounts.find((account) => account.actor === store.selectedActorId) ?? accounts[0];
  accountPicker.replaceChildren(...accounts.map((account) => new Option(
    `@${account.handle}${account.needsReauth ? " (sign in again)" : ""}`,
    account.actor
  )));
  accountPicker.value = selected?.actor ?? "";
  $("account-picker").hidden = !selected;
  $("fediverse-actions").hidden = !selected;
  showAccountManagement(Boolean(selected?.needsReauth) || accountManagement.getAttribute("aria-expanded") === "true");
  updateSharedLinkNotice();
  return selected;
}

function showAccountManagement(open) {
  const hasAccount = Boolean(accountPicker.value);
  accountManagement.setAttribute("aria-expanded", String(hasAccount && open));
  form.hidden = hasAccount && !open;
  $("forget").hidden = !hasAccount;
}

function requireReconnect(store, account) {
  delete account.token;
  delete account.refresh_token;
  delete account.expires;
  account.needsReauth = true;
  saveStore(store);
  throw new Error(`Sign in again to use @${account.handle}.`);
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
    throw new Error(`Your server couldn’t refresh the sign-in (HTTP ${response.status}).`);
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
    if (account.needsReauth) throw new Error(`Sign in again to use @${account.handle}.`);
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
  } catch {
    throw new Error("Couldn’t reach your server. Check its CORS settings and your connection.");
  }
}

function activityId(value) {
  return httpsUrl(typeof value === "string" ? value : value?.id)?.href;
}

async function resolveTarget(account, target, refresh) {
  const body = new URLSearchParams({ id: target });
  let response = await activityRequest(account, account.proxy, body);
  if (response.status === 401) {
    await refresh();
    response = await activityRequest(account, account.proxy, body);
  }
  if (!response.ok) {
    throw new Error(`Your server couldn’t resolve this Fediverse link (HTTP ${response.status}).`);
  }
  const object = await response.json().catch(() => null);
  const id = activityId(object);
  const types = Array.isArray(object?.type) ? object.type : [object?.type];
  const isActor = types.some((type) => ACTOR_TYPES.has(type));
  const authors = Array.isArray(object?.attributedTo) ? object.attributedTo : [object?.attributedTo];
  const author = isActor ? id : authors.map(activityId).find(Boolean);
  if (!id || !types.some((type) => typeof type === "string" && type) || !author) {
    throw new Error("Your server did not return an ActivityPub profile or post with an HTTPS author URL.");
  }
  return { id, author, isActor };
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

async function sendActivity(account, action, target, reply, refresh) {
  const body = JSON.stringify(makeActivity(action, target, account, reply));
  const response = await activityRequest(account, account.outbox, body, ACTIVITY_TYPE);
  if (response.status === 401) {
    await refresh();
    throw new Error("Your sign-in was refreshed. Choose the action again to send it.");
  }
  if (!response.ok) throw new Error(`Your server rejected the activity (HTTP ${response.status}).`);
}

function setTarget(target) {
  const url = new URL(location.href);
  url.searchParams.set("url", target.href);
  if (url.hash.startsWith("#url=")) url.hash = "";
  history.replaceState(null, "", url);
  targetInput.value = target.href;
  updateSharedLinkNotice();
}

function updateSharedLinkNotice() {
  $("shared-link-notice").hidden = Boolean(accountPicker.value) || !targetInput.value;
}

function readLegacyTarget() {
  if (!location.hash.startsWith("#url=")) return null;
  return httpsUrl(new URLSearchParams(location.hash.slice(1)).get("url"));
}

function resetPreview() {
  resolved = null;
  actionForm.hidden = true;
  $("reply").hidden = true;
  $("write-reply").setAttribute("aria-expanded", "false");
  $("reply-text").value = "";
}

function showPreview(object) {
  resolved = object;
  const link = $("target-link");
  link.href = object.id;
  link.textContent = `${object.isActor ? "Profile" : "Post"} on ${new URL(object.id).hostname}`;
  for (const button of actionForm.querySelectorAll("[value=like], [value=repost], #write-reply")) {
    button.hidden = object.isActor;
  }
  actionForm.querySelector("[value=follow]").textContent = object.isActor ? "Follow" : "Follow author";
  actionForm.hidden = false;
}

async function runTask(section, message, task) {
  if (busy) return false;
  const auth = section === "auth";
  const status = $(auth ? "status" : "action-status");
  const error = $(auth ? "error" : "action-error");
  busy = true;
  for (const fieldset of controls) fieldset.disabled = true;
  status.textContent = message;
  error.textContent = "";
  $("cors-help").hidden = true;
  try {
    status.textContent = await task() ?? "";
    return true;
  } catch (failure) {
    status.textContent = "";
    error.textContent = failure.message;
    $("cors-help").hidden = !failure.message.includes("CORS");
    const previous = accountPicker.value;
    try {
      const selected = renderAccounts();
      if (selected?.needsReauth) input.value = selected.handle;
      if (selected?.needsReauth || previous !== accountPicker.value) resetPreview();
    } catch {
      resetPreview();
    }
    return false;
  } finally {
    busy = false;
    for (const fieldset of controls) fieldset.disabled = false;
  }
}

async function findTarget(focusResult = false) {
  if (busy) return;
  resetPreview();
  const target = httpsUrl(targetInput.value.trim());
  if (!target || !accountPicker.value) {
    $("action-status").textContent = "";
    $("action-error").textContent = target ? "Connect a Fediverse account first." : "Enter an HTTPS post or profile URL.";
    (target ? input : targetInput).focus();
    return;
  }
  setTarget(target);
  const actorId = accountPicker.value;
  const found = await runTask("actions", "Looking up the link…", async () => {
    const object = await withAccount(actorId, (account, refresh) => resolveTarget(account, target.href, refresh));
    if (accountPicker.value !== actorId || targetInput.value !== target.href) return;
    showPreview(object);
  });
  if (found && resolved && focusResult) $("target-link").focus();
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
    if (busy || !accountPicker.value || targetInput.value !== previous) return;
    $("action-status").textContent = "";
    $("action-error").textContent = "Clipboard access is unavailable. Paste the link into the URL field.";
    targetInput.focus();
    return;
  }
  if (busy || !accountPicker.value || targetInput.value !== previous) return;
  const target = httpsUrl(copied.trim());
  if (!target) {
    $("action-status").textContent = "";
    $("action-error").textContent = "Copy an HTTPS post or profile link, then try Paste again.";
    return;
  }
  targetInput.value = target.href;
  targetInput.dispatchEvent(new Event("input", { bubbles: true }));
  $("action-status").textContent = "Link pasted.";
  $("find-link").focus();
});

accountManagement.addEventListener("click", () => {
  showAccountManagement(accountManagement.getAttribute("aria-expanded") !== "true");
});

targetInput.addEventListener("input", () => {
  resetPreview();
  $("action-status").textContent = "";
  $("action-error").textContent = "";
  const url = new URL(location.href);
  if (url.searchParams.has("url") || url.hash.startsWith("#url=")) {
    url.searchParams.delete("url");
    if (url.hash.startsWith("#url=")) url.hash = "";
    history.replaceState(null, "", url);
  }
});

$("write-reply").addEventListener("click", () => {
  $("reply").hidden = false;
  $("write-reply").setAttribute("aria-expanded", "true");
  $("reply-text").focus();
});

actionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const action = event.submitter?.value;
  const label = ACTION_LABELS.get(action);
  if (!label || !resolved || busy) return;
  const actorId = accountPicker.value;
  const object = resolved;
  const reply = $("reply-text").value.trim();
  void runTask("actions", "Sending to your server…", async () => {
    await withAccount(actorId, (account, refresh) => sendActivity(account, action, object, reply, refresh));
    if (action === "reply") $("reply-text").value = "";
    return `${label} sent.`;
  });
});

accountPicker.addEventListener("change", async () => {
  const actorId = accountPicker.value;
  resetPreview();
  const selected = await runTask("auth", "", async () => {
    await useStore((store) => {
      if (!store.accounts[actorId]) throw new Error("That account was removed in another tab.");
      store.selectedActorId = actorId;
      saveStore(store);
    });
    renderAccounts();
  });
  if (selected && targetInput.value) await findTarget();
});

$("forget").addEventListener("click", async () => {
  const actorId = accountPicker.value;
  resetPreview();
  const removed = await runTask("auth", "", async () => {
    await useStore((store) => {
      delete store.accounts[actorId];
      if (store.selectedActorId === actorId) {
        store.selectedActorId = Object.keys(store.accounts)[0] ?? null;
      }
      saveStore(store);
    });
    renderAccounts();
    showAccountManagement(false);
    return "Account removed from this browser.";
  });
  if (removed) (accountPicker.value ? accountManagement : input).focus();
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORE_KEY && event.key !== null) return;
  const previous = accountPicker.value;
  try {
    const selected = renderAccounts();
    if (previous !== accountPicker.value || selected?.needsReauth) resetPreview();
  } catch (error) {
    resetPreview();
    $("action-error").textContent = error.message;
  }
});

window.addEventListener("hashchange", () => {
  const target = readLegacyTarget();
  if (!target) return;
  setTarget(target);
  resetPreview();
  if (accountPicker.value) void findTarget();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
  await runTask("auth", "Looking up your account…", () => authorize(input.value.trim()));
  if (input.hasAttribute("aria-invalid") || input.type === "url") input.focus();
});

input.addEventListener("input", () => {
  if (!input.hasAttribute("aria-invalid")) return;
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
  $("error").textContent = "";
});

async function start() {
  if (!navigator.locks || !AbortSignal.timeout) {
    throw new Error("Open the HTTPS page in a current browser to connect an account.");
  }
  renderAccounts();
  $("setup-unavailable").hidden = true;
  for (const fieldset of controls) fieldset.disabled = false;

  const callback = new URL(location.href);
  const shared = callback.searchParams.has("url")
    ? httpsUrl(callback.searchParams.get("url"))
    : readLegacyTarget();
  const oauthParams = ["code", "state", "error", "error_description", "error_uri", "iss"];
  const params = ["code", "state", "error"].some((key) => callback.searchParams.has(key))
    ? new URLSearchParams(callback.search)
    : null;
  if (params) {
    for (const key of oauthParams) callback.searchParams.delete(key);
    history.replaceState(null, "", callback.href);
  }
  if (shared) setTarget(shared);
  if (params) {
    const signedIn = await runTask("auth", "Finishing sign-in…", async () => {
      await completeSignIn(params);
      showAccountManagement(false);
      input.value = "";
      input.type = "text";
      input.placeholder = "you@example.com";
      $("account-label").textContent = "Fediverse handle or profile URL";
      return "Account connected.";
    });
    if (!signedIn) return;
  }
  if (targetInput.value && accountPicker.value) await findTarget();
}

void start().catch((error) => {
  $("error").textContent = error.message;
});
