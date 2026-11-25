# Modern Web Guidance review

Planning input, 2026-11-25. FediTap was checked against Google Chrome's [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) (v1.0.2, released 2026-11-23). The review read about 75 of the 197 guides in full: every guide that touches what the app does. The rest cover features FediTap doesn't have (carousels, tables, drag and drop, passkeys, WebGL, built-in AI, web components, Wasm). Baseline statuses are as the guides state them.

## The resource

The resource is an agent skill: a `SKILL.md` plus 197 Markdown guides grouped by area (accessibility, CSS, forms, HTML, JS, performance, privacy, PWA, security, UI components and behaviours, visual design, WebMCP). Chrome, Edge, Firefox and MDN maintain it, and evals prune advice that models already know. Each guide gives DO and DON'T rules, short code examples and Baseline data with the fallback to use.

How an agent uses it: the skill tells the agent to run `npx -y modern-web-guidance@latest search|retrieve|legacy-scan` before any HTML, CSS or client JS work. The CLI is not in the GitHub repository. It is fetched from npm, unpinned, on every call.

What it's worth for this project:

- **High signal for FediTap's kind of app.** The most useful guides here were the dialog, forms, accessibility, dark mode and security ones. Between them they found real bugs, listed below, that the existing e2e suite doesn't catch.
- **It assumes Baseline Widely available unless the project sets a browser policy.** FediTap has none written down, so the guidance can't say when a fallback is needed. See [Browser support policy](#browser-support-policy).
- **Some advice conflicts with house rules and needs filtering.** These include gradients and masks for spinners, carets and fades; `data:` URIs for icons; polyfills loaded from a CDN; and transitions on dialogs and disclosures. The first three break the CSP, and gradients and transitions also break the "no decoration, no transitions" rules in [components.md](../ux/components.md). The guides follow web best practice, not this project's choices.
- **Running it through npx is a supply-chain and permission question.** An unpinned `@latest` download runs code on every agent call, and this session's sandbox blocked it. The guides are plain Markdown under Apache-2.0, so another option is to read a pinned checkout, or vendor the few guides that matter. Don't install it as a project dependency; it's an agent tool.
- **Verdict:** worth using as a checklist when touching dialogs, forms, CSS or security. It isn't something to run on every change.

## What the app uses today

Platform features already in use, most of which the guides endorse as-is:

- **HTML.**
  - Native `<dialog>` opened with `showModal()`, with a hand-written backdrop click handler (`Sheet.svelte`).
  - `<details>` disclosures, which stay searchable with find-in-page.
  - `inert` on the dimmed post while another link loads.
  - Real `<form>` elements with `label for`.
  - `aria-pressed`, `aria-busy`, `aria-disabled` and `aria-haspopup`.
  - Visually hidden `role=status` and `role=alert` live regions.
  - `lang` and a viewport meta that doesn't block zoom.
- **CSS.**
  - System colours with `color-scheme: light dark`, `light-dark()` and `color-mix()`.
  - `accent-color`, logical properties and `rem` sizing.
  - `:has()`, `:is()`, `:where()` and `:focus-visible`.
  - `dvh`, safe-area insets with `viewport-fit=cover`, the `lh` unit, and grid with `auto-fit`.
  - `prefers-reduced-motion` on all three animations.
  - Inline SVG icons drawn in `currentColor`.
- **JS.**
  - `fetch` with `AbortSignal.timeout` and `AbortSignal.any`, and streaming `TextDecoder` with a size cap.
  - `crypto.subtle` for PKCE, `navigator.locks` across tabs, and `localStorage` and `sessionStorage`.
  - A `storage` event listener.
  - `navigator.clipboard.readText`.
  - `DOMParser` to turn remote HTML into text, and `Intl` date formatting.
  - `history.replaceState`.
  - Feature detection, not UA sniffing.
- **Security and privacy.**
  - A strict meta CSP (`default-src 'none'`, `script-src 'self'`, no inline code, no `data:`), enforced by `tools/scripts/check.js`.
  - A Biome rule that bans HTML sinks.
  - `referrer: no-referrer` and `rel="noopener noreferrer"` on outbound links.
  - Origin checks done by comparing `URL.origin`.
  - No third-party resources and no analytics.
- **PWA.** A manifest with a stable `id`, `share_target`, `shortcuts` and maskable icons. There is no service worker.

## Findings

### Bugs

1. **Controls and announcements behind an open sheet are dead.**
   - Cause: `#slow` (the "Still waiting…" pill and its Cancel) and `#task-announce` live in `<main>`, which `showModal()` makes inert. The Toast pill also renders behind the backdrop.
   - Effect: when sign-in from the Accounts sheet stalls, Cancel can't be pressed. "Sending…" for a reply is never announced.
   - Guides: accessibility, persistent-toast-notifications ("Don't add live-region updates to inert DOM").
   - Fix: render the slow notice and announcement inside the open sheet, as components.md already says ("Statuses inside a sheet stay in the sheet").
2. **The Paste button's focus ring is clipped.**
   - Cause: `.field { overflow: hidden }` cuts off the outward 2px outline.
   - Fix: `.field > button:focus-visible { outline-offset: -2px }`.
   - Guides: single-line-overflow, accessibility.
3. **A busy sheet can still be closed.**
   - Android back fires only `cancel`. Chrome stops honouring a repeated `preventDefault()` without user activation, so a second back press closes the sheet mid-send.
   - A text-selection drag in the reply textarea that ends on the backdrop also closes the sheet.
   - Fix: `closedby={app.busy ? "none" : "any"}` on the dialog, and keep the `cancel` guard. Keep the click fallback only where `closedBy` is missing, and make it require both press and release outside the dialog.
   - `closedby` is Limited availability: not in Safari.
   - Guides: dialog, light-dismiss-a-dialog.
4. **The primary button label can be invisible on Safari 16 to 17.4.**
   - `--accent: light-dark(…)` is invalid there, so `.primary` loses its background but keeps `color: Canvas`.
   - The support check (`support.js`) lets these browsers in.
   - Fix: declare a plain `--accent` and a `prefers-color-scheme: dark` override before the `light-dark()` line, or raise the support check.
   - Guide: dark-mode ("MANDATORY: Fallback for browsers without light-dark support").
5. **Safari and Firefox may announce empty required fields as invalid on first focus.**
   - Fix: set `aria-invalid="false"` instead of leaving the attribute absent on `#post-url` and `#account-input`. The CSS reads only `="true"`, so nothing visual changes.
   - Guides: accessible-error-announcement, required-field-feedback.
6. **Native validation runs alongside the app's own error card.**
   - Neither form has `novalidate`, so the browser bubble ("Please enter a URL") fires before the app's own check, and the field gets no `aria-invalid` outline.
   - Fix: add `novalidate` to `#lookup` and `#sign-in`, keep `required` for semantics, and handle the empty case in code.
   - Guide: forms.
7. **Timeouts are reported as network or CORS errors.**
   - No code checks `error.name === "TimeoutError"`, so a 20 s timeout says the server couldn't be reached.
   - For writes that's misleading: the action may already have gone through.
   - Where: `token.js`, `mastodon/api.js`, `activitypub/activity.js`.
   - Guide: js ("check for both `'TimeoutError'` and `'AbortError'`").
8. **The "View on host" link is about 20px tall.** `.card .post footer > a { min-block-size: 0 }` breaks the 2.75rem target rule and WCAG 2.5.8 (24px). Guide: form-factor-adaptation.
9. **Three responses skip the `readJson` size cap.** `getJson` (`http.js`), `requestToken` (`token.js`) and the Mastodon profile fetch (`mastodon/signin.js`) call `response.json()` directly. This one isn't from a guide; the review found it on the way.

### Worth doing

- **Dedicated origin.**
  - `kasparsd.github.io` is shared by every Pages project the owner publishes. So stored tokens and `script-src 'self'` are scoped to all of them, not just FediTap.
  - Web App Origin Migration needs same-site origins, and `github.io` is a public suffix. Moving to a custom domain later means users install again and sign in again.
  - Decide while the project is greenfield. Guides: privacy, security, migrate-web-app-origin.
- **Clickjacking.**
  - `frame-ancestors` is ignored in a meta CSP, and Pages can't send `X-Frame-Options`.
  - Like, Repost and Follow are one-tap authenticated actions, so refuse to render them when `window.top !== window.self`.
  - Guide: security (the JS guard is this review's workaround, not the guide's).
- **Trusted Types.**
  - Add `require-trusted-types-for 'script'` plus a `trusted-types` allowlist to the CSP. Baseline since 2026-02.
  - First confirm the policy name Svelte's runtime uses for its template `innerHTML`.
  - Then move `text.js` off `DOMParser.parseFromString`, which is itself a sink. Use `Document.parseHTML()` (Limited availability, not in Safari) with a narrow fallback policy.
  - Test locally, because a meta CSP can't run in report-only mode.
- **Tighten `form-action`.** Both forms call `preventDefault`, so `form-action https:` can become `'none'`.
- **Scroll containment under sheets.** Add `dialog:modal { overscroll-behavior: contain }` and `dialog::backdrop { overflow: hidden; overscroll-behavior: contain }`. This is progressive enhancement, and the app should keep not locking `body`.
- **Forced colours.**
  - The select caret is drawn with gradients, which forced colours removes. Restore `appearance: auto` under `@media (forced-colors: active)`.
  - Give `.pill` a transparent border so it keeps an edge.
  - Also fix the comment in `app.css` that says the CSP allows no images. `img-src 'self'` does allow a same-origin SVG, which would also remove the gradient exception.
- **Reply sheet as a real form.**
  - Use `<form method="dialog">` with a submit Send, as components.md's own `.sheet` example shows.
  - Use `readonly` or `aria-disabled` while sending instead of `<fieldset disabled>`, which drops focus.
- **Toggle names.** `aria-pressed` plus the label change to "Liked" says the state twice. Keep the accessible name fixed and show "Liked" visually, or drop `aria-pressed`.
- **"Manage accounts" out of the account `<select>`.** Choosing an option shouldn't open a dialog. Keep the native select, since the iOS picker is worth keeping, and add a separate button.
- **Keyboard hints.**
  - `enterkeyhint="go"` on both inputs.
  - `autocorrect="off"` and `inputmode="email"` on the handle field.
  - `name` on `#post-url` and `#reply-text`.
- **Accounts sheet focus.** Put `autofocus` on the input instead of moving focus there from script after `showModal()` has first landed on a destructive Remove button.
- **OS text scale.** Add `<meta name="text-scale" content="scale">`, and move the `font` shorthand from `:root` to `body` so the root font size isn't set. This conflicts with "Dynamic Type: not adopted" in components.md, so it needs the owner's decision.

### Optional polish

- **Fields that fit their content.** `field-sizing: content` on the reply textarea, with `min-block-size: 5lh`, and on the header select. Newly available.
- **Text and layout.** `text-wrap: pretty` on `p, li`, `scrollbar-gutter: stable`, and `overflow-wrap: break-word` on `body` with `anywhere` only on links and handles.
- **Page title.** Update `document.title` from `app.title`.
- **Loading announcement.** Gate `#task-announce` on `showProgress`, which is what components.md already says.
- **Focus scroll.** Drop `preventScroll` in `focusFirst`, or check it on a phone with the keyboard open.
- **Pill and focus.** Add `scroll-padding-block-end` while a pill shows, so focused controls scroll clear of it.
- **VoiceOver repeats.** It skips a message identical to the previous one, so vary repeated status text.
- **Card markup.** Put `.card` on the `article` itself rather than a wrapper `div`.
- **Android install.** A `beforeinstallprompt` install button (Limited: Chromium only). This fits [android-install.md](../plans/android-install.md).
- **Preconnect.** `preconnect` to the current account's server at startup.
- **Errors.** Carry `{ cause }` on `Problem`.
- **CSS tidy-up.** Write motion styles as `no-preference`-first, and merge the duplicate `.list > li` rule and the off-scale `0.25rem` gap.
- **WebMCP experiment.** Declarative WebMCP on the lookup form (`toolname`, `toolautosubmit`, since it is read-only). It needs `name="url"`, and the submit handler must read `FormData`. Behind a flag in Chromium 146+.

### Checked and not adopted

- **Encrypting stored tokens.** The page must decrypt them to use them, so any same-origin script can too. Origin isolation is the real fix.
- **Passkeys and quick sign-in.** FediTap isn't a relying party; the user's server is.
- **Sanitizer and `setHTML`.** Remote HTML is never rendered, only turned into text, which is stricter.
- **Customizable select (`appearance: base-select`).** It loses the native iOS picker.
- **Invoker commands (`commandfor`).** The sheets are driven by Svelte state, and the polyfill needs a CDN.
- **Animations.** Top-layer entry and exit animations, `::details-content` slides, `interpolate-size` and view transitions conflict with "no transitions", and they would be polish only.
- **Gradient spinner and `contrast-color()`.** The accent background is fixed and already passes contrast.
- **Temporal.** Post dates are instants, which `toLocaleDateString` already handles correctly.
- **Speculation rules, Scheduler API, INP and RUM guides.** These don't fit a single-page app with no analytics.
- **Header-only protections.** `Connection-Allowlist`, COOP, CORP, `Permissions-Policy`, `Clear-Site-Data` and Reporting can't be set on GitHub Pages.

## Browser support policy

The guides decide when to use fallbacks from a stated policy. A proposal for AGENTS.md, for the owner to confirm:

> **Browser support:** current Safari on iOS and macOS, and current Chrome, Edge and Firefox. Baseline Widely available features need no fallback. Newly available and Limited features are used only as progressive enhancement, with a CSS fallback or a short feature check, never a polyfill or extra dependency. The support check in `src/lib/support.js` must turn away browsers below that line.

Aligning `support.js` with the policy also settles the `light-dark()` bug above.
