# Modern Web Guidance checkpoint (2026-11-25)

Evidence for the fixes taken from [the review](../research/modern-web-guidance.md). The rules now live in [`../ux/components.md`](../ux/components.md) and [`../development.md`](../development.md) (Content Security Policy); open items are in [`../roadmap.md`](../roadmap.md).

## Fixed

- **Sheets.** The slow notice, its Cancel, the announcement and the toast render inside an open sheet (`Notices.svelte`). `closedby` is `any` idle and `none` while busy, so a repeated back gesture can't close a busy sheet; the click fallback needs press and release outside. Scroll over the backdrop is contained.
- **Paste focus ring** is drawn inside the clipped field. **`--accent`** is a plain value with a dark override, so the primary button has a background where `light-dark()` is unknown. **Forced colours** get the native select arrow and a bordered pill. The "View on host" link is a full touch target again.
- **Forms.** Both inputs say `aria-invalid="false"` until there is an error; both forms are `novalidate`, so an empty or malformed entry gets the page's own card (this also closes the "Please enter a URL" item in the UI consistency plan). `enterkeyhint`, `autocorrect`, `inputmode` and `name` are set. The reply sheet is a `<form>` with a submit Send.
- **Network.** A timeout says the server took too long, and for a send that it may still have gone through; it is no longer reported as a CORS or offline failure. Every JSON read goes through the size cap (`getJson`, the token response, the Mastodon profile).
- **Security.** `form-action 'none'`; Trusted Types required (`svelte-trusted-html`, `feditap-plain-text` only); server HTML is parsed with `Document.parseHTML()` where it exists; a page that is framed draws no controls.
- **Small.** The tab title follows the screen; the loading announcement waits for the 150 ms progress delay; `field-sizing: content` on the reply box; `scrollbar-gutter: stable`; `text-wrap: pretty`; the false "CSP allows no images" comment is corrected.

## Evidence

Headless Chromium (Chrome 158) at 390 px against the mock servers: `npm run validate` passes and `npm run e2e` passes, 54 tests (normal, fast, slow and built), 11 of them new, plus 3 new unit tests (`networkProblem`). Screenshots at 390 px and 320 px, light and dark, of the signed-out screen, a loaded post with the Paste button focused, the reply sheet with seven lines typed (the box grows) and the Accounts sheet.

- The built page throws a `TypeError` when a plain string is given to an HTML sink, and walks every screen with no Trusted Types violation.
- Opening the hostile post under the policy produces only `script-src-attr` reports for the markup's own handlers, in the old `DOMParser` path too; nothing runs and the excerpt is one text node.
- In the slow project (6.5 s), signing in from the Accounts sheet shows "Still waiting…" with a working Cancel inside the sheet and none in `main`; Escape twice leaves a busy sheet open; a reply being sent is announced in its sheet and the sheet closes when it ends.
- A frame around the page shows only the refusal, with no `main` and no buttons.

## Not verified

- Safari (iOS) and Firefox: `closedby` fallback, `field-sizing`, `Document.parseHTML()` missing (the `DOMParser` plus policy path was exercised by hand against the built CSP, not through the app), and VoiceOver announcing the sheet notices. Chrome has all of them natively.
- Forced colours was reasoned from the guide, not rendered.
