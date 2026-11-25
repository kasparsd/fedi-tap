# Loading feedback checkpoint (2026-11-18)

Evidence for the single loading pattern. The rules are in [`../ux/components.md`](../ux/components.md) (Loading); the code is `runTask` in `src/state.svelte.js`, `BusyLabel`, the header progress bar and `src/lib/signal.js`.

## Before

Measured against the dev server (400 ms mock delay, 390 px wide, 150 ms after the press).

- Opening a link: the field went read-only, the filled Open button turned grey ("Opening…") and a 14 px grey "Loading…" line appeared. Two faint messages for one task.
- Opening a second link while a post was loaded: the post vanished at once, the title flipped Post → Open a link → Post and the page collapsed to about half its height and jumped back. The worst case.
- Like and Repost: only the button label changed, every button greyed, the group reflowed when "Liked" and a new Undo appeared.
- Token renewal only changed a status line. A slow or stuck server showed nothing for up to 20 s, with no way out.

## After

- Browser checks (headless Chromium at 390 px, against the mock server at normal, instant and 6.5 s responses): 64 checks pass, 20 of them for this change and 6 for a Mastodon-API account. The earlier 38 end-to-end checks and 25 of the 27 token, sign-in and cross-tab checks still pass; the other two read button text that now includes hidden width-reserving text and are stale test code.
  - The progress bar, the placeholder and the "Opening…" label appear after 150 ms; with instant responses none of them is ever added to the page.
  - The busy button keeps its fill and its width; Like keeps the same width idle, sending and done.
  - Opening a second link keeps the old post, dimmed and inert, with the same title, and the Shortcut panel below does not move.
  - After 5 s the slow notice appears, with Cancel for opening a link (Cancel leaves a clean form, no error, "Cancelled.", and the same link opens afterwards) and without it for a send.
  - A link that fails to open clears the post and shows the error.
- `npm run validate` passes after rebasing on the Mastodon merge (76 unit tests, svelte-check with no warnings, build and static checks).

## Differences from the proposal

- While another link opens, the loaded post stays dimmed and inert instead of being swapped for a placeholder; the placeholder is used only when nothing is shown yet. It avoids guessing a height, and it is safe because the post cannot be clicked while it waits and is cleared when the new link fails.
- The Undo button's slot is not reserved. It appears after a successful send, where the new button is the confirmation; the busy and done labels keep their widths.
- No visible "Loading…" status line for opening a link. The pressed button, the progress bar and the placeholder carry it, and screen readers get a hidden line.

## Not checked

- Slow-network behavior on a real device; the Mastodon-API Undo and Reply flows under a slow server (only Like and open were exercised).
- Real servers: the checks used the mock.
