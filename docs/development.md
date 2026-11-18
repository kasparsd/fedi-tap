# FediTap development

## Hosting

Publish the root of the `main` branch of `kasparsd/fedi-tap` using **Settings › Pages › Deploy from a branch**. The published directory should be `https://kasparsd.github.io/fedi-tap/`. GitHub Pages serves the checked-in `index.html`, `client.json`, and signed `FediTap.shortcut` directly. [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

For a different permanent URL, update `client_id`, `client_uri`, and `redirect_uris` in `client.json` together, and update `setupPage` in `FediTap.cherri` before signing another copy. The client ID must match the exact HTTPS URL that serves `client.json`. The redirect URI must match the setup page URL, including its trailing slash. Once people connect, keep both URLs stable. Verify that `client.json` returns HTTP 200 with `Content-Type: application/json`.

Run this from the directory containing `index.html` whenever you edit its inline script. Node is used only for updating the hash during editing. Hosting requires no build step.

```sh
node --input-type=module <<'JS'
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const hash = createHash('sha256').update(script).digest('base64');
writeFileSync('index.html', html.replace(/script-src 'sha256-[^']+'/, "script-src 'sha256-" + hash + "'"));
JS
```

## Test the WordPress flow

1. Open the published page, enter `kaspars@kaspars.net` or another WordPress ActivityPub handle, and approve access as the same WordPress user. Repeat with the HTTPS actor URL to check direct discovery.
2. On the Connect screen, verify the handle and server. Check that the address bar no longer contains the OAuth code or state and that browser storage contains no tokens or pending OAuth transaction.
3. On desktop, click **Copy settings** and save the copied JSON to a private `settings.json`. Run `./feditap-try.sh settings.json https://example.org/path/to/a/fediverse-post` with a real federated post URL. The default action reads through the account’s proxy and should print the resolved object type and ID.
4. Use the refresh grant below on a disposable test connection. Check that the response includes a new token pair and that the previous refresh token is rejected. The refresh call can be made before the access token expires. To exercise automatic refresh on an iPhone, set the saved account’s `expires` to less than 60 seconds from now, then run a shortcut action.
5. On an iPhone, open the page in Safari, sign in, install **FediTap** using **Download Shortcut** and tap **Connect FediTap**. Confirm that Shortcuts receives JSON as text and writes the account to `fediverse.json`. Repeat with the same handle, then a different handle, to check replacement and addition.

```sh
umask 077
jq -r '"grant_type=refresh_token&refresh_token=\(.refresh_token | @uri)&client_id=\(.client_id | @uri)"' settings.json |
  tr -d '\n' |
  curl -sS -X POST "$(jq -r .token_endpoint settings.json)" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-binary @- > refreshed.json
```

Keep the token files private and delete them after testing.

### CORS

The browser must be able to read responses from WebFinger, the actor URL, OAuth discovery when needed, and the token endpoint. If WebFinger is blocked, enter the HTTPS actor URL. If a token request is blocked, ask the WordPress or reverse-proxy administrator to allow the page origin on the advertised token route. The browser reports some network and TLS failures the same way as CORS.

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

The shortcut opens the setup page when it has no saved account or needs fresh credentials.

Import the signed file as **FediTap** and test the setup handoff on iPhone before sharing it. The connection confirmation and the help shown when you run FediTap without a shared link display the installed version. Update `shortcutVersion` in `FediTap.cherri` for each release. Check account replacement, then share a post and exercise the actions and refresh. In particular, verify that Shortcuts preserves the ActivityPub content type on outbox requests and passes OAuth error responses from the refresh endpoint to the reconnect branch.

## Shortcut payload and refresh

The page passes a URL-encoded JSON string as the `text` parameter of `shortcuts://run-shortcut?name=FediTap&input=text`. Access and refresh tokens stay in page memory while the Connect screen is open and are cleared on navigation. The page remembers only the last handle in localStorage. Reloading prefills that handle. The setup form stays available on the Connect screen so you can sign in again for fresh settings. **Copy settings** explicitly copies the same JSON to the clipboard.

```json
{
  "fedishare": 3,
  "kind": "activitypub",
  "handle": "kaspars@kaspars.net",
  "actor": "https://kaspars.net/blog/author/kaspars",
  "outbox": "https://kaspars.net/wp-json/activitypub/1.0/actors/1/outbox",
  "followers": "https://kaspars.net/wp-json/activitypub/1.0/actors/1/followers",
  "proxy": "https://kaspars.net/wp-json/activitypub/1.0/proxy",
  "token": "<access_token>",
  "refresh_token": "<refresh_token>",
  "expires": 1795005600,
  "token_endpoint": "https://kaspars.net/wp-json/activitypub/1.0/oauth/token",
  "client_id": "https://kasparsd.github.io/fedi-tap/client.json"
}
```

FediTap accepts setup versions 2 and 3. Both use the `fedishare` version field. FediTap saves or updates each account in `fediverse.json` under its `handle`. It also reads `fediverse.txt` from earlier builds when the JSON file is missing. Install or rename the shortcut as **FediTap** so the Connect link can find it.

For a version 3 ActivityPub account, before an authenticated request, compare `expires` (Unix seconds) with the current Unix time. When it is less than 60 seconds away, POST `grant_type=refresh_token`, `refresh_token` and `client_id` as form fields to `token_endpoint`. Replace `token` with `access_token`, save the new `refresh_token` when supplied, and recompute `expires` as current Unix time plus `expires_in`. Save the updated account before continuing. When Shortcuts returns the OAuth error response for HTTP 400 or 401, open the setup page and stop. Version 2 payloads have no refresh fields and keep their existing behavior.
