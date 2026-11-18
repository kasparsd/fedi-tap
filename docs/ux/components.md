# Interface components

The page is a web page, also usable as a Home Screen web app. It should look like a clean, well-made web page that uses the browser's own elements, not like an iPhone app. This document describes the small system behind it: a base layer for HTML elements, a handful of classes and a short token list, all in [`style.css`](../../style.css) (about 150 lines). The mocks in [`mocks.html`](mocks.html) show every screen and every component using that file alone. The file is meant to be adopted unchanged as the app's `style.css`.

## Principles

Taken as ideas from Apple's guidelines and component thinking, without copying any iOS controls.

- **Reuse before inventing.** Style the HTML elements first (`h1`, `p`, `label`, `input`, `button`, `a`, `fieldset`, `ul`, `details`, `dialog`). Add a class only where an element alone cannot do the job. Every class is used by at least one screen.
- **One prominent action per screen.** At most one filled button per screen area; everything else is a bordered button. A finished action is filled to show its state.
- **Progressive disclosure.** Show the one thing the person came to do. Help, details and secondary tasks sit behind `details` or a `dialog`.
- **Plain text carries the state.** A status or an error is a line of text next to the thing it concerns (`role="status"`, `role="alert"`), told apart by weight and one colour, not by a box.
- **No decoration.** No shadows, gradients, icons, emoji, tinted boxes, side borders or cards inside cards. Related actions are ordinary buttons in a wrapping group, not rows or tiles.
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
- **Control padding (1):** `--space-1` vertically and `--space-2` horizontally on inputs, text areas and buttons, with a minimum height and width of `--target` 2.75rem, so every control is the same height.
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
| `--accent` | Links, the one `.primary` fill, the filled state of a finished action (`aria-pressed`), the current choice's border, the focus ring |
| `--danger` | `role="alert"` text, the border of an `aria-invalid` field, `.destructive` labels |
| `--line` | Borders, list separators, the pressed fill of a bordered button, the disabled border, the backdrop |

## Base layer (no classes)

| Element | Style |
|---------|-------|
| `main` | One centred column, `max-inline-size: 36rem`, safe-area padding |
| `main`, `section`, `article`, `form`, `fieldset`, `details`, `dialog` | Children are spaced by one rule (`> * + *`, `--gap` to tighten) |
| `h1`, `h2`, `p`, `a` | Headings are body size at weight 600; margins reset; links in `--accent` |
| `label`, `input`, `textarea` | Weight 600 label above a bordered field, 2.75rem tall; `[aria-invalid="true"]` turns the border to `--danger`; `:disabled` greys the text. An input and its button share one `.row`, the input on the left |
| `fieldset`, `legend` | Borderless group; the legend names it for assistive technology and is never drawn |
| `button` | Bordered, 2.75rem; direct children of `main`, `section`, `form`, `fieldset` and `dialog` fill the width |
| `[role="status"]`, `[role="alert"]` | Small text: `--quiet` for status, `--danger` for alerts, whose `<strong>` first line is its own line |
| `details`, `summary` | Native disclosure, summary is 2.75rem tall |
| `dialog` | Bordered, `Canvas` background, backdrop from `--line`, max 30rem |

## Header and account dropdown

Every screen starts with the same `header` (a `.row`, one line, a `--rule` line below): the product mark on the left and the account switcher on the right.

- **Mark:** the text "⁂tap" as a plain link to the page start, `<a href="./" aria-label="FediTap"><abbr title="fedi">⁂</abbr>tap</a>`. Body size, weight 600, inherited colour, no underline, no logo. The aria-label makes screen readers say "FediTap" instead of reading the symbol. It is the only place the product name shows in the visible UI besides the Shortcut and Home Screen copy.
- **Dropdown:** a native `select` labelled "Account", hidden until an account is stored. Each account is `@handle@domain`, with " (sign in again)" appended when it needs signing in; the last option is "Add account". Choosing an account switches to it (the post reloads for it; one that needs signing in goes to its sign-in). Choosing the last option opens the Accounts dialog and the select stays on the active account. It uses the same control tokens as inputs, shrinks and clips its text (`max-inline-size: 70%`) and never pushes the mark off at 320 px.
- **Retired:** the account chip button and the accounts sheet with its Edit mode. Accounts are removed from the Accounts dialog, behind the dropdown's last option.

## Classes

| Class | What it is | Markup contract |
|-------|------------|-----------------|
| `.primary` | The one filled button: `--accent` fill, `Canvas` label (5.5:1 in light and dark). Disabled becomes a plain outline. One per screen; on the session-ended screen it is Sign in and Open is a normal button | `<button class="primary">Sign in</button>` |
| `.field` | An input with a button inside its trailing end; the wrapper draws the border (an inset outline) and the input has none | `<div class="field"><input type="url"><button type="button">Paste</button></div>` |
| `.destructive` | Red label on the normal button | `<button class="destructive">Remove</button>` |
| `.button` | A link that looks like a button | `<a class="button" href download>Add Shortcut</a>` |
| `.quiet` | Secondary text (hints, meta) | `<p class="quiet">Replies are public.</p>` |
| `.row` | Items side by side, wrapping, spread to the edges. A row that holds an input or `.field` never wraps: the input shrinks (`min-inline-size: 0`) and the button keeps its width, down to 320 px | `<div class="row"><input><button class="primary">Open</button></div>` |
| `.group` | Buttons side by side from the start edge, wrapping | `<div class="group"><button>Like</button><button>Repost</button></div>` |
| `.list` | A plain stack of choices. Each row is a real button, optionally followed by a second button | `<ul class="list"><li><button aria-current="true">@me</button></li><li><button>@other</button><button class="destructive">Remove</button></li></ul>` |
| `.post` | The post or profile being acted on, set off by one rule above it | `<article class="post"><h2>Name</h2><p class="quiet">@handle</p><p>Text</p><footer class="row quiet">…</footer></article>` |
| `.sheet` | Dialog modifier: docked to the bottom edge, full width up to 36rem | `<dialog class="sheet" aria-labelledby="t"><form method="dialog"><h2 id="t">Reply</h2>…</form></dialog>` |

Attributes the CSS also reads: `aria-pressed="true"` (a finished action, filled, readable even when disabled), `aria-current="true"` (the current choice, bold), `aria-busy="true"` (progress cursor; the label says what is happening).

## Copy

Every word on screen has to earn its place. The mocks and the app share these rules.

- **A label names the thing, in one to three words.** "Account", "Link", "Reply". Not "Fediverse handle or profile URL". The input accepts what it accepts; the placeholder shows the shape (`you@example.com`) and the error says what was wrong.
- **No help text by default.** Add supportive text only when a person would otherwise make a mistake or be surprised, and say only that thing in one short sentence. Never restate the label ("Your handle or profile link."), explain what a field is for, or reassure ("You sign in on your own server.").
- **Where explanation belongs.** What happens next goes on the button ("Sign in", "Open", "Add Shortcut"; "Opening…" while it runs). Consequences of an irreversible action go in the confirmation. Background and troubleshooting go behind a disclosure ("Supported servers"), not in the flow.
- **Buttons are verbs, one or two words.** Sentences and trailing ellipses are not labels.
- **Status and errors state the result or the fix, not the process.** "Liked as @me", "Couldn't find me@example.com. Use a profile link." Not "Contacting your server…" repeated three ways.
- **One idea per screen.** If a screen needs a paragraph to explain itself, the screen is wrong, not the paragraph.
- **Same thing, same words everywhere.** One label per concept across screens (the account field is "Account" in sign in, in add account and in the first-run screen), and the same wording in the live app.
- **Audit rule.** For each string ask whether removing it changes what a person does or understands. If not, remove it. Example from the first pass: the sign-in field had the label "Fediverse handle or profile URL" plus the help "Your handle or profile link. You sign in on your own server."; it is now the label "Account", the placeholder `you@example.com` and no help text.

## Screen recipes

- **Sign in:** `header`, `h1`, one short paragraph saying what the app does (only while no account is stored), a `form` with a labelled `input` and `.primary` Sign in in one `.row`, the error directly below that row, one compatibility sentence below the form, `details` "Supported servers". No Shortcut panel when signed out.
- **Open a link:** `header` with the mark and the account dropdown, `h1`; a labelled `.field` (input with Paste inside) and `.primary` Open in one `.row`; status and error below the row. The field stays visible in the ready, loading and loaded states and keeps its value. On iOS only, the Shortcut panel and the Add to Home Screen disclosure sit below.
- **Post:** the link row, then `.post`, then a `fieldset` holding a `.group` of action buttons (Like, Repost, Reply, Follow, and Undo buttons next to a finished one); status text below. The post is removed while the next link loads or fails.
- **Accounts:** `dialog.sheet` opened only from the dropdown's last option: a heading, a `.list` of stored accounts (text and a `.destructive` Remove button each), then the add-account `.row` (input and Sign in), and a Done button. It cannot be dismissed while a sign-in runs.
- **Reply:** `dialog.sheet` with a label, `textarea`, "Replies are public." and a `.row` of Cancel and `.primary` Send (disabled while empty). A reply is addressed to Public with the author in `cc` and a Mention, so the author is notified.
- **Remove account:** a plain `dialog` with a heading, one sentence and a `.row` of Cancel and `.destructive` Remove.
- **Problems:** a `role="alert"` directly below the input it belongs to (the input gets `aria-invalid` and `aria-describedby`), technical detail in `details`. The person edits the value and presses the same primary button again, so a failure adds a button only when there is a different way forward (Use profile link, Sign in).

## Decisions

- **Native web, not iOS.** No navigation bar, bar buttons, inset grouped lists, action sheets, status bar or grabber. A header with the name, a native dropdown for accounts, and a dialog for secondary tasks do the same jobs with elements the browser already provides.
- **One body size, one supportive size.** There are no large titles: a heading is the same size as the text under it and is told apart by weight and by the space above it. The screen title is the first line of the page, so it needs no size.
- **Four colours and a line.** `--accent` is derived from `AccentColor` mixed with the text colour: darker in light mode, lighter in dark mode. That keeps links 5.5:1 against the page and lets the primary button use `Canvas` for its label in both schemes. The raw accent colour measures 4.2:1 against white. `LinkText` is not used, so links and the primary button share one blue.
- **Disabled is quiet.** There is no `GrayText`. A disabled control has `--quiet` text and a `--line` border, which is also what the supportive text looks like, so a disabled control reads as inactive rather than as a different colour.
- **Danger is one token.** CSS has no red system keyword, so `--danger` mixes `red` with the text colour.
- **Pressed is inverted.** A bordered button's pressed fill is `--line`; the primary button's is `CanvasText`. Hover is a `CanvasText` border. Touch devices see only the pressed state.
- **Status and errors are text, not boxes.** An alert's first line is a `<strong>` (its own line); the explanation follows in the same colour. Details sit under a `details` element. Session ended is an alert, not a separate warning colour.
- **Done actions say so.** A finished action is disabled, bold and reads in the past tense: Liked, Reposted, Replied, Follow requested. No checkmark icon.
- **Actions are real buttons.** Like, Repost, Reply and Follow use the same bordered button as everything else, in a wrapping `.group` under the post. Two styles exist for controls: a button looks like a button, navigation looks like a link (the header mark, Source code); there is no button dressed as a link and no row dressed as a button. A finished action is disabled and filled with `--accent` (`aria-pressed`), and its label is past tense; Undo is a separate plain button next to it.
- **The field is never hidden or disabled by an error.** An input that has been shown stays shown, with its value. While a request runs the input is `readonly` and its buttons `aria-disabled` with `aria-busy` on the pressed one, so text and focus are never lost; there is no loading card and no Change link. A failure prints below the field and the field is editable at once.
- **Paste lives inside the link field.** A bordered button segment at the trailing end of the `.field`; it reads the clipboard, fills the field and submits. Open is the one filled button to the right of the row.
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

`style.css` ends with the rules the app needs on top of the components: `main[data-state]` (`signed-out`, `ready`, `loaded`, `unsupported`) shows the elements whose `data-views` lists that state, flags on `main` (`data-pending`, `data-reauth`, `data-shortcut`, `data-standalone`) add detail, and `data-standalone-only` and `data-browser-only` pick copy for the Home Screen app or Safari. The sign-in screen, its fallback message and the unsupported-browser screen are plain HTML that needs no JavaScript-added classes. An empty `role="status"` or `role="alert"` is visually hidden, never `display: none`, so a screen reader announces text put into it later. A message slot (`section` with an id ending in `-error`) holds one alert, its buttons and an optional `details`; it takes no space when empty. There are no animations, so no reduced-motion rule is needed.
