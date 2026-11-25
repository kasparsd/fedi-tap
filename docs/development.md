# FediTap development

## Hosting

The app is a Svelte 5 single-page app built with Vite into a static `dist/` folder. `.github/workflows/pages.yml` validates, builds and publishes `dist/` to GitHub Pages on every push to `main`. One-time setup: **Settings › Pages › Build and deployment › Source: GitHub Actions**. The published directory should be `https://kasparsd.github.io/fedi-tap/`. [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Everything under `public/` (`client.json`, `manifest.webmanifest`, the icons and the signed `Open in Fediverse.shortcut`) is copied to `dist/` unchanged. The build uses relative URLs (`base: "./"`), so the page works under any path.

For a different permanent URL, update `client_id`, `client_uri`, and `redirect_uris` in `public/client.json` together, and update `page` in `fedi-tap.cherri` before signing another copy. The Shortcut's icon (`#define color lightblue`, `#define glyph asterisk`) is limited to Apple's built-in glyphs and colours; iOS shows only the glyph in the share sheet. The client ID must match the exact HTTPS URL that serves `client.json`. The redirect URI must match the setup page URL, including its trailing slash. Once people connect, keep both URLs stable. Verify that `client.json` returns HTTP 200 with `Content-Type: application/json`.

### Content Security Policy

The build adds a strict policy to `dist/index.html` (`vite.config.js`): `script-src 'self'`, `style-src 'self'`, `connect-src https:`, `form-action 'none'` (sign-in leaves through a script redirect), no inline code and no `data:` URIs. It also requires Trusted Types for scripts (`require-trusted-types-for 'script'`) and names the only two policies that may exist: `svelte-trusted-html` (Svelte's templates) and `feditap-plain-text` (`src/lib/text.js`, only where `Document.parseHTML()` is missing). A plain string reaching `innerHTML` or `DOMParser` throws. Parsing a post's markup still makes the browser report the markup's own inline handlers as blocked (`script-src-attr`); nothing runs, and the `built` test expects exactly that. A page that another page frames draws no controls (`src/lib/frame.js`), because a static host can't send `frame-ancestors`. The build emits one script and one stylesheet, so there is no hash to maintain. The policy is not applied by the dev server, because Vite injects styles inline for hot reload; use `npm run preview` to see the page under it. `npm run check` fails if the built page loses the policy or gains anything inline.

## Server compatibility

An account has a `type`, and each type has a backend in `src/lib/` that the page reaches through `backendFor(account)` (`src/lib/backend.js`). A backend resolves a link, acts (like, repost, reply, follow), undoes, says whether the saved addresses are sound, and runs its half of sign-in. `src/state.svelte.js` knows no protocol.

Sign-in starts with the profile (a handle through WebFinger, or a profile link) and its actor ID, then chooses the backend:

1. The actor advertises the ActivityPub client API (`endpoints.proxyUrl` or an OAuth endpoint): `activitypub`.
2. Otherwise `GET <origin>/api/v1/instance` answers with JSON that has a `version` (HTTPS, same origin, size-capped, 20 s): `mastodon`.
3. Otherwise "Server not supported", which names both options.

The account key is the actor ID for both types. For every type the actor ID, the OAuth endpoints and the API addresses must share the profile's origin. FediTap uses authorization server metadata (`/.well-known/oauth-authorization-server`) when available and verifies the callback issuer when the server advertises issuer support or returns an issuer.

### Actions on the home server

When sign-in finishes, the app asks the account's own origin for `acct:{handle}` in WebFinger and saves the FEP-3b86 links it finds as `account.intents` (`findIntents` in `src/lib/discovery.js`). Each template must be HTTPS on the account's origin with its one placeholder and no other: `Create` takes `{inReplyTo}` (reply), and `Like`, `Announce` (repost), `Follow` and `Object` (open) take `{object}`. The legacy OStatus subscribe link (`{uri}`) stands in for `Object` when there is none. Mastodon's `Create` template (`/share?text={content}`) has no `{inReplyTo}`, so it is not a reply intent.

When the server advertises any, the actions are grouped by who performs them: the heading "Using API" holds the in-app buttons (the API), and the heading "Using {host} links" (`ServerLinks.svelte`) holds the same buttons as links to the server, with the post or profile address percent-encoded into the template. A post gets Like, Repost (only a public or unlisted post), Reply, Follow (its verified author) and Open; a profile gets Follow and Open. Without any advertised intent there are no group names and no links. Any lookup failure means no links, never a failed sign-in. Templates are read once, at sign-in: sign in again to pick up a server's later change.

### Links that aren’t Fediverse posts

A link that fails to open says which kind of failure it was, because the same address can be a deleted post or not a Fediverse link at all. The server answering "not found" (HTTP 404 or 410 from the proxy, an empty Mastodon search) is one problem that lists both possibilities. A 200 answer with no HTTPS `id` or ActivityStreams `type` (an ordinary page, plain JSON) is "Not a Fediverse post or profile". An answer with a type but no author (a collection, an activity) names that type. Each offers the link back as "Open the link in your browser" under its details (`problem.js`: `linkNotFound`, `notFediverse`, `otherKind`). The mock serves `/web/page` and `/web/collection` for the last two.

### ActivityPub (`src/lib/activitypub/`)

FediTap uses the client-to-server ActivityPub API described in the [Social API Basic Profile draft](https://swicg.github.io/activitypub-api/basicprofile). The setup flow requires CIMD (`public/client.json`), OAuth authorization code with PKCE S256, the `read write` scopes, and renewable tokens. The actor must expose its outbox, followers collection, and object proxy. ActivityPub for WordPress is the tested implementation.

### Mastodon API (`src/lib/mastodon/`)

For Mastodon, GoToSocial, Pleroma, Akkoma and similar servers. There is no CIMD, so the page registers itself:

- **App registration.** `POST /api/v1/apps` (or the metadata's `registration_endpoint`) with the page address as the only redirect URI. The `client_id` and `client_secret` are saved once per server in `store.clients[origin]` and reused for later sign-ins; the secret never goes into session storage and is read from the store at the callback. Registering is visible to the server's administrator, which is why it is cached.
- **Scopes.** `read:accounts read:search write:favourites write:statuses write:follows`, or `read write follow` when the metadata's `scopes_supported` lacks one of them or registration rejects them. The token response's `scope` must cover everything asked for, else sign-in stops with "Your server allowed less than FediTap asked."
- **Authorization.** PKCE S256, `state`, the issuer check, and a token exchange that also sends `client_secret` (the app is confidential). Servers before Mastodon 4.3 ignore PKCE; it is sent anyway. The signed-in account must be the one that was discovered (`verify_credentials.uri` equals the actor ID), else "Wrong account".
- **Tokens.** Mastodon tokens normally never expire and have no refresh token, so an account may have neither `refresh_token` nor `expires`. A 401 then goes straight to "Sign-in expired". Servers that do issue a refresh token (Pleroma, Akkoma) are renewed as usual, with the secret.
- **Actions.** Resolve is `GET /api/v2/search?q=<link>&resolve=true&limit=1` (first status, else first account). Like, Repost and Follow are `favourite`, `reblog` and `accounts/:id/follow`, undone by `unfavourite`, `unreblog` and `unfollow`; they are idempotent, so a failed one is simply tried again. A reply is `POST /api/v1/statuses` as plain text (no HTML) that opens with the author's `@user@host`, with `in_reply_to_id`, the parent's `visibility` (a reply to a followers-only post stays followers-only; the reply sheet says which) and an `Idempotency-Key`. Servers may ignore that key, so a reply that ends without a clear answer still says it may have gone through.
- **Verification.** The server vouches for what it returns, so the checks are lighter: the object's `uri` or `url` must be on the opened link's origin, and the author counts as verified only when `account.uri` is an HTTPS address. `content`, `display_name` and `note` pass through the same plain-text conversion and caps as ActivityPub; server HTML is never rendered.

Not supported: Lemmy and Misskey (different APIs).

## Local dev server with a mock OAuth server

```bash
npm install
npm run dev
```

Starts the Vite dev server (hot reload) at `https://localhost:8443/`, with the mock server's index at `https://localhost:8443/_dev/`. The app only runs over HTTPS and checks `client.json` against the page URL, so the server uses HTTPS (a certificate from [mkcert](https://github.com/FiloSottile/mkcert) if installed, otherwise self-signed) and serves a generated `client.json` for its own origin. `tools/mock-server.js` is a Vite plugin that fakes an ActivityPub server, a Mastodon API (instance, app registration, search, statuses, accounts) and an OAuth 2.0 PKCE provider on the same origin, so the whole flow works offline without a real account. `npm run preview` serves the production build (with its Content Security Policy) and the same mock.

Sign in with a profile URL on the dev index page. Each user exercises a path:

| User | Behavior |
|------|----------|
| `alice` | Everything works |
| `shorty` | Access token lasts 61 s, so each action refreshes first |
| `flaky` | First access token is rejected with 401 (refresh and retry) |
| `erin` | Refresh fails with `invalid_grant` (sign in again) |
| `mismatch` | Authorizes as a different profile (identity check) |
| `mario` | Mastodon API account: registers an app, the token never expires |
| `gone` | Mastodon API account whose token is rejected after sign-in (sign in again) |

The index also has a toggle that simulates a server with the API turned off, sample shared-link URLs (post, long post, profile, a followers-only post, missing post, no link with `?via=shortcut`), a reset button and a JSON list of activities the mock server received at `/_dev/activities`. `alice@localhost` demonstrates the WebFinger fallback because the mock cannot listen on port 443. Set `PORT` or `DELAY_MS` to change the port or response delay. The server is for development only and never ships.

### Pinned Node and Docker

Tooling targets Node 24 (`.nvmrc`, `engines` in `package.json`). To avoid installing Node, run the same server in a container:

```bash
npm run certs        # once, on the host (needs mkcert); creates .local/dev-certs
docker compose up    # https://localhost:8443/_dev/
```

The container binds the repo, so edits show live (it polls for changes), and publishes the port on `127.0.0.1` only. Its dependencies are installed for Linux in the image and kept in a `node_modules` volume; after changing `package.json` run `docker compose build` and `docker compose down -v`. Use the host's mkcert certificate: a certificate made inside the container is not trusted by your browser, and the page needs a trusted HTTPS origin to work. If `.local/dev-certs` is missing the container falls back to a self-signed certificate and the browser shows a warning. Set `PORT` (and `DELAY_MS`) in the environment; the port is part of the OAuth client ID, so it must be the same on both sides. Building the Shortcut (`./build-shortcut.sh`) needs Cherri and Apple's Shortcuts command, so it only runs on a Mac and is not part of the container.

## Project layout

```
index.html              Vite entry
src/main.js             mounts the app
src/App.svelte          chooses what to show (signed out, ready, loaded, unsupported)
src/app.css             the whole stylesheet (see docs/ux/components.md)
src/state.svelte.js     reactive state and every action that changes it
src/components/         one Svelte component per screen part
src/lib/                protocol code with no framework or page access (unit-tested):
                        backend.js (backendFor, server detection), signin.js (shared OAuth),
                        discovery, tokens, account store
src/lib/activitypub/    the ActivityPub client-to-server backend
src/lib/mastodon/       the Mastodon API backend (api, discovery, signin, actions)
src/test-helpers.js     fake fetch for unit tests
public/                 copied to dist/ as is: client.json, manifest, icons, Open in Fediverse.shortcut
tools/mock-server.js    the mock ActivityPub, Mastodon API and OAuth server (Vite plugin)
tools/scripts/          check.js (static checks), try.js (command-line client)
e2e/                    Playwright end-to-end tests, one folder per mock server (normal, fast, slow, built)
playwright.config.js    the four mock servers and the browser setup for the tests
```

Components read `app` from `state.svelte.js` and call its functions. Views are `{#if}` blocks on `app.view`. A running task (`runTask`) sets `app.task`, which turns off the controls, shows the pulsing dot in the header and the slow notice, and labels the pressed button through the `BusyLabel` component; `app.busy` is true while it runs. See "Loading" in `docs/ux/components.md`. Only read-only requests can be cancelled: they take their signal from `src/lib/signal.js`. Message sections (`status` line plus one problem) are the `Messages` component and must stay mounted so screen readers announce them. Dialogs are the `Sheet` component, a native `<dialog>` driven by an `open` flag; its content exists only while open.

## Lint, format, test and validate

```bash
npm install
npm run validate     # Biome + svelte-check + unit tests + build + static checks
npm run lint:fix     # apply safe lint fixes and format
npm test             # Vitest unit tests for src/lib
npm run e2e          # Playwright end-to-end tests (see below)
```

- **[Biome](https://biomejs.dev)** (`biome.json`) lints and formats JS, CSS, HTML and JSON in one tool. Rules: the recommended set plus `const`, no `var`, strict equality, no unused variables and no shadowed names. A GritQL plugin (`tools/biome/no-html-sinks.grit`) bans `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write`, so remote data can only reach the page as text. Biome does not read `.svelte` files.
- **[svelte-check](https://svelte.dev/docs/svelte/svelte-check)** compiles every component and fails on any warning, including accessibility warnings.
- **Static checks** (`tools/scripts/check.js`, after `npm run build`): the built page has the strict Content Security Policy and nothing inline; local files and manifest icons exist; `client.json` is consistent; no source uses `{@html}` or inline styles.

Run `npm run validate` before committing. The `CI` workflow runs it on every pull request and push to `main`, and the Pages workflow runs it again before it publishes.

### End-to-end tests

`npm run e2e` drives the real page in Chromium against the mock server, through whole user flows: signing in (ActivityPub and Mastodon, wrong account, API off, shared links), opening links, every action and its undo, replies and their draft, several accounts and tabs, expired and renewed tokens, damaged storage, and the loading states. The first time, install the browser with `npm run e2e:install`. Tests check behaviour and state, not wording, so copy and layout stay free to change: the screen comes from `main[data-view]`, an action from `button[data-action]`, an error as the presence of `[role="alert"]` in its slot, a result from the activities the mock received or `aria-pressed`. Text is asserted only when it is data from the fixture (a name, a handle, a link) or part of the workflow (the handle a reconnect names). It is not part of `validate`, which stays fast; the `CI` workflow runs it, next to `validate`, on every pull request and push to `main`. The Pages workflow publishes without waiting for `CI`, so a failing check never blocks a release (keep the `CI` jobs out of required status checks until that is wanted).

`playwright.config.js` starts one mock server per project, because the mock's response delay decides what a test can see:

| Project | Server | Tests |
|---|---|---|
| `normal` | 400 ms per request | The flows, and the loading states (progress, placeholder, dimmed post, button widths) |
| `fast` | no delay | Quick responses add nothing to the page |
| `slow` | 6.5 s per request | The slow notice and Cancel |
| `built` | the production build and its Content Security Policy | The page works and the browser blocks nothing |

The servers use ports 8461 to 8464 (`E2E_PORT` changes the first) and are reused when already running. The page needs HTTPS, so Chromium trusts the development certificate by its public key and checks every other certificate as usual; there is no switch that turns certificate checks off. The mock keeps its state per server, so tests run one at a time and each starts with `resetMock`. A failed test leaves a trace and a screenshot in `test-results/` (`npx playwright show-trace <trace.zip>`). The whole run takes about two and a half minutes, most of it the slow server.

When you add a screen or a state, add or extend a test next to the similar one, and prefer what a person sees (roles, names, text) to ids. Button text includes a hidden copy that keeps the button's width, so read it with `shownText` or check the accessible name, not `toHaveText`.

## Test the WordPress and Mastodon flows

1. Open the published page and sign in with a test account. Try both a Fediverse handle and an HTTPS actor URL. Confirm the callback clears the OAuth code and state from the address bar.
2. Paste a post URL (**Paste** inside the field loads it at once) and test the four actions. A profile URL should offer only **Follow**. Reload the page and check that the selected account is remembered.
3. Connect a second account. Switch accounts, verify the next action is sent as that account, then remove one account and check that the other still works.
4. With a disposable account, expire the saved access token by setting its `expires` field in browser storage to a past time. Open the same link in two tabs and verify that refresh rotation preserves both sessions. Revoke access on the server and check that FediTap asks you to sign in again when the grant can no longer be refreshed.
5. Mastodon-compatible server (a disposable account on each of Mastodon, GoToSocial, Pleroma or Akkoma, and Pixelfed for like, reply and follow only): sign in with a handle and with a profile link, and check that the callback clears the code and state. Open a post and a profile (a profile offers only **Follow**). Test Like, Repost, Follow (a locked account says "Follow requested") and **Undo** for each, then Reply: check that the author is mentioned, that a reply to a followers-only post stays followers-only, and that the sheet says so. Sign in a second time and confirm no second app is registered on the server. Try a post on a server that your home server blocks. Pixelfed: check that search with `resolve` finds the link. Then confirm the WordPress account still works.
6. Install the shortcut on an iPhone, share a Fediverse link, and verify that the browser receives the URL and retains it through sign-in. A successful sign-in can resolve the link, but publishing always requires choosing an action.

### CORS

The browser must be able to read responses from WebFinger, the actor URL, OAuth discovery when needed, the token endpoint, the proxy, and the outbox. Proxy and outbox preflights need to allow POST with `Authorization` and `Content-Type`. A Mastodon-compatible server must also allow the page for `/api/v1/instance`, `/api/v1/apps`, `/oauth/token` and `/api/*` (the reply preflight includes the `Idempotency-Key` header). Mastodon allows this by default; a reverse proxy in front of another server may not. If WebFinger is blocked, enter the HTTPS actor URL. If a token request is blocked, ask the WordPress or reverse-proxy administrator to allow the page origin on the advertised token route. The browser reports some network and TLS failures the same way as CORS.

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

On a Mac with [Cherri](https://cherrilang.org/install) installed, run `./build-shortcut.sh` from your Terminal. It compiles `fedi-tap.cherri` and signs `public/Open in Fediverse.shortcut` for anyone using Apple’s Shortcuts command. Use `./build-shortcut.sh --unsigned` to check compilation separately. The unsigned output is a workflow plist for inspection.

The shortcut sends only the first URL from the shared input in the query string, `?url=<encoded URL>`. The hosting service receives the query as part of a page request. With no URL, the shortcut opens the page with `?via=shortcut`, so the page can tell a Shortcut launch from a typed address; the page removes the parameter from the address bar. Rebuild the shortcut when its launch URL or input contract changes. Activity and OAuth logic are deployed with the page.

### Test the Shortcut in the iOS Simulator

The whole path (the real share sheet, the published Shortcut, the published page, and a local account server) runs in the iOS Simulator, so nobody needs a device to check the Shortcut or the shared-link handling. The simulator ships the Shortcuts app and Safari's share sheet. Nothing is rebuilt or re-signed: the committed **Open in Fediverse** Shortcut opens `https://kasparsd.github.io/fedi-tap/`, and that page talks to the mock server on your Mac (the page needs only HTTPS, and Safari lets it call `https://localhost`).

1. Start the mock with the published page allowed as its OAuth client: `PAGE=https://kasparsd.github.io/fedi-tap/ npm run dev` (or `npm run preview`). `PAGE` makes the mock accept that page's client ID and redirect. The mock answers CORS itself for any origin, and the Vite server's own CORS is off (`cors: false` in `vite.config.js`) because it only allows localhost origins and would reject the preflight from github.io. Port 8443 is the default; `PORT` changes it.
2. Boot a simulator and let it trust the mkcert certificate the mock uses: `xcrun simctl boot <device>` and `xcrun simctl keychain booted add-root-cert "$(mkcert -CAROOT)/rootCA.pem"`.
3. In the simulator's Safari open the published page and choose **Add Shortcut**: Safari offers the download, then **Downloads** (the toolbar menu) opens it in Shortcuts, where **Add Shortcut** installs it ("Appears in Share Sheet"). If an earlier download took the plain name the Shortcut arrives as "Open in Fediverse 2"; delete the old one in Shortcuts first, or rename it.
4. Open a post in Safari and choose **Share**, then **Open in Fediverse** (under **View More**; **Edit Actions** at the bottom of the sheet pins it beside Copy). iOS asks once whether Open in Fediverse may send the Safari item to `kasparsd.github.io`; choose **Allow Once**. The page opens with the link filled in. Connect with the profile link `https://localhost:8443/users/alice` (or any user in the table above), approve on the mock's page, and the post loads.
5. Check what the page sent at `https://localhost:8443/_dev/activities`.

The mock resolves the fixture posts (the `/notes/N` addresses, `https://social.example/@dana/1` and `@zed/2`) and one real post address, `https://kaspars.net/blog/high-power-capacity-battery-power-tools`, which it answers the way the ActivityPub plugin federates a post (note 6, with `id` and `url` on kaspars.net). Share that address from Safari to see a real page in the share sheet with the mock behind it. Any other address your account's proxy cannot resolve shows "Couldn't open this link".

Tips for driving it with the simulator control tool: take a screenshot after each tap, because the first launch shows a keyboard tip that can swallow typed text, sheets animate for a second or two, and the Shortcuts import sheet appears a few seconds after the app opens. The tool types plain ASCII only (a rename that needs ⁂ must edit the existing text), and it taps in device points, not the pixels of a screenshot.

### Screenshots for the README

`docs/images/` holds the screenshots the README shows. They come from the flow above, in dark mode, on an iPhone 17 Pro simulator, against the published page and the mock (fictional account `@alice@localhost`, the real kaspars.net post as the shared link). To retake them: `xcrun simctl ui booted appearance dark`, a clean status bar with `xcrun simctl status_bar booted override --time 9:41 --batteryState discharging --batteryLevel 100 --cellularBars 4 --wifiBars 3`, and `xcrun simctl io booted screenshot --type=png <file>` at each step (share sheet, the iOS prompt, sign-in, the post and actions, the reply sheet, the result). Resize to 600 px wide with `sips --resampleWidth 600`; keep the blurred share sheet and prompt as JPEG and the flat page screens as PNG. Screenshots show the published page on the day they were taken, so retake them when the page changes visibly.

The published page can lag behind `main`. To retake the screenshots before a deploy, serve the current build with `PORT=8450 npm run dev` and compile a throwaway copy of `fedi-tap.cherri` whose `page` is `https://localhost:8450/`; build and sign it as in `build-shortcut.sh`, and never commit it. Use a dedicated simulator (`xcrun simctl create`) so other sessions that drive the default one don't change the screen, and add the mkcert root certificate to it. The iOS prompt then names `localhost` instead of the published host, so retake `permission.jpg` against the published page once it is deployed.

## Account storage

The page stores accounts in browser local storage by ActivityPub actor ID, each with its `type`, and remembers the selected actor ID. The same record holds the apps registered on Mastodon-compatible servers (`clients`, by origin) with their `client_secret`; like the tokens, they are readable by any JavaScript on the page's origin, which is a normal trade for a browser client but another reason for a dedicated origin. Reauthorizing an actor replaces that actor’s credentials. Selecting or removing an account leaves other accounts intact. Web Locks serialize account writes and rotating refresh grants across tabs. Release builds should use a dedicated origin because JavaScript elsewhere on the same origin can read the stored credentials.

The pending OAuth state, PKCE verifier, and target URL use session storage for the redirect and are cleared after the callback. The page refreshes tokens before expiry and keeps a replacement refresh token when the server rotates it. A rejected refresh marks only that account for reauthorization. Accounts from the earlier shortcut’s iCloud Drive file require a browser sign-in.

The "Add Apple Shortcut" panel (the Shortcut works on iPhone, iPad and Mac) shows on every device, signed out or in, and has no dismiss state or stored flag. The Add to Home Screen hint shows only on iPhone and iPad (user agent, or a touch-capable Mac platform for iPadOS), only in the browser (not once installed) and only while no sign-in has expired.

## Actions, errors and the Home Screen app

(This section describes the ActivityPub backend; the Mastodon backend makes the REST calls listed above and has the same interface behaviour.) Like, Repost and Follow send one activity to the outbox and then stay disabled for that link and account (the label becomes Liked, Reposted, Follow requested). The page remembers what it sent by account, target and kind until it reloads (the link field and any loaded post stay visible while this happens), so an action that finishes after the person moved on is still recorded and coming back to the link shows it as done. Reply opens a sheet that names the post and account and says who can see the reply (public on ActivityPub: the Create and its Note are addressed `to` Public with the author in `cc` and a `Mention` tag; on the Mastodon API the reply keeps the parent post's visibility). The mention text starts the content, so the author is notified. On ActivityPub there is no length limit; blank lines make paragraphs and single newlines line breaks, all escaped (the Mastodon API takes the text as plain text instead). A failed send keeps the draft and shows the error inside the sheet. If the session ends during a reply, the sheet stays open with the draft, and Sign in keeps the draft in session storage for the return. On a 401 from the proxy or outbox the page refreshes the token and retries once, showing "Reconnecting…".

A send that ends without a clear answer (timeout, dropped connection, HTTP 5xx or 408) says it may already have gone through; the person checks their account before pressing the action again. No Try again button is offered, because the action button, Send in the reply sheet and Open or Continue beside an input are themselves the retry and re-read the current value.

**Undo** appears as a plain button next to the finished action when the backend says it can (`sent.undo`), and is offered for Like, Repost and Follow, not Reply. With ActivityPub that needs a readable `Location` header on the page's origin in the outbox response (the mock server sends `Access-Control-Expose-Headers: Location`; the WordPress plugin must do the same, which is still to be confirmed), and Undo sends an `Undo` activity whose `object` is that ID. With the Mastodon API Undo always exists and calls `unfavourite`, `unreblog` or `unfollow`. Each action has its own Undo.

Proxy responses are read with a 1 MB cap and the HTML in them is cut to 20,000 characters before parsing. A returned post must live on the origin of the opened link (a proxy may resolve an alias address only when the object names that address in `url`). The author counts as verified only when its actor document carries the same id the post names; otherwise the card shows only the host and Follow is hidden, so Follow always targets a verified id.

Failures use one pattern: a plain-text alert (bold title, one sentence) directly below the input it belongs to (the input is marked `aria-invalid` and `aria-describedby` points at the alert, and the value stays editable), a button only where there is a different way forward, and an optional "What to do" disclosure (steps, help link, technical detail such as HTTP codes). A failed handle lookup keeps the typed value and offers "Use profile link". When storage is blocked, its saved data is damaged (a Reset button removes only this app's key) or the browser lacks Web Locks, `AbortSignal.timeout` or `crypto.subtle`, the page shows a full-screen explanation instead of a disabled form.

`manifest.webmanifest` makes the page installable (`display: standalone`, `start_url` and `scope` `./`); the CSP allows `manifest-src 'self'` and `img-src 'self'` for the icons (`apple-touch-icon.png` 180 px, `icon-192.png`, `icon-512.png`, `#00a6f5` with a white ⁂, generated from `tools/icons/icon.svg` with `rsvg-convert -w <size> -h <size> tools/icons/icon.svg -o public/<name>.png`). Serve the manifest as `application/manifest+json`. A `share_target` (GET to `./` with `title`, `text` and `url`) adds FediTap to the Android share sheet once installed; Android usually puts the link in `text`, so the page takes the first HTTPS link from `url` or else `text`. iOS ignores `share_target`, so the Shortcut remains the iOS mechanism. In standalone mode (`display-mode: standalone` or `navigator.standalone`) the page hides the "Add to Home Screen" hint, tells the person that the Shortcut opens Safari and that this app keeps its own sign-in, and pads for the safe areas. A Home Screen app and Safari keep separate storage on iOS, so each needs its own sign-in.
