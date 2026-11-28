# FediTap UX review and improvement plan

Scope: `index.html`, `app.js`, `style.css` at commit `f571c53`. Visual mocks of every flow below are in [`mocks.html`](mocks.html) (open it in a browser; each screen is the real page at phone width in a plain frame, follows the device's light/dark setting and has no toggle), built only from the shared components in [`components.css`](components.css) and described in [`components.md`](components.md). Mock IDs such as **B3** refer to screens there.

Design direction (updated): neutral and task-first. No logo, brand colour, gradient, shadow, emoji or avatar decoration (the connected accounts' avatars are controls, see [components.md](components.md)); system fonts and system colours only; dark mode follows the device automatically with no toggle; screens are titled by what the person is doing ("Sign in", "Open a link", "Post", "Accounts"), not by a product name. The name appears only where the system requires it (page `<title>`, Home Screen name). The app must also work well when added to the Home Screen (section 3a).

Design lens: the ideas of Apple's Human Interface Guidelines applied to a native-looking web page (clarity and deference; one prominent action; dialogs for secondary tasks and destructive confirmation; 44 px targets; system fonts and colours; light/dark), not iOS look-alike controls, and progressive disclosure (show the one thing the person came to do, reveal the rest on demand).

## 1. Summary of findings

Ranked by impact on the two flows you named.

| # | Finding | Evidence |
|---|---------|----------|
| 1 | **A pending shared link is invisible before sign-in.** `?url=` is stored, but `#fediverse-actions` (which holds the URL field) stays hidden until an account exists; the only hint is "Sign in to use this link." | `app.js:354`, `app.js:492`, `index.html:26,45` |
| 2 | **Account management is one overloaded area.** The picker, "Manage accounts" toggle, the sign-in form (used to *add* an account), help text and the destructive "Remove selected account" all share one fieldset. Adding a second account is undiscoverable; the section title "Connect an account" never changes. | `index.html:16-44`, `app.js:360-365` |
| 3 | **Removal is immediate, unconfirmed and mislabelled.** It lives inside the sign-in form, acts on whichever account the picker shows, has no confirmation and no hint that the server-side grant is not revoked. | `app.js:654-670` |
| 4 | **The loaded URL shows no content.** (Mock B3: post with author, handle, text, source and date.) After lookup the person sees only "Post on example.com" plus four equal buttons. They cannot confirm it is the right post, who wrote it, or which account will act. | `app.js:509-519` |
| 5 | **Action feedback is weak.** (Mocks B4, E3, F2: a done label such as “Liked” plus status text under the actions.) One status line at the bottom of the section; no per-button state (Liked/Reposted/Following); nothing stops a duplicate Like; no undo. | `app.js:633-637` |
| 6 | **The URL field dominates even when the link came from the share sheet.** Field, Paste and Find stay on screen after the link is already loaded. | `index.html:47-59` |
| 7 | **The Shortcut is mispositioned.** It is the best way to use the tool, yet it sits below everything, always visible, with a generic heading, even for people who already installed it. It should sit directly under the form for people who did not arrive from it, and disappear for people who did. | `index.html:80-87` |
| 8 | **Errors are one line of raw text.** HTTP codes, CORS and "API off" are not actionable in place and the CORS help link appears only for one message. | `app.js:521-551` |
| 9 | **Expired token costs a re-tap.** On 401 the app refreshes then tells the person to choose the action again. | `app.js:476-479` |
| 10 | **No app identity or state title.** The H1 is a sentence of instructions, not a title; the screen does not say whether you are signed in. | `index.html:14` |
| 11 | **Reply has no context.** No character count, no explicit "Public" visibility treatment, no view of the post being replied to. | `index.html:70-74` |
| 12 | **Sign-in field mutates silently.** Failed WebFinger swaps the input to `type=url`, clears it and changes the label. | `app.js:146-153` |
| 13 | **No way back.** After acting, nothing offers to return to the source app or share another link. | n/a |

Strengths to keep: 44 px minimum targets, system colours with `color-scheme: light dark`, correct `role=status/alert`, disabled-while-busy fieldsets, no tracking, strict CSP, per-account token refresh under a Web Lock.

## 2. Interaction inventory (current behaviour)

### Launch states
| ID | Trigger | What happens today | Gap |
|----|---------|--------------------|-----|
| L1 | Open page, no params, no accounts | Instruction H1, "Connect an account" form, shortcut download | Nothing to do except sign in; download competes |
| L2 | `?url=` and no account | Link kept in the URL and `sessionStorage`; notice "Sign in to use this link." | Link itself is hidden (finding 1) |
| L3 | `?url=` and an account | Auto lookup, preview, actions | No content preview (4) |
| L4 | Legacy `#url=` / `hashchange` | Same as L3 via `readLegacyTarget` | Keep for old shortcuts; remove after adoption |
| L5 | OAuth callback success | "Account connected.", management closes, auto lookup of saved target | Fine; add confirmation that names the account |
| L6 | OAuth callback error or state mismatch | Error line in the account section | No retry button |
| L7 | Unsupported browser / blocked storage | Error line; form stays disabled | Dead end with no instructions |

### Account
| ID | Trigger | Today | Gap |
|----|---------|-------|-----|
| A1 | Submit handle or profile URL | "Looking up your account…" then redirect to the server | No progress detail |
| A2 | WebFinger fails | Input swaps to URL mode, cleared | Silent mutation (12) |
| A3 | Invalid input | `aria-invalid` plus error text | Message not tied visually to the field |
| A4 | Discovery errors (API off, CORS, origin mismatch, issuer mismatch) | One-line message; CORS link only for CORS | Not actionable (8) |
| A5 | Server consent page | External; target saved in `sessionStorage` | Fine |
| A6 | Change account in picker | Preview reset, re-lookup if a URL is present | Native `<select>` hides account state |
| A7 | "Manage accounts" | Reveals the sign-in form and Remove | Conflated (2) |
| A8 | Remove selected account | Deletes locally at once | Unconfirmed (3) |
| A9 | Account needs re-auth | Option suffix "(sign in again)", panel auto-opens, handle prefilled | Not discoverable from the action area |
| A10 | Change in another tab | `storage` event re-renders | Fine |

### URL and actions
| ID | Trigger | Today | Gap |
|----|---------|-------|-----|
| U1 | Edit URL | Clears preview and `?url=` | Fine |
| U2 | Paste | `clipboard.readText()`, fills, focuses Find | iOS shows a system paste prompt; copy explains nothing |
| U3 | Find | Proxy lookup, shows link and buttons | (4) |
| U4 | Like | Immediate send, "Like sent." | (5) |
| U5 | Repost | Immediate public Announce | Public effect not signalled |
| U6 | Reply | Reveals textarea, "Send reply" | (11) |
| U7 | Follow / Follow author | Immediate Follow | Label depends on target kind |
| U8 | Profile target | Like/Repost/Reply hidden | Only one action remains in a 4-column grid |
| U9 | 401 on send | Refresh, then error asking for a re-tap | (9) |
| U10 | Any task running | All fieldsets disabled | No spinner on the pressed button |
| U11 | Tap target link | Navigates away from the page | Should open in a new context or not at all |

### Other
S1 download Shortcut, S2 view source, S3 WordPress help link, S4 CORS help link.

## 3. Proposed information architecture

Three states instead of one long page. Each reveals only what the person needs next.

1. **Signed out** (A1–A4): app name, one sentence, one field, one button. Help and the shortcut are collapsed disclosures. If a shared link is pending, show it as its own section at the top.
2. **Ready** (D1): the accounts in the header; the link field with Paste inside it and a primary Open button beside it; the Shortcut card directly under it until added or dismissed.
3. **Link loaded** (B3): a post/profile block with author, excerpt and host; ordinary action buttons (Like, Repost, Reply, Follow) in a wrapping group with the status as text under them; the link field stays above the post with its value, so there is no "Change link". The accounts stay in the header.

Secondary tasks move into dialogs:
- **Accounts sheet** (G1): opened from the current account in the header; a list of stored accounts to switch to or remove, and the add-account row.
- **Reply composer** (E1): bottom-docked dialog with the account named, a character count and "Replies are public" in words.
- **Remove account** (G4): centred confirmation dialog with a destructive button and an explanation.

### 3a. Added to the Home Screen

What changes when the page runs as a Home Screen web app, and what iOS does not allow:

- **Manifest and metadata.** Add `manifest.webmanifest` (`display: "standalone"`, `start_url` and `scope` equal to the page URL, `background_color` and `theme_color` set to system-neutral values for light and dark via two `theme-color` meta tags with `media`), a 180 px `apple-touch-icon`, `apple-mobile-web-app-capable`, and `viewport-fit=cover`. The CSP is `default-src 'none'`, so add `manifest-src 'self'` and check that icons still load. A minimal, undecorated icon is the only branding the system requires.
- **Safe areas.** Pad with `env(safe-area-inset-*)` so content clears the status bar and home indicator; sheets and the bottom edge need this most. Avoid `100vh`; use `100dvh`.
- **No browser chrome.** There is no back button or URL bar, so every screen needs an in-app way back (Cancel, Done, the link field). Leaving the app (server consent, "Open original") opens a system sheet with a Done button.
- **Separate storage.** iOS keeps a Home Screen app's `localStorage` apart from Safari's. A person signed in in Safari is signed out in the Home Screen app, and vice versa. Sign-in screens in the Home Screen app say so in one line (mock I2).
- **The Shortcut opens Safari.** The Shortcut's open-URL action loads the page in Safari, not in an installed Home Screen app. So the share-sheet path (flows B, C) lives in Safari and the open-and-paste path (flow D) lives in the Home Screen app. Both must work on their own; both need a sign-in.
- **No Web Share Target on iOS.** The Home Screen app cannot appear in the share sheet by itself, so the Shortcut remains the sharing mechanism.
- **OAuth redirect risk.** Sign-in navigates to the server and back. In standalone mode iOS shows the server in a system sheet; returning through the redirect may land in Safari instead of the Home Screen app, leaving the sign-in on the wrong side of the storage boundary. This must be tested on a real device before committing to Home Screen as a supported path. Fallback: tell Home Screen users to sign in in Safari and use Safari, or use a popup-style flow if iOS allows it.
- **Adaptation.** Detect standalone with `matchMedia("(display-mode: standalone)")` or `navigator.standalone`; hide "Add to Home Screen" hints there. Use `touch-action: manipulation`, no hover-only states, and no pull-to-refresh dependence.

### 3b. When to show the Shortcut card

"Not from the Shortcut" cannot be inferred from `document.referrer`: the Shortcut's open-URL action sends no referrer, which looks identical to typing the address or opening a bookmark. Use explicit signals instead:

1. A shared link is present (`?url=` or legacy `#url=`): the person arrived from the Shortcut. Hide the card and remember it.
2. Change `fedi-tap.cherri` so the no-link launch opens `page + "?via=shortcut"` (the with-link launch already carries `?url=`). The app reads `via`, removes it from the address bar with `history.replaceState` (as it does for OAuth parameters), and remembers it. This needs the Shortcut rebuilt and re-signed, and existing installs without it keep seeing the card until they share a link once or tap "I already have it".
3. Remember "has the Shortcut" in `localStorage` (separate from the account store, e.g. `feditap.shortcut = "yes" | "dismissed"`). The card hides when set. Storage is per context, so Safari and the Home Screen app each learn separately.
4. In standalone mode the person cannot have arrived from the Shortcut, so the card shows (with the one-line note that links open in Safari) until dismissed.

No tracking is involved; nothing leaves the device.

## 4. Flows (mock references)

| Flow | Screens | Notes |
|------|---------|-------|
| A First run and sign-in | A1 welcome with Shortcut section, A2 looking up, A3 profile-link fallback, A4 server problem, A5 server consent, A6 signed in | Errors are plain text under the field, with a "Details" disclosure |
| B Share sheet, already signed in | B1 share sheet, B2 loading, B3 loaded, B4 after Like, B5 lookup failed | Shortcut hands over `?url=`; the field never appears |
| C Share sheet, signed out | C1 pending link plus sign-in, C2 returns to B2/B3 | Fixes finding 1 |
| D Open directly | D1 ready, D2 pasted and loading | Paste sits inside the link field, Open is the primary control |
| E Reply | E1 composer, E2 sending, E3 sent | Bottom dialog with text area, counter and "Replies are public" in words |
| F Profile target | F1 profile, F2 follow requested | Single Follow button |
| G Accounts | G1 account sheet, G2 switched, G3 edit mode, G4 confirm remove, G5 needs re-auth, G6 add account | Fixes findings 2 and 3 |
| H Edge cases | H1 storage blocked, H2 token refresh, H3 Shortcut section in Safari, H4 arrived from the Shortcut (no section) | |
| I Home Screen web app | I1 install from Share sheet, I2 first launch, I3 server consent sheet, I4 everyday use, I5 leaving the app | Separate storage, Shortcut opens Safari |

## 5. Implementation plan

No framework. Keep the strict CSP: no inline scripts or styles, so every style goes in `style.css`. After editing `app.js`, regenerate the script hash in `index.html` as `docs/development.md` describes.

### Phase 0 — Structure (small, unblocks the rest)
- Add a view-state attribute on `<main>` (`data-state="signed-out | ready | loaded"`) and drive visibility from CSS plus one `render()` function, replacing scattered `hidden` toggles in `renderAccounts`, `showAccountManagement`, `resetPreview`, `showPreview`.
- Replace the instruction H1 with a task title per state ("Sign in", "Open a link", "Post"); keep the one-sentence purpose as a subtitle on the sign-in screen only. Remove product naming from visible UI.
- Introduce system-based tokens: `font: system-ui` (San Francisco on Apple), and colours as CSS system keywords (`Canvas`, `CanvasText`, `LinkText`, `AccentColor`, `GrayText`) plus two values derived with `color-mix()`. No hex palette and no `-apple-system-*` keywords. Dark mode comes from `color-scheme: light dark`; there is no toggle and no JavaScript theme code.
- Size type in `rem` so the browser's text size setting scales it; `font: -apple-system-body` (Dynamic Type) is a possible later one-liner, not part of the components.
- **Done when:** behaviour is unchanged and the three states switch from one place.

### Phase 1 — Account management (finding 2, 3, 9 partially)
Done, and since replaced by the one-tap account switcher: [components.md, Header and accounts](components.md#header-and-accounts).

### Phase 2 — Loaded-URL experience (finding 1, 4, 6, 7)
- Pending-link card shown in the signed-out state (C1).
- Target card: extend `resolveTarget` to keep `name`, `summary`/`content` (render with `textContent` after stripping tags; never `innerHTML`), `published`, and fetch the author actor through the existing proxy for display name. Fall back to host plus handle if any request fails.
- Avatars: none on posts. The card is text only (name, handle, excerpt, host): loading an author's image would expose the person's IP to third-party servers. The one exception is the connected accounts' own photos in the account switcher (see [components.md](components.md)), for which the CSP allows `img-src https:`.
- The link field stays visible (ready, loading and loaded), with its value; a new link replaces the post below it. (This replaces the earlier idea of hiding the field behind "Change link".)
- Shortcut card directly under the primary control (under the sign-in form when signed out, under the paste field when signed in), with one sentence, an "Add Shortcut" button and an "I already have it" dismissal. Show it only when the person did not arrive from the Shortcut (rules in section 3b). It replaces the always-visible bottom section.
- **Done when:** a shared link goes from tap to a content card with no extra taps, and the field that holds the link is always there to edit.

### Phase 3 — Action feedback (finding 5, 9, 11)
- Actions as one list with separators (no tiles, no icons); a pressed action shows a busy state, then its label changes and turns bold (Liked, Reposted, Follow requested). The used action is disabled for that target to prevent duplicates.
- Replace the status line with text under the actions list ("Liked as @you.") that announces via `role=status`.
- On 401, refresh and retry the request once automatically (H2).
- Reply dialog: name the post and account, count characters, say "Replies are public" in words, disable Send when empty.
- Undo: send an `Undo` activity. This needs the new activity's `id`, normally returned in the `Location` header, which browsers only expose cross-origin if the server sends `Access-Control-Expose-Headers`. Verify against ActivityPub for WordPress first; if unavailable, ship without Undo and label actions as final. Do not promise Undo in the UI until verified.
- **Done when:** each action has loading, success and failure states; no duplicate sends; refresh is invisible.

### Phase 4 — Sign-in and errors (finding 8, 10, 12, 13)
- Sign-in: one field; on WebFinger failure keep the typed value and show an inline "Use your profile URL instead" button rather than mutating the field.
- Structured error component: title, one-sentence cause, "What to do" disclosure, Retry button. Map known failures (API off, CORS, issuer/origin mismatch, token endpoint redirect) to specific copy; keep HTTP codes in the disclosure only.
- Unsupported browser/blocked storage (H1): explain and link to instructions instead of a disabled form.
- After success, offer "Share another link"; the source app cannot be returned to from a web page, so do not promise it.

### Phase 4b — Home Screen web app
- Add `manifest.webmanifest`, icons and meta tags, `manifest-src 'self'` in the CSP, safe-area padding, standalone detection (section 3a).
- Implement the Shortcut card rules (section 3b) and change `fedi-tap.cherri` to add `?via=shortcut`; rebuild and sign the Shortcut.
- Real-device test of the standalone OAuth round trip before documenting Home Screen as supported.
- **Done when:** the page installs with the right name and icon, runs with correct safe areas, hides install hints when standalone, and the Shortcut card shows or hides per the rules.

### Phase 5 — Accessibility and QA
- Dynamic Type: sizes in `rem`, no fixed heights on text containers; check at the largest accessibility size.
- VoiceOver pass: dialog focus order, status announcements, control states.
- Reduced motion for sheet transitions.
- Safe-area insets (`env(safe-area-inset-*)`) for sheets and bottom bars.
- Manual test matrix: Safari iOS and macOS, signed out/in, one and many accounts, shared link, legacy `#url=`, profile target, expired token, revoked token, CORS blocked, offline.
- Add a small Node test file for the pure helpers (`parseHandle`, `httpsUrl`, `homeEndpoint`, `makeActivity`) by moving them to a module; none exist today.

### Suggested order and size
Phase 0 → 1 → 2 → 3 → 4 → 5. Phases 1 and 2 deliver the two flows you called out and each is shippable alone. Phase 3 depends on 2 for the card. Rough size: P0 small, P1 medium, P2 medium, P3 medium, P4 small, P5 small.

## 6. Open questions
0. Is Home Screen a first-class way to use this (needs the real-device OAuth test and a decision on separate sign-ins), or a convenience on top of Safari?
1. Remote images: decided. Only the connected accounts' own photos load; posts stay text-only.
2. Undo support depends on the server exposing the activity ID; confirm with the WordPress plugin before design commits to it.
3. Should Repost ask for confirmation because it is public and broadcast to followers, or stay one tap?
4. Multi-account: remember the last-used account per shortcut launch, or always ask when a link arrives?
5. Remove the legacy `#url=` path after how long?

## 7. Verified in the dev server

Run with `npm run dev` and driven in the browser pane against the mock OAuth server (see `docs/development.md`). Confirmed: sign-in round trip, shared link surviving sign-in, automatic lookup, Like/Reply/Follow reaching the outbox (reply markup is escaped), deny, API-off error, handle fallback clearing the field, refresh and retry on a 401 lookup, revoked session ("sign in again" inside the dropdown with the form prefilled), immediate removal with no confirmation, profile target, 404 target, and legacy `#url=` migration to `?url=`.

New small bugs found:
- A denied sign-in reads "…denied the request.. Try again." (doubled period; `oauthMessage` in `app.js`).
- "Like sent." stays on screen while composing a reply, so status text goes stale.
- After a sign-in error with an account already connected, the error appears but the sign-in form stays collapsed.
- The stale target text ("Profile on localhost") can remain in the hidden card after a failed lookup.

