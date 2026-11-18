# FediTap development

## Hosting

Publish the root of the `main` branch of `kasparsd/fedi-tap` using **Settings › Pages › Deploy from a branch**. The published directory should be `https://kasparsd.github.io/fedi-tap/`. GitHub Pages serves the checked-in `index.html`, `app.js`, `client.json`, and signed `FediTap.shortcut` directly. [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

For a different permanent URL, update `client_id`, `client_uri`, and `redirect_uris` in `client.json` together, and update `page` in `FediTap.cherri` before signing another copy. The client ID must match the exact HTTPS URL that serves `client.json`. The redirect URI must match the setup page URL, including its trailing slash. Once people connect, keep both URLs stable. Verify that `client.json` returns HTTP 200 with `Content-Type: application/json`.

After editing `app.js`, update its script integrity attribute and Content Security Policy hash in `index.html` from the repository root. Hosting requires no build step.

```sh
node --input-type=module <<'JS'
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const hash = 'sha256-' + createHash('sha256').update(readFileSync('app.js')).digest('base64');
const updated = html
  .replace(/script-src 'sha256-[^']+'/, "script-src '" + hash + "'")
  .replace(/(src="app\.js" integrity=")sha256-[^"]+"/, '$1' + hash + '"');
writeFileSync('index.html', updated);
JS
```

## ActivityPub compatibility

FediTap uses the client-to-server ActivityPub API described in the [Social API Basic Profile draft](https://swicg.github.io/activitypub-api/basicprofile). The setup flow requires CIMD, OAuth authorization code with PKCE S256, the `read write` scopes, and renewable tokens. The actor must expose its outbox, followers collection, and object proxy. ActivityPub for WordPress is the tested implementation.

Use the canonical HTTPS profile URL. The actor ID, OAuth authorization and token endpoints, proxy, and outbox must share the profile’s origin. FediTap uses authorization server metadata when available and verifies the callback issuer when the server advertises issuer support or returns an issuer.

## Local dev server with a mock OAuth server

```bash
npm run dev
```

Opens `https://localhost:8443/_dev/`. The app only runs over HTTPS and checks `client.json` against the page URL, so the server uses HTTPS (a certificate from [mkcert](https://github.com/FiloSottile/mkcert) if installed, otherwise self-signed) and serves a generated `client.json` for its own origin. It also fakes an ActivityPub server and an OAuth 2.0 PKCE provider on the same origin, so the whole flow works offline without a real account.

Sign in with a profile URL on the dev index page. Each user exercises a path:

| User | Behavior |
|------|----------|
| `alice` | Everything works |
| `shorty` | Access token lasts 61 s, so each action refreshes first |
| `flaky` | First access token is rejected with 401 (refresh and retry) |
| `erin` | Refresh fails with `invalid_grant` (sign in again) |
| `mismatch` | Authorizes as a different profile (identity check) |

The index also has a toggle that simulates a server with the API turned off, sample shared-link URLs (post, long post, profile, missing post, legacy `#url=`), a reset button and a JSON list of activities the mock server received at `/_dev/activities`. `alice@localhost` demonstrates the WebFinger fallback because the mock cannot listen on port 443. Set `PORT` or `DELAY_MS` to change the port or response delay. The server is for development only and never ships.

### Pinned Node and Docker

Tooling targets Node 24 (`.nvmrc`, `engines` in `package.json`). The app itself is static and has no dependencies. To avoid installing Node, run the same server in a container:

```bash
npm run certs        # once, on the host (needs mkcert); creates .local/dev-certs
docker compose up    # https://localhost:8443/_dev/
```

The container binds the repo, so edits show on reload, and publishes the port on `127.0.0.1` only. Use the host's mkcert certificate: a certificate made inside the container is not trusted by your browser, and the page needs a trusted HTTPS origin to work. If `.local/dev-certs` is missing the container falls back to a self-signed certificate and the browser shows a warning. Set `PORT` (and `DELAY_MS`) in the environment; the port is part of the OAuth client ID, so it must be the same on both sides. Building the Shortcut (`./build-shortcut.sh`) needs Cherri and Apple's Shortcuts command, so it only runs on a Mac and is not part of the container.

## Test the WordPress flow

1. Open the published page and sign in with a test account. Try both a Fediverse handle and an HTTPS actor URL. Confirm the callback clears the OAuth code and state from the address bar.
2. Paste a post URL and test the four actions. A profile URL should offer only **Follow**. Reload the page and check that the selected account is remembered.
3. Connect a second account. Switch accounts, verify the next action is sent as that account, then remove one account and check that the other still works.
4. With a disposable account, expire the saved access token by setting its `expires` field in browser storage to a past time. Open the same link in two tabs and verify that refresh rotation preserves both sessions. Revoke access on the server and check that FediTap asks you to sign in again when the grant can no longer be refreshed.
5. Install the shortcut on an iPhone, share a Fediverse link, and verify that the browser receives the URL and retains it through sign-in. A successful sign-in can resolve the link, but publishing always requires choosing an action.

### CORS

The browser must be able to read responses from WebFinger, the actor URL, OAuth discovery when needed, the token endpoint, the proxy, and the outbox. Proxy and outbox preflights need to allow POST with `Authorization` and `Content-Type`. If WebFinger is blocked, enter the HTTPS actor URL. If a token request is blocked, ask the WordPress or reverse-proxy administrator to allow the page origin on the advertised token route. The browser reports some network and TLS failures the same way as CORS.

Use the page’s origin (scheme and host, without its path) and the token URL advertised by the actor. Check the actual POST as well as OPTIONS. A credential-free POST to a working token route should return an OAuth error with a CORS header.

```sh
ORIGIN=https://kasparsd.github.io
TOKEN=https://kaspars.net/wp-json/activitypub/1.0/oauth/token

curl -sS -D - -o /dev/null -H "Origin: $ORIGIN" \
  'https://kaspars.net/.well-known/webfinger?resource=acct%3Akaspars%40kaspars.net'
curl -sS -D - -o /dev/null -H "Origin: $ORIGIN" \
  -H 'Accept: application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"' \
  https://kaspars.net/blog/author/kaspars
curl -sS -i -X OPTIONS -H "Origin: $ORIGIN" \
  -H 'Access-Control-Request-Method: POST' "$TOKEN"
curl -sS -i -H "Origin: $ORIGIN" -d grant_type=authorization_code "$TOKEN"
```

After enabling the API on `kaspars.net`, a credential-free token POST returned HTTP 400 with the OAuth error `invalid_request` and echoed an arbitrary test origin in `Access-Control-Allow-Origin`. OPTIONS allowed the GitHub Pages origin. WebFinger and the actor returned wildcard CORS headers. The live OAuth metadata advertised CIMD support and both scopes. The plugin’s 9.4.3 source accepts `read write` and replaces the access and refresh tokens on successful refresh. See the [scope implementation](https://github.com/Automattic/wordpress-activitypub/blob/9.4.3/includes/oauth/class-scope.php) and [token implementation](https://github.com/Automattic/wordpress-activitypub/blob/9.4.3/includes/oauth/class-token.php).

## Build the shortcut

On a Mac with [Cherri](https://cherrilang.org/install) installed, run `./build-shortcut.sh` from your Terminal. It compiles `FediTap.cherri` and signs `FediTap.shortcut` for anyone using Apple’s Shortcuts command. Use `./build-shortcut.sh --unsigned` to check compilation separately. The unsigned output is a workflow plist for inspection.

The shortcut sends only the first URL from the shared input in the query string, `?url=<encoded URL>`. The hosting service receives the query as part of a page request. Older shortcuts that use `#url=` still work. With no URL, the shortcut opens the page directly. Rebuild the shortcut when its launch URL or input contract changes. Activity and OAuth logic are deployed with the page.

## Account storage

The page stores accounts in browser local storage by ActivityPub actor ID and remembers the selected actor ID. Reauthorizing an actor replaces that actor’s credentials. Selecting or removing an account leaves other accounts intact. Web Locks serialize account writes and rotating refresh grants across tabs. Release builds should use a dedicated origin because JavaScript elsewhere on the same origin can read the stored credentials.

The pending OAuth state, PKCE verifier, and target URL use session storage for the redirect and are cleared after the callback. The page refreshes tokens before expiry and keeps a replacement refresh token when the server rotates it. A rejected refresh marks only that account for reauthorization. Accounts from the earlier shortcut’s iCloud Drive file require a browser sign-in.
