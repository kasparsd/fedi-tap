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

The index also has a toggle that simulates a server with the API turned off, sample shared-link URLs (post, long post, profile, missing post, no link with `?via=shortcut`), a reset button and a JSON list of activities the mock server received at `/_dev/activities`. `alice@localhost` demonstrates the WebFinger fallback because the mock cannot listen on port 443. Set `PORT` or `DELAY_MS` to change the port or response delay. The server is for development only and never ships.

### Pinned Node and Docker

Tooling targets Node 24 (`.nvmrc`, `engines` in `package.json`). The app itself is static and has no dependencies. To avoid installing Node, run the same server in a container:

```bash
npm run certs        # once, on the host (needs mkcert); creates .local/dev-certs
docker compose up    # https://localhost:8443/_dev/
```

The container binds the repo, so edits show on reload, and publishes the port on `127.0.0.1` only. Use the host's mkcert certificate: a certificate made inside the container is not trusted by your browser, and the page needs a trusted HTTPS origin to work. If `.local/dev-certs` is missing the container falls back to a self-signed certificate and the browser shows a warning. Set `PORT` (and `DELAY_MS`) in the environment; the port is part of the OAuth client ID, so it must be the same on both sides. Building the Shortcut (`./build-shortcut.sh`) needs Cherri and Apple's Shortcuts command, so it only runs on a Mac and is not part of the container.

## Lint, format and validate

```bash
npm install          # dev tools only; the app itself has no dependencies
npm run validate     # Biome (lint + format check) + static checks
npm run lint:fix     # apply safe lint fixes and format
npm run format       # format only
```

- **[Biome](https://biomejs.dev)** (`biome.json`) lints and formats JS, CSS, HTML, JSON and the manifest in one fast tool, replacing the usual ESLint + Prettier pair. Rules: the recommended set plus `const`, no `var`, strict equality, no unused variables and no shadowed names. A GritQL plugin (`tools/biome/no-html-sinks.grit`) bans `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write`, so remote data can only reach the page as text. `noRedundantUseStrict` is off because `app.js` is a classic script, not a module. Docs and `.local` are not touched; docs use soft line breaks.
- **Static checks** (`tools/scripts/check.js`): every id that `app.js` or `style.css` refers to exists in `index.html`; the CSP script hash and `integrity` match `app.js` (so a forgotten hash update fails here, not in the browser); no inline scripts, styles or event handlers; local files and manifest icons exist. Ids defined but never referenced are reported as warnings.

Run `npm run validate` before committing. After editing `app.js`, run `npm run format` first, then regenerate the script hash, because formatting changes the file.

## Test the WordPress flow

1. Open the published page and sign in with a test account. Try both a Fediverse handle and an HTTPS actor URL. Confirm the callback clears the OAuth code and state from the address bar.
2. Paste a post URL (**Paste** inside the field loads it at once) and test the four actions. A profile URL should offer only **Follow**. Reload the page and check that the selected account is remembered.
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

The shortcut sends only the first URL from the shared input in the query string, `?url=<encoded URL>`. The hosting service receives the query as part of a page request. With no URL, the shortcut opens the page with `?via=shortcut`, which tells the page the person has the Shortcut (so the Shortcut card stays hidden); the page removes the parameter from the address bar. Shortcuts built before this change open the bare page and keep showing the card until a link is shared once or the person taps **Dismiss**. Rebuild the shortcut when its launch URL or input contract changes. Activity and OAuth logic are deployed with the page.

## Account storage

The page stores accounts in browser local storage by ActivityPub actor ID and remembers the selected actor ID. Reauthorizing an actor replaces that actor’s credentials. Selecting or removing an account leaves other accounts intact. Web Locks serialize account writes and rotating refresh grants across tabs. Release builds should use a dedicated origin because JavaScript elsewhere on the same origin can read the stored credentials.

The pending OAuth state, PKCE verifier, and target URL use session storage for the redirect and are cleared after the callback. The page refreshes tokens before expiry and keeps a replacement refresh token when the server rotates it. A rejected refresh marks only that account for reauthorization. Accounts from the earlier shortcut’s iCloud Drive file require a browser sign-in.

The page also keeps `feditap.shortcut` (`yes` or `dismissed`) in local storage, separate from the account store, to hide the Shortcut panel. The panel ("Add Shortcut for iOS") and the Add to Home Screen hint show only on iPhone and iPad (user agent, or a touch-capable Mac platform for iPadOS) and only when an account exists. It is set when the page opens with a shared link (`?url=`) or `?via=shortcut`, or when the person taps **Dismiss** or **Add Shortcut**. The page removes `via` from the address bar after reading it.

## Actions, errors and the Home Screen app

Like, Repost and Follow send one activity to the outbox and then stay disabled for that link and account (the label becomes Liked, Reposted, Follow requested). The page remembers what it sent by account, target and kind until it reloads (the link field and any loaded post stay visible while this happens), so an action that finishes after the person moved on is still recorded and coming back to the link shows it as done. Reply opens a sheet that names the post and account and says replies are public (they are: the Create and its Note are addressed `to` Public with the author in `cc` and a `Mention` tag, and the mention text starts the content, so the author is notified; there is no length limit); blank lines make paragraphs and single newlines line breaks, all escaped. A failed send keeps the draft and shows the error inside the sheet. If the session ends during a reply, the sheet stays open with the draft, and Sign in keeps the draft in session storage for the return. On a 401 from the proxy or outbox the page refreshes the token and retries once, showing "Reconnecting…".

A send that ends without a clear answer (timeout, dropped connection, HTTP 5xx or 408) says it may already have gone through; the person checks their account before pressing the action again. No Try again button is offered, because the action button, Send in the reply sheet and Open or Continue beside an input are themselves the retry and re-read the current value.

**Undo** appears as a plain button next to the finished action only when the outbox response carries a readable `Location` header on the page's origin (the mock server sends `Access-Control-Expose-Headers: Location`; the WordPress plugin must do the same, which is still to be confirmed). It sends an `Undo` activity whose `object` is that ID and is offered for Like, Repost and Follow, not Reply. Each action has its own Undo.

Proxy responses are read with a 1 MB cap and the HTML in them is cut to 20,000 characters before parsing. A returned post must live on the origin of the opened link (a proxy may resolve an alias address only when the object names that address in `url`). The author counts as verified only when its actor document carries the same id the post names; otherwise the card shows only the host and Follow is hidden, so Follow always targets a verified id.

Failures use one pattern: a plain-text alert (bold title, one sentence) directly below the input it belongs to (the input is marked `aria-invalid` and `aria-describedby` points at the alert, and the value stays editable), a button only where there is a different way forward, and an optional "What to do" disclosure (steps, help link, technical detail such as HTTP codes). A failed handle lookup keeps the typed value and offers "Use profile link". When storage is blocked, its saved data is damaged (a Reset button removes only this app's key) or the browser lacks Web Locks, `AbortSignal.timeout` or `crypto.subtle`, the page shows a full-screen explanation instead of a disabled form.

`manifest.webmanifest` makes the page installable (`display: standalone`, `start_url` and `scope` `./`); the CSP allows `manifest-src 'self'` and `img-src 'self'` for the icons (`apple-touch-icon.png` 180 px, `icon-192.png`, `icon-512.png`, flat colour). Serve the manifest as `application/manifest+json`. In standalone mode (`display-mode: standalone` or `navigator.standalone`) the page hides the "Add to Home Screen" hint, tells the person that the Shortcut opens Safari and that this app keeps its own sign-in, and pads for the safe areas. A Home Screen app and Safari keep separate storage on iOS, so each needs its own sign-in.
