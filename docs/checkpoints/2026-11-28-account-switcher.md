# One-tap account switcher checkpoint (2026-11-28)

Evidence for replacing the header's account dropdown. The rules now live in [`../ux/components.md`](../ux/components.md#header-and-accounts) and [`../development.md`](../development.md#account-storage); the exploration is [`../research/account-switcher-mocks.html`](../research/account-switcher-mocks.html); open items are in [`../roadmap.md`](../roadmap.md).

## Changed

- The current account leads the header and opens the Accounts sheet; the others are avatar buttons, two and "+N" from five accounts. The product mark shows only while signed out.
- Avatars are the account's own photo, else initials on a stored colour. The CSP is now `img-src 'self' https:`.
- The sheet switches as well as removes, marks the current account, and closes with Done or the "×" at the top.
- A switch says "Switched to user@host." and no longer sends an account that needs reconnecting to its server by itself.
- "Acting as @…" moved above the action buttons.

## Owner decisions

Only the current account is spelled out; no host badge, no logo when signed in, no two different dropdowns, no setting for photos, Done kept beside the "×". Rejected along the way: a badge under every circle, a "+" circle, a native `select` or group dropdown for overflow, a separate menu for the current account, a scrolling strip, circles always on their own line, and a fixed circle order.

## Evidence

Headless Chromium against the mock server: `svelte-check`, the build and `tools/scripts/check.js` pass, `npm test` passes (121 tests) and `npm run e2e` passes (61 tests: normal, fast, slow and built). Biome passes on `src`, `tools`, `e2e` and the config files; `biome check .` stops on the nested configurations under `.claude/worktrees/`, which are unrelated.

- New browser tests cover circle order and "+N", the saved order after a reload, a double tap, photos and the initial fallback (no photo and a photo that fails to load), switching to an account that needs reconnecting, 200% root font size at 320 px with no sideways scroll, and both ways of closing the sheet.
- The built page loads an account photo with no Content Security Policy violation.
- Screenshots looked at: 390 px and 320 px, light, dark and forced colours, the sheet and its remove question, and 200% root font size. The last showed the sheet title breaking letter by letter, fixed by letting the "×" wrap under the title and account names under their avatar.

## Not verified

- A real phone, Safari and Firefox.
- VoiceOver and TalkBack: names, focus and the announcement are asserted in the DOM only.
- The system's own enlarged text; only the root font size was raised.
- A real server's photos, and a server that sends none over HTTPS.

## Follow-up the same day: forms and intro

- Paste is a small button inside the field, now in the account field too, where it fills and focuses Connect without submitting.
- Rows use one 0.5rem gap, so Connect and Load sit as close to their fields as Remove does to its account.
- The signed-out intro is one sentence (owner's wording, with "Fediverse" capitalised) with the device's share symbol.
- Evidence: Biome on the same paths, `svelte-check`, the build and static checks, 121 unit tests and 64 browser tests pass; the 20 guidance, sign-in and CSP tests passed again after the last style reorder. New tests cover pasting an account, the equal gaps and the Paste tap target. Screenshots at 390 px and 320 px; README screenshots and the link preview retaken. Pasting is not tried on a real iPhone.

## Follow-up the same day: storage statement and tinted buttons

- The help text under the signed-out connect form says account details are saved only in this browser, then names any ActivityPub API server (including the WordPress plugin) before Mastodon.
- Pasting a whole HTTPS link into the link field by keyboard or menu opens it, like the Paste button; other text only edits the field. Tested with the keyboard in headless Chromium, not with a phone's paste menu.
- Buttons are tinted and keep their border, so they no longer look like fields. Disabled is fainter, pressed darker (a destructive button inverts), an action that is on has a faint accent tint, and the header's accounts and the sheet's "×" stay bare.
- The status pill's text was invisible under forced colours, before this change too; it is now plain text with an outline there.
- Evidence: contrast computed from the token mixes is at least 15:1 for button text, 4.6:1 for red and accent labels in every state, and 3.3:1 for a field's border against the page. Screenshots at 390 px in light, dark and forced colours (post, Accounts sheet, remove question, reply sheet, loading). README screenshots and the link preview retaken. Not looked at on a real phone.
