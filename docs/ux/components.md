# Interface components

The page is a web page, also usable as a Home Screen web app. It should look like a clean, well-made web page that uses the browser's own elements, not like an iPhone app. This document describes the small system behind it: a base layer for HTML elements, a handful of classes and a short token list, all in [`style.css`](../../style.css) (about 150 lines). The mocks in [`mocks.html`](mocks.html) show every screen and every component using that file alone. The file is meant to be adopted unchanged as the app's `style.css`.

## Principles

Taken as ideas from Apple's guidelines and component thinking, without copying any iOS controls.

- **Reuse before inventing.** Style the HTML elements first (`h1`, `p`, `label`, `input`, `button`, `a`, `fieldset`, `ul`, `details`, `dialog`). Add a class only where an element alone cannot do the job. Every class is used by at least one screen.
- **One prominent action per screen.** At most one filled button; everything else is a bordered or text button, or a row in a list.
- **Progressive disclosure.** Show the one thing the person came to do. Help, details and secondary tasks sit behind `details` or a `dialog`.
- **Plain text carries the state.** A status or an error is a line of text next to the thing it concerns (`role="status"`, `role="alert"`), told apart by weight and one colour, not by a box.
- **No decoration.** No shadows, gradients, icons, emoji, tinted boxes, side borders or cards inside cards. Group related actions as a list with separators, not tiles.
- **Every control has its states.** Hover, active, `:focus-visible`, `:disabled`, `[aria-invalid]`, `[aria-busy]`, all from real pseudo-classes and attributes.
- **Strict consistency.** Two font sizes, two weights, three spaces, four colours and a line colour (see Scale). The same element looks and measures the same on every screen.
- **44 px targets, system fonts and colours, light and dark by themselves.** Minimum target 2.75rem, sizes in `rem` so the browser's text size scales them, `color-scheme: light dark`.

## Tokens

One `:root` block: seven custom properties for colour and border, three for space, plus size, radius and target. The full set of values in use is in Scale below; nothing else appears in `style.css` or `mocks.html`.

| Token | Value |
|-------|-------|
| `--quiet` | `CanvasText` 65% mixed into `Canvas` |
| `--line` | `CanvasText` 45% mixed into `Canvas` |
| `--accent` | `AccentColor` 85% mixed into `CanvasText` |
| `--danger` | `red` 75% mixed into `CanvasText` |
| `--space-1`, `--space-2`, `--space-3` | 0.5, 1, 1.5 rem |
| `--small`, `--radius`, `--target` | 0.875rem, 0.5rem, 2.75rem |
| `--rule`, `--focus` | `1px solid var(--line)`, `2px solid var(--accent)` |

Font is `system-ui` at 1rem, line height 1.45. `accent-color` colours native controls.

## Scale

The complete set. A value that is not here does not belong in the CSS.

- **Font sizes (2):** 1rem for content and actions (headings, labels, fields, buttons, links, post text); `--small` 0.875rem for supportive text (hints, status, errors, metadata, captions). Headings differ by weight only. No uppercase, letter-spacing or italics.
- **Weights (2):** 400, and 600 for headings, labels, `strong`, the primary button, and `aria-pressed` and `aria-current` rows.
- **Space (3):** `--space-1` 0.5rem for a pair that belongs together (label and input, field and help, heading and what it introduces, items inside a post, a row's gap); `--space-2` 1rem for the vertical rhythm between all other siblings and for horizontal padding; `--space-3` 1.5rem for the bottom of the page and list indents. The same three values are the only margins, paddings and gaps in the mocks. The one derived value is `-1 * --space-2`, the margin that lets a `.link` align its text with the column edge.
- **Control padding (1):** `--space-1` vertically and `--space-2` horizontally on inputs, text areas, buttons and list rows, with a minimum height and width of `--target` 2.75rem, so every control is the same height.
- **Radius (1):** `--radius` 0.5rem on controls and dialogs; a bottom-docked sheet squares its lower corners.
- **Border (1):** `--rule`, 1px in `--line`. The focus ring is `--focus`, 2px in `--accent`, offset 2px.
- **Layout dimensions (not spacing):** column 36rem, dialog 30rem (a sheet 36rem), dialog maximum height `100dvh` minus two `--space-2`, input minimum 12rem, 100% widths, 1px hidden legend. In `mocks.html` only: page 84rem, text measure 46rem, grid tracks 24.375rem (the 390px frame) and 20rem, frame minimum height 36rem (22rem with a dialog in the specimen), swatches 7rem by 3rem.
- **Mix ratios in the derived tokens:** 65%, 45%, 85%, 75%, and 50% for the dialog backdrop (`--line` over transparent).

### Colour uses

| Token | Where it is used |
|-------|------------------|
| `Canvas` | Page, field and dialog backgrounds; the label on the primary button |
| `CanvasText` | All content text; the hover border; the pressed primary fill; the label of a finished action |
| `--quiet` | Supportive text: `.quiet`, `role="status"`, placeholders, disabled text, a loading post |
| `--accent` | Links, `.link` buttons, the one `.primary` fill, the focus ring |
| `--danger` | `role="alert"` text, the border of an `aria-invalid` field, `.destructive` labels |
| `--line` | Borders, list separators, the pressed fill of a bordered button, the disabled border, the backdrop |

## Base layer (no classes)

| Element | Style |
|---------|-------|
| `main` | One centred column, `max-inline-size: 36rem`, safe-area padding |
| `main`, `section`, `article`, `form`, `fieldset`, `details`, `dialog` | Children are spaced by one rule (`> * + *`, `--gap` to tighten) |
| `h1`, `h2`, `p`, `a` | Headings are body size at weight 600; margins reset; links in `--accent` |
| `label`, `input`, `textarea` | Weight 600 label above a full-width bordered field, 2.75rem tall; `[aria-invalid="true"]` turns the border to `--danger`; `:disabled` greys the text |
| `fieldset`, `legend` | Borderless group; the legend names it for assistive technology and is never drawn |
| `button` | Bordered, 2.75rem; direct children of `main`, `section`, `form`, `fieldset` and `dialog` fill the width |
| `[role="status"]`, `[role="alert"]` | Small text: `--quiet` for status, `--danger` for alerts, whose `<strong>` first line is its own line |
| `details`, `summary` | Native disclosure, summary is 2.75rem tall |
| `dialog` | Bordered, `Canvas` background, backdrop from `--line`, max 30rem |

## Classes

| Class | What it is | Markup contract |
|-------|------------|-----------------|
| `.primary` | The one filled button: `--accent` fill, `Canvas` label (5.5:1 in light and dark). Disabled becomes a plain outline | `<button class="primary">Continue</button>` |
| `.link` | A button that looks like a link; no border | `<button class="link">Change link</button>` |
| `.destructive` | Red label; combine with `.link` or use alone | `<button class="link destructive">Remove</button>` |
| `.button` | A link that looks like a button | `<a class="button" href download>Add Shortcut</a>` |
| `.quiet` | Secondary text (hints, meta) | `<p class="quiet">Your handle or profile link.</p>` |
| `.row` | Items side by side, wrapping, spread to the edges; an input inside grows | `<div class="row"><input type="url"><button>Open</button></div>` |
| `.list` | Related actions or choices as rows with separators. A row is a button, optionally followed by text or a second control | `<ul class="list"><li><button class="link">Like</button></li></ul>` |
| `.post` | The post or profile being acted on, set off by one rule above it | `<article class="post"><h2>Name</h2><p class="quiet">@handle</p><p>Text</p><footer class="row quiet">…</footer></article>` |
| `.sheet` | Dialog modifier: docked to the bottom edge, full width up to 36rem | `<dialog class="sheet" aria-labelledby="t"><form method="dialog"><h2 id="t">Reply</h2>…</form></dialog>` |

Attributes the CSS also reads: `aria-pressed="true"` (a finished action, bold, readable even when disabled), `aria-current="true"` (the current choice, bold), `aria-busy="true"` (progress cursor; the label says what is happening).

## Copy

Every word on screen has to earn its place. The mocks and the app share these rules.

- **A label names the thing, in one to three words.** "Account", "Link", "Reply". Not "Fediverse handle or profile URL". The input accepts what it accepts; the placeholder shows the shape (`you@example.com`) and the error says what was wrong.
- **No help text by default.** Add supportive text only when a person would otherwise make a mistake or be surprised, and say only that thing in one short sentence. Never restate the label ("Your handle or profile link."), explain what a field is for, or reassure ("You sign in on your own server.").
- **Where explanation belongs.** What happens next goes on the button ("Continue", "Open link", "Add Shortcut"). Consequences of an irreversible action go in the confirmation. Background and troubleshooting go behind a disclosure, not in the flow.
- **Buttons are verbs, one or two words.** Sentences and trailing ellipses are not labels.
- **Status and errors state the result or the fix, not the process.** "Liked as @me", "Couldn't find me@example.com. Use a profile link." Not "Contacting your server…" repeated three ways.
- **One idea per screen.** If a screen needs a paragraph to explain itself, the screen is wrong, not the paragraph.
- **Same thing, same words everywhere.** One label per concept across screens (the account field is "Account" in sign in, in add account and in the first-run screen), and the same wording in the live app.
- **Audit rule.** For each string ask whether removing it changes what a person does or understands. If not, remove it. Example from the first pass: the sign-in field had the label "Fediverse handle or profile URL" plus the help "Your handle or profile link. You sign in on your own server."; it is now the label "Account", the placeholder `you@example.com` and no help text.

## Screen recipes

- **Sign in:** `h1`, one sentence, a `form` with a labelled `input`, hints, `.primary` Continue; the Shortcut as a `section`; `details` for help.
- **Open a link:** `header.row` with `h1` and the account `.link`; `.primary` Paste link; a labelled `input` with Open in a `.row`.
- **Post:** `header.row`; `.post`; a `fieldset` holding the action `.list`; status text; next steps as `.link` buttons.
- **Accounts:** `dialog.sheet` with a `.row` heading and Edit, a `.list` of accounts (`aria-current` bold; `.quiet` "Sign in again" where needed; Remove as `.link.destructive` in edit mode; Add account as the last row), Done.
- **Reply:** `dialog.sheet` with a label, `textarea`, counter and a `.row` of Cancel and `.primary` Send.
- **Remove account:** a plain `dialog` with a heading, one sentence and a `.row` of Cancel and `.destructive` Remove.
- **Problems:** the same screen with a `role="alert"` next to the field or link it concerns, one `.primary` Try again, a plain alternative and technical details in `details`.

## Decisions

- **Native web, not iOS.** No navigation bar, bar buttons, inset grouped lists, action sheets, status bar or grabber. A heading, the account as a text button beside it, and a dialog for secondary tasks do the same jobs with elements the browser already provides.
- **One body size, one supportive size.** There are no large titles: a heading is the same size as the text under it and is told apart by weight and by the space above it. The screen title is the first line of the page, so it needs no size.
- **Four colours and a line.** `--accent` is derived from `AccentColor` mixed with the text colour: darker in light mode, lighter in dark mode. That keeps links 5.5:1 against the page and lets the primary button use `Canvas` for its label in both schemes. The raw accent colour measures 4.2:1 against white. `LinkText` is not used, so links and the primary button share one blue.
- **Disabled is quiet.** There is no `GrayText`. A disabled control has `--quiet` text and a `--line` border, which is also what the supportive text looks like, so a disabled control reads as inactive rather than as a different colour.
- **Danger is one token.** CSS has no red system keyword, so `--danger` mixes `red` with the text colour.
- **Pressed is inverted.** A bordered button's pressed fill is `--line`; the primary button's is `CanvasText`. Hover is a `CanvasText` border. Touch devices see only the pressed state.
- **Status and errors are text, not boxes.** An alert's first line is a `<strong>` (its own line); the explanation follows in the same colour. Details sit under a `details` element. Session ended is an alert, not a separate warning colour.
- **Done actions say so.** A finished action is disabled, bold and reads in the past tense: Liked, Reposted, Replied, Follow requested. No checkmark icon.
- **Actions are a list with separators, not tiles.** Like, Repost, Reply and Follow are rows of `.link` buttons. A finished action that can be undone gets a second `.link` control, Undo, at the end of its own row, so every action has its own Undo (Reply has none).
- **Retry is filled, alternatives are plain.** On a failed lookup Try again is `.primary` and Change link is `.link`. On a failed handle the profile-link fallback is `.primary` because retrying the same input will fail again.
- **Paste is the one filled button on the Open a link screen.** Typing is the second path, a field and a bordered Open button.
- **Failures with no field sit under the title.** The storage-blocked screen has no field to attach the alert to.
- **One dialog element.** The accounts and reply dialogs use `.sheet` (bottom-docked); the removal confirmation is the plain centred dialog. The bottom-docked form is not limited to narrow screens: it stays centred and at most 36rem wide on a desktop, which keeps the CSS free of media queries.
- **The legend is hidden, the label is visible.** A `fieldset` names a group for assistive technology; the visible name is a heading or a label.
- **Links keep a 44 px target where they stand alone.** A link inside a `.row` is a 2.75rem flex item. A link inside running text is exempt.
- **Residual exceptions.** The disclosure summary is 2.75rem tall with its text near the top, because `display: flex` would remove its marker. The dialog backdrop and the mock frame's scrim use `--line` at 50%, not a fifth colour.
- **No empty-state, spinner or placeholder components.** A busy control says what it is doing in its label (Looking up…, Sending…); the post area says Loading…. Nothing shimmers.
- **Server consent and system sheets are drawn with the same components.** They are not our pages (A5, B1, I1, I3, I5), but the mock draws them with the same elements so the flow reads as one system.
- **Mock-only styling stays in `mocks.html`.** The frame, the scrim behind an open dialog and the `data-force` rules that show hover, pressed and focus on a static page live in its inline style.
- **Not adopted:** Dynamic Type through `font: -apple-system-body`, a toggle for the colour scheme, transitions, and per-component colours.

## App states and live regions

`style.css` ends with the rules the app needs on top of the components: `main[data-state]` (`signed-out`, `ready`, `loaded`, `unsupported`) shows the elements whose `data-views` lists that state, flags on `main` (`data-pending`, `data-reauth`, `data-loading`, `data-failed`, `data-shortcut`, `data-standalone`) add detail, and `data-standalone-only` and `data-browser-only` pick copy for the Home Screen app or Safari. The sign-in screen, its fallback message and the unsupported-browser screen are plain HTML that needs no JavaScript-added classes. An empty `role="status"` or `role="alert"` is visually hidden, never `display: none`, so a screen reader announces text put into it later. A message slot (`section` with an id ending in `-error`) holds one alert, its buttons and an optional `details`; it takes no space when empty. There are no animations, so no reduced-motion rule is needed.
