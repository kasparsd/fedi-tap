# End-to-end suite checkpoint (2026-11-18)

Evidence for the Playwright suite. How to run and extend it is in [`../development.md`](../development.md) (End-to-end tests); the setup is `playwright.config.js` and `e2e/`.

## Checked

- `npm run e2e`: 37 tests pass in about two and a half minutes, on a clean checkout of `main` plus this change, with `npm run validate` also passing.
  - `normal` (33): connecting by handle fallback and profile link, shared link through sign-in, wrong account, API off, damaged storage, iPhone and desktop Shortcut cards, opening a post and a profile, Like, Repost and Follow toggles with in-place undo, replies (mention, escaping, draft, Escape), a missing post, several accounts, switching, removal, another tab, flaky and short-lived tokens, an expired connection with the reply draft kept and restored, a Mastodon-API account, and the loading states.
  - `fast` (1): quick responses add no progress bar, placeholder or notice.
  - `slow` (2): the slow notice, Cancel and a later retry, and a send that can't be cancelled.
  - `built` (1): the production build under its Content Security Policy, with no violation and no page error.
- The suite found two regressions while it was being written against the latest `main`, which had changed under it (copy to Connect, toggle-style actions, Follow in the byline):
  - A working primary button went grey again, because the reworked disabled-button rule outweighed the busy-button rule. Fixed in `src/app.css` and covered by the first loading test.
  - Tests that read button text saw the hidden text that keeps button widths; they now use the accessible name or `shownText`.
- Chromium trusts only the development certificate (by its public key); no certificate check is turned off.

## Not checked

- The `E2E` workflow on GitHub: `npx playwright install --with-deps chromium` and the ports on a hosted runner have not run yet.
- Browsers other than Chromium (WebKit would be the next one, for the iOS-only behavior).
- Accessibility rules beyond the semantics the tests assert (no axe run); the review findings about the stale invalid field in the Accounts sheet, focus after an expired connection, and the native URL validation bubble have no tests yet because they are not fixed.

## Note

`docs/ux/components.md` says the link screen keeps one heading, "Open a post or profile", in every state, but `app.title` still returns Post or Profile once a link is loaded. The tests follow the code.
