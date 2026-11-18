# Android install and shortcuts

Goal: make ⁂tap feel native on Android. The Web Share Target already puts the app in the share sheet; this plan adds the manifest metadata Chrome uses for icons, long-press shortcuts and the install prompt, and documents the flow. This file tracks progress across agent sessions.

Project rules from `AGENTS.md` apply: greenfield, soft line breaks in docs, and a finished plan moves its decisions into the canonical docs and its validation into `docs/checkpoints/`.

## Context

- `public/manifest.webmanifest` has `share_target` (GET, `title`, `text`, `url`) but no `id`, `shortcuts`, `screenshots` or a dedicated maskable icon (it reuses `icon-512.png`, which Android's adaptive masks will crop).
- `run()` in `src/state.svelte.js` already extracts the first `https://` link from `text` when `url` is empty, so apps that put the link in `text` work. Only `https` is accepted.
- A PWA cannot offer a Quick Settings tile, a widget, Direct Share entries or capture links to other origins. Those need a native app and are out of scope.
- Share targets work in Chrome, Edge, Brave and Samsung Internet. Firefox for Android is not reliable and should not be promised.

## Decisions

- Long-press shortcuts reuse the existing page: they open `./?via=shortcut-paste`, which the app handles like pressing **Paste** (clipboard read needs a user gesture, so the app shows the focused Paste button rather than reading silently).
- `via` is already stripped from the address after load, so shortcut params leave no trace in history.
- No native wrapper (TWA) for now: it adds a Play Store listing but no new share or shortcut ability.

## Todos

- [x] Add `id` (`"./"`) and `categories` to the manifest
- [x] Maskable icon: no new file needed. The glyph is centred on a full-bleed background and sits inside the central safe circle, so `icon-512.png` already masks cleanly
- [x] Add the "Paste a link" shortcut (`./?via=shortcut-paste`); no second entry
- [x] Handle `via=shortcut-paste` in `run()`: focus the Paste button (no automatic clipboard read); `via` is stripped from the address
- [x] Unit test link extraction from `text` (`sharedLink` in `src/lib/url.js`)
- [x] README: Android step and supported browsers
- [-] `screenshots` for the richer install prompt: dropped for now, optional polish
- [ ] Real-device check on Android Chrome: install, share sheet entry, share from a Fediverse app and from the browser, long-press shortcut, icon shape (owner)
- [ ] When done: move decisions into canonical docs, record the device check in `docs/checkpoints/`, delete this plan
