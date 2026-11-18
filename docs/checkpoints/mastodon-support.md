# Mastodon API support checkpoint (2026-11-18)

Evidence for the second backend. The decisions are in [`../development.md`](../development.md) (server compatibility, mock users, test steps, storage, undo) and [`../ux/components.md`](../ux/components.md) (sign-in copy, reply sheet).

## Checked

- Unit tests pass (73, up from 36): detection order (ActivityPub API first, then the Mastodon probe, then "not supported", and a probe answer from another origin ignored), metadata and the standard-address fallback, issuer and endpoint origin mismatches, one app registration per server and its reuse, scope choice, granular-to-broad registration fallback, a narrower grant refused, wrong account refused, never-expiring and renewable tokens, resolve for a status and a profile with the origin and verified-author rules, every action and its undo, reply text, mention, visibility and idempotency key, 401 renew once, a second 401 and an ended session.
- The ActivityPub code moved behind the backend interface with no behavior change before any Mastodon code landed: the original 36 tests passed at that point.
- `svelte-check` (0 warnings), the production build and the static checks on `dist/` pass.
- The mock server's Mastodon routes work end to end over `curl` against the dev server: `/api/v1/instance`, app registration, the authorization decision, the PKCE and `client_secret` token exchange, `verify_credentials`, search by link, favourite, a reply with `Idempotency-Key` (the repeat returned the same status) and the received-activity list.

- The browser flow against the mock in the in-app Browser pane at 375 px, after the dev certificate was trusted, signing in by profile link (some steps were driven by script through the page's own buttons):
  - Sign in as `mario`: detection chose the Mastodon API, the app was registered with the granular scopes, the shared link was restored after the callback and resolved (author, handle, date).
  - Like, Repost and Follow, then Undo on Like: the mock received Like, Announce, Follow and Undo Like, and the buttons showed Liked, Reposted, Follow requested and Undo.
  - Reply to a followers-only post: the sheet said "Replies go to followers only."; the mock received plain text starting with the author's mention, visibility `private` and the right parent; the sheet closed with "Reply sent."
  - A second account (`gone`) signed in without registering a second app (one entry in `clients`); its first request was refused and the page showed "Sign-in expired" and marked it in the switcher. The selected account and its session survived a reload.
  - The only console error was that expected 401.

## Not checked

- In the browser: sign-in by handle (the mock cannot serve WebFinger on port 443), the "Use profile link" fallback, removing accounts of both types, a Mastodon account together with an ActivityPub one, and a reply draft kept across "sign in again". `npm run dev` and the `/_dev/` index cover these.
- Any real server. Still open, and each needs a disposable account:
  - Mastodon 4.3 or later: the exact field names in `/.well-known/oauth-authorization-server`, whether `/oauth/token` needs `client_secret` alongside PKCE, and CORS for `/api/v1/apps`, `/oauth/token`, `/oauth/revoke` and `/api/*` including the `Idempotency-Key` preflight.
  - GoToSocial, Pleroma or Akkoma, and Pixelfed (like, reply and follow only; whether search `resolve` works and whether its accounts carry `uri`).
  - The WordPress account as a regression check, and a post on a server the home server blocks.
- Whether servers honor `Idempotency-Key`. Until that is known, a reply that ends without a clear answer still says it may have gone through.
- `tools/scripts/try.js` is ActivityPub only.
- `npm run validate` as a whole: another session's worktree in `.claude/worktrees/` carries its own `biome.json`, which makes `biome check .` refuse to run from the repository root. The same checks pass when run on `src` and `tools`.
