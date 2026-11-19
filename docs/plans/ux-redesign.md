# UX redesign

Goal: a neutral, task-first interface that follows Apple's interface guidelines and progressive disclosure, works in Safari and as a Home Screen web app, and makes connected-account management and URL actions simple. Findings, mocks and rationale live in `docs/ux/review.md` and `docs/ux/mocks.html`. This file tracks progress across agent sessions.

Project rules from `AGENTS.md` apply: greenfield (no backward-compatibility work, so the legacy `#url=` link support can be removed), documentation uses soft line breaks, and finished plans move their decisions into the canonical docs and their validation into `docs/checkpoints/`.

## Decisions

- Neutral, native-web UI: semantic elements styled from system fonts and colours (`style.css`, described in `docs/ux/components.md`), no iOS look-alike controls, no logo, shadows, gradients, emoji or avatars; dark mode follows the device with no toggle.
- Text-only post card; no remote images (the CSP stays `default-src 'none'`).
- The Shortcut card sits under the primary control unless the person arrived from the Shortcut (`?url=` or `?via=shortcut`) or dismissed it.
- Legacy `#url=` links are dropped (greenfield).

## Todos

- [x] Phase 0: view-state model, task titles, system tokens, automatic dark mode
- [x] Phase 1: account switching and removal (now the header dropdown and Accounts dialog), confirmed removal, session-ended state
- [x] Phase 2: post/profile card, hidden URL field, Paste loads at once, Shortcut card rules
- [x] Phase 3: action button states, no double send, inline confirmation, automatic refresh and retry on 401, Reply sheet, Undo only if the server exposes the activity ID (implemented, hidden when the `Location` header is unreadable)
- [x] Phase 4: structured errors, sign-in fallback without clearing the field, storage-blocked screen
- [x] Phase 4b: manifest, icons, safe areas, standalone detection, `?via=shortcut` in `fedi-tap.cherri`
- [x] Remove legacy `#url=` handling
- [ ] Review against the plan and the security checks
- [x] Browser test of the Phase 3 to 4b flows in light, dark and 320 px width (Playwright against the mock server); Phase 0 to 2 flows were tested earlier. A final full pass is still open.
- [ ] Real-device test of the Home Screen OAuth round trip (owner)
- [x] Adopt the component stylesheet as `style.css` and align `index.html` and `app.js`: semantic markup, action buttons in a `.group`, `dialog.sheet`, plain-text alerts and statuses, copy trimmed to the rules in components.md, review findings fixed in `app.js` (see below). Verified in Playwright in light, dark and 320 px.

## Decisions made while adopting the stylesheet

- Undo is per action: a plain button next to the finished action (Undo like, Undo repost, Undo follow).
- Sent actions are remembered by account, target and kind for the page session, so a send that finishes after the person moved to another link is still recorded and cannot be sent twice. Reload resets them.
- A send that ends ambiguously (timeout, dropped connection, HTTP 5xx or 408) says it may already have gone through and adds no retry button; the action button itself is the retry.
- Posts need the author's actor to prove its own id; otherwise the card shows only the host and Follow is hidden. A returned object must live on the opened link's origin (or name that address in `url`).
- The theme-color meta tags are gone: Safari takes the colour from the page background, which is now a system colour.
- A reply draft survives a session ending: the sheet stays open and "Sign in" stores the draft in session storage for the return trip.

## Decisions: inputs stay, buttons are buttons

- An input that has been shown is never hidden or disabled: the link field stays in the ready, loading and loaded states and the account field in every sign-in state and in the add-account sheet. While a request runs the input is read-only and its buttons `aria-disabled` (so value and focus survive); a failure prints below the input (`aria-invalid`, `aria-describedby`) and the value is editable at once. There is no loading card and no "Change link"; the stale post is removed while a new link loads and when it fails.
- Paste is a button inside the link field (`.field`); the submit button (Continue, Open) is one row with the input, which shrinks at 320 px.
- Like, Repost, Reply, Follow and Undo are ordinary buttons in a wrapping `.group`; a finished action is disabled and filled (`aria-pressed`). The "list row that is really a button" and the `.link` button style are retired; two styles remain, a button and a real link. "Open another link" is gone. Failures add a button only when there is a different way forward (Use profile link, Sign in), since the primary button next to the field is the retry.

## Decisions: header and account dropdown

- Every screen has the same header: the "⁂tap" mark (a plain link, aria-label "FediTap") and, once an account is stored, a native "Account" dropdown whose last option is "Add account". The account chip and the accounts sheet are gone; the Accounts dialog (stored accounts with Remove, plus the add-account row) opens only from that last option.
- A short summary paragraph shows above the sign-in form only while no account is stored. The Shortcut panel ("Add Shortcut for iOS") and the Add to Home Screen disclosure show on iOS only, never when signed out.
- Labels follow `docs/research/fediverse-ui-conventions.md` (Like and Repost kept). Replies are public with a Mention of the author, and the reply counter and 500 limit are gone. The expired-sign-in screen has one primary button, Sign in.

## Open items for the owner

- Rebuild and sign `Open in Fediverse.shortcut` after the `fedi-tap.cherri` change (`?via=shortcut` for the no-link launch).
- Decide whether the Home Screen app is a fully supported path once the device test is done.
- Confirm Undo support with the WordPress ActivityPub plugin (activity ID exposed through CORS).
- Confirm the WordPress plugin sends `Access-Control-Expose-Headers: Location` on outbox responses; until then Undo never appears there.
- Real-device checks that could not be done in the dev server: the Home Screen install (icon, name, status bar colour, launch background is light only because a manifest cannot switch with the colour scheme), the standalone safe areas, the system sheet for server consent, and `navigator.standalone` on iOS.
- Decide whether a full-colour or lettered icon is wanted; the current icons are flat blue squares by request.
