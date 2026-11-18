# Svelte migration checkpoint (2026-11-18)

Evidence for the move from the single `app.js` to Svelte 5 + Vite. The decisions are in [`../development.md`](../development.md) (hosting, Content Security Policy, project layout, tooling) and [`../ux/components.md`](../ux/components.md) (view states).

## Checked

- `npm run validate` passes: Biome, svelte-check with warnings as errors (0), 36 unit tests for `src/lib`, production build, and the static checks on `dist/`.
- Behavior against the mock server in headless Chromium at 390 px width, 66 checks, on the dev server and again on the production build (`npm run preview`) with the strict Content Security Policy. No policy violations were reported; the only console errors were the expected ones (WebFinger on port 443 refused, a 404 post, the flaky account's first 401).
  - Sign-in by profile link and by handle, the "Use profile link" fallback, invalid-field state, callback cleanup, shared link before sign-in and its restore after sign-in.
  - Open a post, a profile and a missing post; Like, Repost, Follow, Reply (escaped, mention added), Undo; the server received the expected activities.
  - Several accounts: add, switch, remove, closing the sheet on the last removal, focus returns to the switcher, cross-tab sync in both directions.
  - Token paths: the flaky account's retry after a 401, the revoked account's "Sign-in expired" card and sheet, reply draft kept across the redirect and restored.
  - Wrong account, API off, damaged storage with Reset, busy state (read-only field, "Opening…" label, `aria-busy`, switcher off).
  - iPhone user agent: Shortcut card and Home Screen hint, Dismiss, `?via=shortcut`.
- The port found one regression, fixed and re-run: re-signing in after an expired session dropped the shared link.

## Not checked

- Docker (`docker compose up`) with the new image and `node_modules` volume: the Docker daemon was not running.
- The GitHub Actions workflow and the Pages deployment: needs the repository setting **Pages › Source: GitHub Actions** and a push (owner).
- The built page in the in-app Browser pane: it does not trust the mkcert certificate, so the checks above used Playwright with that one certificate pinned. Run `mkcert -install` to trust it.
- A real-device Home Screen OAuth round trip (owner), as before.
- `tools/scripts/try.js` still carries its own copy of the activity code; it could import `src/lib` later.
