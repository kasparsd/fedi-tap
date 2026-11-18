// Local dev server: serves the static app over HTTPS and fakes an ActivityPub
// server with an OAuth 2.0 (PKCE) provider on the same origin.
//
//   npm run dev            # https://localhost:8443/_dev/
//   PORT=9000 DELAY_MS=1500 npm run dev
//
// The app only works over HTTPS and checks client.json against the page URL,
// so this server serves a generated client.json for whatever origin it runs on.
// Nothing here is used in production.

import { createServer } from "node:https";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PORT = Number(process.env.PORT || 8443);
const DELAY_MS = Number(process.env.DELAY_MS ?? 400);
const ORIGIN = `https://localhost:${PORT}`;
const AS2 = "https://www.w3.org/ns/activitystreams";

// ---- Fixtures -------------------------------------------------------------

// Each account is a "server user". `tokenSeconds` and `quirk` exercise token
// refresh and error paths in the app.
const USERS = {
  alice: { name: "Alice Example", about: "Normal account. Everything works." },
  shorty: { name: "Shorty", about: "Access token lives 61 s: every action refreshes first.", tokenSeconds: 61 },
  flaky: { name: "Flaky", about: "First access token is rejected with 401: tests refresh and retry.", quirk: "flaky" },
  erin: { name: "Erin (revoked)", about: "Refresh fails with invalid_grant: tests 'sign in again'.", quirk: "revoked", tokenSeconds: 61 },
  mismatch: { name: "Mismatch", about: "Authorizes as a different profile: tests identity check.", quirk: "mismatch" }
};

const actorId = (name) => `${ORIGIN}/users/${name}`;
const AUTHORS = {
  alice: { id: actorId("alice"), name: "Alice Example" },
  shorty: { id: actorId("shorty"), name: "Shorty" },
  flaky: { id: actorId("flaky"), name: "Flaky" },
  erin: { id: actorId("erin"), name: "Erin" },
  mismatch: { id: actorId("mismatch"), name: "Mismatch" },
  // Remote authors the signed-in account can interact with.
  zed: { id: `${ORIGIN}/users/zed`, name: "Zed Remote", summary: "A profile you can follow." },
  dana: { id: `${ORIGIN}/users/dana`, name: "Dana Writer" }
};

const NOTES = {
  1: { author: "dana", content: "<p>Just shipped a tiny share sheet shortcut for the Fediverse. It stays out of the way until you need it.</p>" },
  2: { author: "zed", content: "<p>A longer post to see how the card truncates. ".repeat(1) + "Progressive disclosure means the first screen shows only what matters, and the rest waits behind a tap. Details live in sheets, destructive actions ask first, and the main task never moves. </p><p>Second paragraph with <a href=\"https://example.com\">a link</a> and some <strong>markup</strong> that must render as plain text.</p>" },
  3: { author: "dana", content: "<p>Reply target: a short post.</p>" }
};

const TARGET_ALIASES = {
  // Realistic-looking URLs that resolve to fixtures, as a remote server would.
  "https://social.example/@dana/1": { type: "note", key: 1 },
  "https://social.example/@zed/2": { type: "note", key: 2 },
  "https://social.example/@zed": { type: "actor", key: "zed" }
};

function noteObject(key) {
  const note = NOTES[key];
  const author = AUTHORS[note.author];
  return {
    "@context": AS2,
    id: `${ORIGIN}/notes/${key}`,
    type: "Note",
    attributedTo: author.id,
    content: note.content,
    published: "2026-11-17T09:30:00Z",
    url: `https://social.example/@${note.author}/${key}`
  };
}

function actorObject(name, { forLogin = false } = {}) {
  const author = AUTHORS[name];
  const base = {
    "@context": AS2,
    id: author.id,
    type: "Person",
    preferredUsername: name,
    name: author.name,
    summary: author.summary,
    url: author.id
  };
  if (!forLogin) return base;
  return {
    ...base,
    webfinger: `${name}@localhost`,
    inbox: `${author.id}/inbox`,
    outbox: `${author.id}/outbox`,
    followers: `${author.id}/followers`,
    endpoints: {
      proxyUrl: `${ORIGIN}/proxy`,
      ...(flags.apiOff ? {} : {
        oauthAuthorizationEndpoint: `${ORIGIN}/oauth/authorize`,
        oauthTokenEndpoint: `${ORIGIN}/oauth/token`
      })
    }
  };
}

function resolveTarget(id) {
  const alias = TARGET_ALIASES[id];
  if (alias?.type === "note") return noteObject(alias.key);
  if (alias?.type === "actor") return actorObject(alias.key);
  const note = new RegExp(`^${ORIGIN}/notes/(\\d+)$`).exec(id);
  if (note && NOTES[note[1]]) return noteObject(note[1]);
  const actor = new RegExp(`^${ORIGIN}/users/([a-z]+)$`).exec(id);
  if (actor && AUTHORS[actor[1]]) return actorObject(actor[1]);
  return null;
}

// ---- State ----------------------------------------------------------------

const codes = new Map(); // code -> { user, challenge, redirect, state }
const accessTokens = new Map(); // token -> { user, expires, dead }
const refreshTokens = new Map(); // token -> user
const flakyIssued = new Set();
const activities = [];
const flags = { apiOff: false }; // toggled from /_dev/: hides OAuth endpoints like a server with the API disabled

const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const random = () => randomBytes(24).toString("base64url");

function issueTokens(user) {
  const def = USERS[user];
  const access = random();
  const refresh = random();
  const seconds = def.tokenSeconds ?? 3600;
  // The flaky account's very first access token is dead on arrival.
  const dead = def.quirk === "flaky" && !flakyIssued.has(user);
  if (dead) flakyIssued.add(user);
  accessTokens.set(access, { user, expires: Date.now() + seconds * 1000, dead });
  refreshTokens.set(refresh, user);
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: seconds, scope: "read write" };
}

// ---- HTTP helpers ---------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".md": "text/markdown; charset=utf-8",
  ".shortcut": "application/octet-stream", ".png": "image/png", ".svg": "image/svg+xml"
};

function send(res, status, body, type = "application/json", extra = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "Location",
    ...extra
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function bearer(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  const record = match && accessTokens.get(match[1]);
  if (!record || record.dead || record.expires <= Date.now()) return null;
  return record;
}

function page(title, body) {
  return `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>${title}</title><style>
:root{color-scheme:light dark;font:16px/1.5 -apple-system,system-ui,sans-serif}
body{max-width:34rem;margin:0 auto;padding:1.5rem 1rem 4rem}
button,select{font:inherit;padding:.6rem .9rem;border-radius:.5rem;border:1px solid #8886;margin:.25rem .25rem .25rem 0}
button.primary{background:#007aff;color:#fff;border-color:#007aff}
code{background:#8882;padding:.1rem .3rem;border-radius:.25rem}
li{margin:.4rem 0} small{opacity:.7} .tag{font-size:.75rem;background:#8882;border-radius:1rem;padding:.1rem .5rem}
</style>${body}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Routes ---------------------------------------------------------------

function devIndex() {
  const users = Object.entries(USERS).map(([name, def]) =>
    `<li><code>${ORIGIN}/users/${name}</code><br><small>${esc(def.about)}</small></li>`).join("");
  const share = (url) => `/?url=${encodeURIComponent(url)}`;
  const links = [
    ["Shared post (Dana)", share(`${ORIGIN}/notes/1`)],
    ["Shared long post (Zed)", share(`${ORIGIN}/notes/2`)],
    ["Shared remote-style post URL", share("https://social.example/@dana/1")],
    ["Shared profile", share(`${ORIGIN}/users/zed`)],
    ["Shared missing post (404)", share(`${ORIGIN}/notes/404`)],
    ["Legacy #url= link", `/#url=${encodeURIComponent(`${ORIGIN}/notes/1`)}`],
    ["No link", "/"]
  ].map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join("");
  return page("FediTap dev", `<h1>FediTap dev server</h1>
<p>Mock ActivityPub + OAuth on <code>${ORIGIN}</code>. Sign in by entering one of these <b>profile URLs</b>:</p>
<ul>${users}</ul>
<p>Or enter <code>alice@localhost</code> to see the WebFinger fallback (the mock has no WebFinger on port 443).</p>
<h2>Open the app</h2><ul>${links}</ul>
<h2>Tools</h2><ul>
<li><a href="/_dev/activities">Received activities (JSON)</a></li>
<li><form method=post action="/_dev/api-off"><button>${flags.apiOff ? "API is OFF: turn on" : "API is on: turn off"}</button></form><small>Simulates a server without the ActivityPub API.</small></li>
<li><form method=post action="/_dev/reset"><button>Reset server state</button></form></li>
<li><a href="/docs/ux/mocks.html">UX mocks</a></li></ul>
<p><small>Response delay: ${DELAY_MS} ms (set DELAY_MS). Clear the app's saved accounts by removing them in the app or clearing site data.</small></p>`);
}

function authorizePage(url) {
  const q = url.searchParams;
  const options = Object.entries(USERS).map(([name]) => `<option value="${name}">${name}</option>`).join("");
  const hidden = ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "response_type"]
    .map((key) => `<input type=hidden name="${key}" value="${esc(q.get(key) ?? "")}">`).join("");
  return page("Authorize", `<h1>Authorize FediTap</h1>
<p><code>${esc(q.get("client_id"))}</code> wants to act on your behalf.</p>
<p>Scope: <span class=tag>${esc(q.get("scope"))}</span></p>
<form method=post action="/oauth/decision">${hidden}
<p><label>Sign in as <select name=user>${options}</select></label></p>
<button class=primary name=decision value=approve>Authorize</button>
<button name=decision value=deny>Deny</button></form>
<p><small>Mock server page. Pick the account that approves the request.</small></p>`);
}

async function route(req, res) {
  const url = new URL(req.url, ORIGIN);
  const path = url.pathname;
  log(req.method, path + url.search.slice(0, 80));
  if (req.method === "OPTIONS") return send(res, 204, "");

  // Dev tools
  if (path === "/_dev" || path === "/_dev/") return send(res, 200, devIndex(), "text/html; charset=utf-8");
  if (path === "/_dev/activities") return send(res, 200, activities);
  if (path === "/_dev/reset" && req.method === "POST") {
    for (const store of [codes, accessTokens, refreshTokens, flakyIssued]) store.clear();
    activities.length = 0;
    flags.apiOff = false;
    return send(res, 303, "", "text/plain", { Location: "/_dev/" });
  }

  // Client identity matches whatever origin this server runs on.
  if (path === "/client.json") {
    return send(res, 200, {
      client_id: `${ORIGIN}/client.json`,
      client_name: "FediTap (dev)",
      client_uri: `${ORIGIN}/`,
      redirect_uris: [`${ORIGIN}/`],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "read write"
    });
  }

  // ActivityPub actors
  const userMatch = /^\/users\/([a-z]+)$/.exec(path);
  if (userMatch && AUTHORS[userMatch[1]]) {
    return send(res, 200, actorObject(userMatch[1], { forLogin: Boolean(USERS[userMatch[1]]) }), `application/activity+json`);
  }

  if (path === "/_dev/api-off" && req.method === "POST") {
    flags.apiOff = !flags.apiOff;
    return send(res, 303, "", "text/plain", { Location: "/_dev/" });
  }

  if (path === "/.well-known/oauth-authorization-server") {
    if (flags.apiOff) return send(res, 404, { error: "not_found" });
    return send(res, 200, {
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/oauth/token`,
      authorization_response_iss_parameter_supported: true,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"]
    });
  }

  if (path === "/oauth/authorize") return send(res, 200, authorizePage(url), "text/html; charset=utf-8");

  if (path === "/oauth/decision" && req.method === "POST") {
    const form = new URLSearchParams(await readBody(req));
    const redirect = form.get("redirect_uri");
    if (redirect !== `${ORIGIN}/` || form.get("client_id") !== `${ORIGIN}/client.json`) {
      return send(res, 400, page("Error", "<p>Invalid client or redirect URI.</p>"), "text/html; charset=utf-8");
    }
    const back = new URL(redirect);
    if (form.get("decision") !== "approve") {
      back.searchParams.set("error", "access_denied");
      back.searchParams.set("error_description", "The user denied the request.");
    } else {
      const code = random();
      codes.set(code, { user: form.get("user"), challenge: form.get("code_challenge"), redirect });
      back.searchParams.set("code", code);
    }
    back.searchParams.set("state", form.get("state"));
    back.searchParams.set("iss", ORIGIN);
    return send(res, 302, "", "text/plain", { Location: back.href });
  }

  if (path === "/oauth/token" && req.method === "POST") {
    await sleep(DELAY_MS);
    const form = new URLSearchParams(await readBody(req));
    const grant = form.get("grant_type");
    if (grant === "authorization_code") {
      const entry = codes.get(form.get("code"));
      codes.delete(form.get("code"));
      const challenge = createHash("sha256").update(form.get("code_verifier") || "").digest("base64url");
      if (!entry || entry.challenge !== challenge || entry.redirect !== form.get("redirect_uri")) {
        return send(res, 400, { error: "invalid_grant", error_description: "Bad code or PKCE verifier." });
      }
      const shown = USERS[entry.user].quirk === "mismatch" ? "dana" : entry.user;
      return send(res, 200, { ...issueTokens(entry.user), activitypub_actor_id: actorId(shown) });
    }
    if (grant === "refresh_token") {
      const user = refreshTokens.get(form.get("refresh_token"));
      if (!user || USERS[user].quirk === "revoked") {
        return send(res, 400, { error: "invalid_grant", error_description: "The refresh token was revoked." });
      }
      refreshTokens.delete(form.get("refresh_token"));
      return send(res, 200, issueTokens(user));
    }
    return send(res, 400, { error: "unsupported_grant_type" });
  }

  if (path === "/proxy" && req.method === "POST") {
    await sleep(DELAY_MS);
    if (!bearer(req)) return send(res, 401, { error: "invalid_token" });
    const id = new URLSearchParams(await readBody(req)).get("id");
    const object = resolveTarget(id);
    return object
      ? send(res, 200, object, "application/activity+json")
      : send(res, 404, { error: "not_found" });
  }

  const outbox = /^\/users\/([a-z]+)\/outbox$/.exec(path);
  if (outbox && req.method === "POST") {
    await sleep(DELAY_MS);
    const token = bearer(req);
    if (!token) return send(res, 401, { error: "invalid_token" });
    const activity = JSON.parse((await readBody(req)) || "null");
    const id = `${ORIGIN}/activities/${activities.length + 1}`;
    activities.push({ id, by: token.user, ...activity });
    log("  activity", activity?.type, "by", token.user);
    return send(res, 201, "", "text/plain", { Location: id });
  }

  // Static files
  const file = normalize(join(ROOT, path === "/" ? "index.html" : path));
  if (!file.startsWith(ROOT) || /\/\.|node_modules|\/\.local/.test(file) || !existsSync(file)) {
    return send(res, 404, "Not found", "text/plain");
  }
  try {
    return send(res, 200, readFileSync(file), MIME[extname(file)] ?? "application/octet-stream");
  } catch {
    return send(res, 404, "Not found", "text/plain");
  }
}

// ---- TLS ------------------------------------------------------------------

function certificate() {
  const dir = join(ROOT, ".local", "dev-certs");
  const cert = join(dir, "localhost.pem");
  const key = join(dir, "localhost-key.pem");
  if (!existsSync(cert)) {
    mkdirSync(dir, { recursive: true });
    try {
      execFileSync("mkcert", ["-cert-file", cert, "-key-file", key, "localhost", "127.0.0.1", "::1"], { stdio: "ignore" });
    } catch {
      console.error("mkcert not found or failed; using a self-signed certificate. Your browser will warn about it.");
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30", "-keyout", key,
        "-out", cert, "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { stdio: "ignore" });
    }
  }
  return { cert: readFileSync(cert), key: readFileSync(key) };
}

createServer(certificate(), (req, res) => {
  route(req, res).catch((error) => {
    log("error", error);
    send(res, 500, { error: "server_error" });
  });
}).listen(PORT, () => {
  console.log(`FediTap dev server: ${ORIGIN}/_dev/`);
});
