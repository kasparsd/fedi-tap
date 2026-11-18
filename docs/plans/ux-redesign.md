# UX redesign

Goal: a neutral, task-first interface that follows Apple's interface guidelines and progressive disclosure, works in Safari and as a Home Screen web app, and makes connected-account management and URL actions simple. Findings, mocks and rationale live in `docs/ux/review.md` and `docs/ux/mocks.html`. This file tracks progress across agent sessions.

Project rules from `AGENTS.md` apply: greenfield (no backward-compatibility work, so the legacy `#url=` link support can be removed), documentation uses soft line breaks, and finished plans move their decisions into the canonical docs and their validation into `docs/checkpoints/`.

## Decisions

- Neutral UI: system font, system colours, no logo, shadows, gradients, emoji or avatars; dark mode follows the device with no toggle.
- Text-only post card; no remote images (the CSP stays `default-src 'none'`).
- The Shortcut card sits under the primary control unless the person arrived from the Shortcut (`?url=` or `?via=shortcut`) or dismissed it.
- Legacy `#url=` links are dropped (greenfield).

## Todos

- [x] Phase 0: view-state model, task titles, system tokens, automatic dark mode
- [x] Phase 1: account chip, accounts sheet, confirmed removal, session-ended state
- [x] Phase 2: post/profile card, hidden URL field, Paste loads at once, Shortcut card rules
- [x] Phase 3: action button states, no double send, inline confirmation, automatic refresh and retry on 401, Reply sheet, Undo only if the server exposes the activity ID (implemented, hidden when the `Location` header is unreadable)
- [x] Phase 4: structured errors, sign-in fallback without clearing the field, storage-blocked screen
- [x] Phase 4b: manifest, icons, safe areas, standalone detection, `?via=shortcut` in `FediTap.cherri`
- [x] Remove legacy `#url=` handling
- [ ] Review against the plan and the security checks
- [x] Browser test of the Phase 3 to 4b flows in light, dark and 320 px width (Playwright against the mock server); Phase 0 to 2 flows were tested earlier. A final full pass is still open.
- [ ] Real-device test of the Home Screen OAuth round trip (owner)
- [ ] Align style.css and index.html with docs/ux/components.css (shared components). Today the app still uses tinted `.card` and `.banner` boxes, a 2x2 grid of tile buttons for the actions and its own token names (`--card`, `--secondary`, `--sep`); the components use grouped lists with button rows, footer status and errors, and `--surface`, `--label-2`, `--separator`.

## Open items for the owner

- Rebuild and sign `FediTap.shortcut` after the `FediTap.cherri` change (`?via=shortcut` for the no-link launch).
- Decide whether the Home Screen app is a fully supported path once the device test is done.
- Confirm Undo support with the WordPress ActivityPub plugin (activity ID exposed through CORS).
- Confirm the WordPress plugin sends `Access-Control-Expose-Headers: Location` on outbox responses; until then Undo never appears there.
- Real-device checks that could not be done in the dev server: the Home Screen install (icon, name, status bar colour, launch background is light only because a manifest cannot switch with the colour scheme), the standalone safe areas, the system sheet for server consent, and `navigator.standalone` on iOS.
- Decide whether a full-colour or lettered icon is wanted; the current icons are flat blue squares by request.
