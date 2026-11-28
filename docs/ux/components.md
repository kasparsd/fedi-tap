# Interface components

The page is a web page, also usable as a Home Screen web app. It should look like a clean, well-made web page that uses the browser's own elements, not like an iPhone app. This document describes the small system behind it: a base layer for HTML elements, a handful of classes and a short token list, all in [`src/app.css`](../../src/app.css) (one file). The mocks in [`mocks.html`](mocks.html) show every screen and every component using that file alone. It is the app's stylesheet.

## Principles

Taken as ideas from Apple's guidelines and component thinking, without copying any iOS controls.

- **Reuse before inventing.** Style the HTML elements first (`h1`, `p`, `label`, `input`, `button`, `a`, `fieldset`, `ul`, `details`, `dialog`). Add a class only where an element alone cannot do the job. Every class is used by at least one screen.
- **One prominent action per screen.** At most one filled button per screen area; everything else is a bordered button. An action that is on is outlined in the accent colour with a filled icon on a faint accent tint, never a solid fill.
- **Progressive disclosure.** Show the one thing the person came to do. Help, details and secondary tasks sit behind `details` or a `dialog`.
- **State is told in one place each.** A status is a short pill over the bottom of the screen (`.pill`); an error is the standard error card (`.problem`: a danger-coloured outline, a heading, what happened, buttons and a `details` for the rest). Both keep their `role="status"` or `role="alert"` text in the page.
- **No decoration.** No shadows, gradients, emoji, tinted boxes or side borders. A tint means one thing, "this can be pressed": buttons have it and nothing else does. Cards are for one object only: the opened post (`.card`) and the error card, never a card inside a card. The one exception is the icon on the four actions (Like, Repost, Reply, Follow): state needs more than colour, and a label alone cannot show on or off. Account avatars are the other: switching by one tap needs something small to tap. Related actions are buttons in one row, not tiles.
- **Every control has its states.** Hover, active, `:focus-visible`, `:disabled`, `[aria-invalid]`, `[aria-busy]`, all from real pseudo-classes and attributes.
- **Strict consistency.** Two font sizes, two weights, four spaces, four colours and a line colour, plus the avatar fills (see Scale). The same element looks and measures the same on every screen.
- **44 px targets, system fonts and colours, light and dark by themselves.** Minimum target 2.75rem, sizes in `rem` so the browser's text size scales them, `color-scheme: light dark`.

## Tokens

One `:root` block: custom properties for colour and border, four for space, plus size, radius and target. The full set of values in use is in Scale below; nothing else appears in `src/app.css` or `mocks.html`.

| Token | Value |
|-------|-------|
| `--quiet` | `CanvasText` 65% mixed into `Canvas` |
| `--line` | `CanvasText` 45% mixed into `Canvas` |
| `--fill`, `--fill-off`, `--fill-pressed` | `CanvasText` 8%, 4% and 16% mixed into `Canvas`: a button at rest, unusable and pressed |
| `--accent` | Brand blue: `#006fa6`, `#00a6f5` under `prefers-color-scheme: dark` (a plain value, not `light-dark()`, which Safari before 17.5 can't use) |
| `--danger` | `red` 70% mixed into `CanvasText` |
| `--space-1`, `--space-2`, `--space-3`, `--space-4` | 0.5, 1, 1.5, 2.5 rem |
| `--small`, `--radius`, `--target` | 0.875rem, 0.5rem, 2.75rem |
| `--rule`, `--focus` | `1px solid var(--line)`, `2px solid var(--accent)` |

Font is `system-ui` at 1rem, line height 1.45. `accent-color` colours native controls.

## Scale

The complete set. A value that is not here does not belong in the CSS.

- **Font sizes (2):** 1rem for content and actions (headings, labels, fields, buttons, links, post text); `--small` 0.875rem for supportive text (hints, status, errors, metadata, captions). Headings differ by weight only. No uppercase, letter-spacing or italics.
- **Weights (2):** 400, and 600 for headings, labels, `strong`, the primary button, and `aria-pressed` and `aria-current` rows.
- **Space (4):** `--space-1` 0.5rem for a pair that belongs together (label and input, field and help, heading and what it introduces, items inside a post, a row's gap); `--space-2` 1rem for the vertical rhythm between all other siblings and for horizontal padding; `--space-3` 1.5rem for the bottom of the page and list indents; `--space-4` 2.5rem between the page's sections (below the header, above the Shortcut card; the link field and the post it opens stay one group), which are set apart by space, never by a rule. The same four values are the only margins, paddings and gaps in the mocks. The one derived value is `-1 * --space-2`, the margin that lets a `.link` align its text with the column edge.
- **Control padding (1):** `--space-1` vertically and `--space-2` horizontally on inputs, text areas and buttons, with a minimum height and width of `--target` 2.75rem, so every control is the same height.
- **Radius (1):** `--radius` 0.5rem on controls and dialogs; a bottom-docked sheet squares its lower corners. A button nested in a field takes the radius less its 0.25rem inset, so the corners run parallel. Avatars and their badge are circles.
- **Avatar fills (8):** `.c0` to `.c7`, `oklch` at lightness 0.5 and hues 240, 60, 355, 190, 280, 25, 135 and 320, each at least 5.5:1 against their white letters. Used by avatars only. They are classes because the CSP (`style-src 'self'`) rules out inline styles.
- **Border (1):** `--rule`, 1px in `--line`. The focus ring is `--focus`, 2px in `--accent`, offset 2px.
- **Layout dimensions (not spacing):** column 36rem, dialog 30rem (a sheet 36rem), dialog maximum height `100dvh` minus two `--space-2`, input minimum 12rem, the button inside a field 2.25rem tall with 0.25rem beside it, avatar 2.25rem with 0.25rem around it, its badge 1rem, current account minimum 9.5rem, 100% widths, 1px hidden legend. In `mocks.html` only: page 84rem, text measure 46rem, grid tracks 24.375rem (the 390px frame) and 20rem, frame minimum height 36rem (22rem with a dialog in the specimen), swatches 7rem by 3rem.
- **Mix ratios:** 65% and 45% for supportive text and lines; 8%, 4% and 16% for the button fills; 70% for `--danger`; the accent at 8% and 12% behind an action that is on, at rest and pressed; and `--line` at 50% for the dialog backdrop and 35% for the "+N" circle and the placeholder bars.

### Colour uses

| Token | Where it is used |
|-------|------------------|
| `Canvas` | Page, field and dialog backgrounds; the label on the primary button and on a pressed destructive button |
| `CanvasText` | All content text; the hover border; the pressed primary fill |
| `--quiet` | Supportive text: `.quiet`, `role="status"`, placeholders, disabled text, a loading post |
| `--accent` | Links, the one `.primary` fill, the border, label and filled icon of an action that is on (`aria-pressed`), the current choice's border, the focus ring |
| `--danger` | `role="alert"` text, the border of an `aria-invalid` field, `.destructive` labels |
| `--line` | Borders, list separators, the disabled border, the backdrop |
| `--fill` | Every bordered button, including a busy one. Not the header's account buttons or a sheet's "×", which are bare |
| `--fill-off`, `--fill-pressed` | A button that can't be used now; a pressed button |

## Base layer (no classes)

| Element | Style |
|---------|-------|
| `main` | One centred column, `max-inline-size: 36rem`, safe-area padding |
| `main`, `section`, `article`, `form`, `fieldset`, `details`, `dialog` | Children are spaced by one rule (`> * + *`, `--gap` to tighten) |
| `h1`, `h2`, `p`, `a` | Headings are body size at weight 600; margins reset; links in `--accent` |
| `label`, `input`, `textarea` | Weight 600 label above a bordered field, 2.75rem tall; `[aria-invalid="true"]` turns the border to `--danger`; `:disabled` greys the text. An input and its button share one `.row`, the input on the left, `--space-1` apart like every row |
| `fieldset`, `legend` | Borderless group; the legend names it for assistive technology and is never drawn |
| `button` | Bordered and tinted (`--fill`), 2.75rem; direct children of `main`, `section`, `form`, `fieldset` and `dialog` fill the width |
| `[role="status"]`, `[role="alert"]` | Small text: `--quiet` for status, `--danger` for alerts, whose `<strong>` first line is its own line |
| `details`, `summary` | Native disclosure, summary is 2.75rem tall with its text centred; the body follows at `--space-1` like a heading's content |
| `dialog` | Bordered, `Canvas` background, backdrop from `--line`, max 30rem |

## Header and accounts

Every screen starts with the same `header` (a `.row`, no rule below).

- **Signed out: the mark.** The text "⁂tap" as a plain link to the page start, `<a href="./" aria-label="FediTap"><abbr title="fedi">⁂</abbr>tap</a>`. Body size, weight 600, inherited colour, no underline, no logo. The aria-label makes screen readers say "FediTap" instead of reading the symbol. It is the only place the product name shows in the visible UI besides the Shortcut and Home Screen copy. There is no "add account" button here: the connect form is the screen.
- **With an account: the accounts, in the mark's place** (`.accounts`, a group named "Accounts"). The current one comes first: avatar, username (no "@") over its host in `--small`, and a caret. It opens the Accounts sheet. The other accounts are avatar buttons at the end, one tap each. Up to three show; with five or more accounts it is two and a "+N" circle that opens the same sheet. There is no dropdown and no "add" circle.
- **Order.** Switching puts the previous account where the tapped circle was, so the same spot switches back. An account picked from behind "+N" moves the first circle's account behind "+N", and the previous one takes the first place. The order is saved. A second tap within 400 ms is ignored, because the circles have just traded places.
- **Avatar** (`Avatar.svelte`). The account's own photo, with nothing drawn on it; without one, or when it fails to load, the first letter or digit of the username on the account's colour. Each account gets the least-used of eight colours when added and keeps it. Accounts that would look alike get a second letter, from the host and then the username. Two accounts with the same photo look the same; the sheet and the accessible names tell them apart. There is no setting to turn photos off. Other people (post authors) have no avatar.
- **Needs reconnecting:** a "!" badge on the circle, on "+N" when the account is behind it, and in the sheet. Switching to it shows the reconnect card; only that card's button leaves the page.
- **Names and states.** Circles are "Switch to user@host", the current one "user@host, accounts", then "+N more accounts"; ", needs reconnecting" is added where it applies. The current one and "+N" have `aria-haspopup="dialog"`. While a task runs the buttons are `aria-disabled`, so focus stays put, and the chosen circle is `aria-busy` and pulses. Hover and pressed are a ring on the circle (an underline on the current name), never a fill behind text.
- **After a switch** the pill and the status line say "Switched to user@host.", and loading the link doesn't clear it. Focus goes to the current account.
- **Large text.** The current account keeps at least 9.5rem and the circles drop to further lines; below 12rem of header width the name and host wrap instead of clipping. At normal size a long one clips, and the sheet shows it in full.

## Classes

| Class | What it is | Markup contract |
|-------|------------|-----------------|
| `.primary` | The one filled button: `--accent` fill, `Canvas` label (5.5:1 in light and dark). Disabled looks like any disabled button. One per screen; on the connection-expired screen it is Reconnect and Load is a normal button | `<button class="primary">Connect</button>` |
| `.symbol` | A word with its icon, kept on one line | `<span class="symbol"><svg>…</svg> Share</span>` |
| `.field` | An input with a small button inside its trailing end; the wrapper draws the border (an inset outline) and the input has none | `<div class="field"><input type="url"><button type="button">Paste</button></div>` |
| `.destructive` | Red label on the normal button; pressed, it fills with `--danger` | `<button class="destructive">Remove</button>` |
| `.button` | A link that looks like a button | `<a class="button" href download>Add Shortcut</a>` |
| `.quiet` | Secondary text (hints, meta) | `<p class="quiet">Replies are public.</p>` |
| `.actions` | Up to three equal columns, the same width in every group (a group of one or two leaves the rest empty), two when a label would not fit beside its icon; a label never wraps. Under a post: Like and Repost are toggles (`aria-pressed`, an inline `svg` icon that goes from outline to filled), Reply is a plain button. An action that could reach people the post wasn't meant for is greyed (`aria-disabled`) but still takes a tap, which says why in the status line and the pill: Repost unless the post is public or unlisted (`repostable`), Reply when the post doesn't say who can see it. Follow acts on the person, not the post, so it lives in `.byline`, not here. The icon is an `aria-hidden` inline `svg`, so the CSP is unchanged | `<div class="actions"><button aria-pressed="false"><svg>…</svg>Like</button><button><svg>…</svg>Reply</button></div>` |
| `.row` | Items side by side, wrapping, spread to the edges. A row that holds an input or `.field` never wraps: the input shrinks (`min-inline-size: 0`) and the button keeps its width, down to 320 px | `<div class="row"><input><button class="primary">Load</button></div>` |
| `.list` | A plain stack of choices. Each row is a real button, optionally followed by a second button | `<ul class="list"><li><button aria-current="true">@me</button></li><li><button>@other</button><button class="destructive">Remove</button></li></ul>` |
| `.byline` | The author line of a post or profile: name and handle on the left (handle and date on their own lines, so they never break mid-word), the Follow toggle at the trailing end. The button never wraps and is at least 6.5rem wide | `<div class="byline"><div><h2>Name</h2><p class="quiet"><span>@handle</span><span>Date</span></p></div><button aria-pressed="false">…Follow</button></div>` |
| `.post` | The post or profile being acted on, kept with the link field above it | `<article class="post"><h2>Name</h2><p class="quiet">@handle</p><p>Text</p><footer class="row quiet">…</footer></article>` |
| `.accounts` | The header’s accounts: the current one (`.active`, with `.avatar`, `.who` and `.caret`), then `.others` | `<div class="accounts" role="group"><button class="active">…</button><span class="others"><button>…</button></span></div>` |
| `.avatar` | A round photo or initials (`.c0`–`.c7`); `.more` is "+N", `.reconnect` adds the "!" badge | `<span class="avatar c0" aria-hidden="true">A<img src alt=""></span>` |
| `.who` | A handle as username over host | `<span class="who"><span>anna</span><span class="quiet">social.example</span></span>` |
| `.pick` | An account row in the Accounts sheet; `aria-current` adds a check mark | `<button class="pick" aria-current="true">…</button>` |
| `.title` | A sheet heading with an "×" close button, kept in view (except at very large text) | `<div class="row title"><h2>Accounts</h2><button aria-label="Close"><svg>…</svg></button></div>` |
| `.sheet` | Dialog modifier: docked to the bottom edge, full width up to 36rem | `<dialog class="sheet" aria-labelledby="t"><form method="dialog"><h2 id="t">Reply</h2>…</form></dialog>` |

Attributes the CSS also reads: `aria-pressed="true"` (an action that is on: accent border, label and filled icon on a faint accent tint; keeps its look under `aria-disabled`), `aria-current="true"` (the current choice, bold), `aria-busy="true"` (progress cursor; a busy button keeps its look and says what it is doing, see Loading).

## Copy

Every word on screen has to earn its place. The mocks and the app share these rules.

- **A label names the thing, in one to three words.** "Account", "Link", "Reply". Not "Fediverse handle or profile URL". The input accepts what it accepts; the placeholder shows the shape (`you@example.com`) and the error says what was wrong.
- **No help text by default.** Add supportive text only when a person would otherwise make a mistake or be surprised, and say only that thing in one short sentence. Never restate the label ("Your handle or profile link."), explain what a field is for, or reassure ("You sign in on your own server."). The one exception is where account details are kept, said once under the signed-out connect form, because there is no way to see it and it decides whether someone connects (owner, 2026-11-28).
- **Where explanation belongs.** What happens next goes on the button ("Connect", "Load", "Add Shortcut" or "Loading…" while it runs). Consequences of an irreversible action go in the confirmation. Background and troubleshooting go in disclosures such as "How it works".
- **Buttons are verbs, one or two words.** Sentences and trailing ellipses are not labels.
- **Status and errors state the result or the fix, not the process.** "Liked as @me", "Couldn't find me@example.com. Use a profile link." Not "Contacting your server…" repeated three ways.
- **One idea per screen.** If a screen needs a paragraph to explain itself, the screen is wrong, not the paragraph.
- **Connect, not sign in.** FediTap has no accounts of its own: the person links one they already have, and their server grants access. So the verb is Connect (button, heading, "Add account" in the Accounts dialog, Reconnect when the grant expires, "Connection expired", "Couldn’t connect"). Buffer says the same ("sign into your account to connect it"); Mastodon and Elk clients say Sign in because they are apps you live in. Remove stays Remove: it forgets the account on this device and does not revoke access on the server, so Disconnect would overpromise. The page where the server asks for approval is the server's own wording.
- **One heading for the link screen.** "Open a post or profile" in every state (ready, loading, loaded), so the title never jumps to Post or Profile above a "Link" field; the card below shows what was found. The field label is "Link" and the placeholder "Paste a link".
- **Same thing, same words everywhere.** One label per concept across screens (the account field is "Account" in the connect form, in the Accounts dialog and in the first-run screen), and the same wording in the live app.
- **Audit rule.** For each string ask whether removing it changes what a person does or understands. If not, remove it. Example from the first pass: the connect field had the label "Fediverse handle or profile URL" plus the help "Your handle or profile link. You sign in on your own server."; it is now the label "Account", the placeholder `you@example.com` and no help text.

## Screen recipes

- **Connect account.** The header and a one-sentence intro precede the form; the sentence draws the device's share symbol beside "Share" (a box with an arrow on Apple devices, three joined dots elsewhere). The labelled `.field` (input with Paste inside) and the Connect button share a row, with any error below. The help text below the form says first that account details are saved only in this browser, then which servers work (the ActivityPub API first, then the Mastodon API); it ends with Learn more, which opens How it works. The Apple Shortcut and Android web app rows appear on every device, except on the unsupported screen, and sit immediately above How it works.
- **Open a post or profile:** `header` with the accounts, `h1`; a labelled `.field` (input with Paste inside) and `.primary` Load in one `.row`; status and error below the row. The field stays visible in the ready, loading and loaded states and keeps its value. The sharing setup sits below, on every device.
- **Post:** the link row, then `.post` with the Follow toggle in its `.byline`, all inside the `.card`; below it two labelled groups (`.group-label`: body text on a top rule): "Using API" holds the `.actions` row (Like, Repost, Reply; a profile has none) and "Using {host} links" the links the server advertises; the title is always "Open a post or profile", the author name is bold text (not a heading), and a status line below says what happened. Once a post is on screen Load is a plain button, so the action buttons are the only emphasis. With two or more accounts a quiet "Acting as @me" line sits above the action buttons. The post is removed while the next link loads or fails.
- **Accounts:** `dialog.sheet`, opened from the header's current account or "+N": a `.title` row, a `.list` of the accounts in the order they were added (a `.pick` button that switches and closes, wrapping the name in full, and a `.destructive` Remove), the add-account `.row` (field labelled "Add account" with Paste inside, and Connect) and a Done button. Opening it focuses the current row; closing it without a change returns focus to what opened it. Remove asks in place: the row becomes "Remove user@host?" on a line of its own (`li.confirm`, so the handle never breaks mid-word) with Cancel and `.destructive` Remove sharing the line below, and the one-sentence explanation appears below the list; no second dialog opens on top, and Cancel returns focus to that row's Remove. Removing the current account makes the first circle's current. At large text Remove wraps under its account. Close verbs: a sheet that edits something (Reply) has Cancel beside its primary button and no "×"; one with nothing to commit (Accounts) has Done, and the "×" as a shortcut to it. It cannot be dismissed while a connection runs.
- **Reply:** `dialog.sheet` with a label, `textarea`, a note on who can see the reply ("Replies are public." unless a Mastodon-compatible post is unlisted, followers-only or direct, in which case the reply keeps that reach and the note says so) and a `.row` of Cancel and `.primary` Send (disabled while empty). A reply mentions the author, so the author is notified.
- **Problems:** a `role="alert"` directly below the input it belongs to (the input gets `aria-invalid` and `aria-describedby`), technical detail in `details`. Every failure is the one `.problem` card, the connection-expired card included. A failed return from the server puts what was typed back in the marked field. The person edits the value and presses the same primary button again, so a failure adds a button only when there is a different way forward (Use profile link, Reconnect).

## Decisions

- **How it works.** The Apple Shortcut, Android web app and How it works summaries use the same native disclosure style and form one set of evenly spaced rows. All three start closed. The Learn more link opens How it works and jumps to its summary. The expanded content groups server compatibility and reference links by API. The author credit and GitHub source link sit in a separate, always-visible footer below the disclosures.
- **Native web, not iOS.** No navigation bar, bar buttons, inset grouped lists, action sheets, status bar or grabber. A header for accounts and a dialog for secondary tasks do the same jobs with elements the browser already provides.
- **One body size, one supportive size.** There are no large titles: a heading is the same size as the text under it and is told apart by weight and by the space above it. The screen title is the first line of the page, so it needs no size.
- **Four colours and a line.** `--accent` is the fixed brand blue `#00a6f5`, darkened in light mode (`#006fa6`, 5.5:1 against white; the brand blue itself is only 2.7:1) and used as is in dark mode (7.8:1 against black), so links read well and the primary button can use `Canvas` for its label in both schemes. The system `AccentColor` is not used. `LinkText` is not used, so links and the primary button share one blue.
- **Disabled is quiet.** There is no `GrayText`. A disabled control has `--quiet` text, and a disabled button keeps its `--line` border on the fainter `--fill-off`, so it reads as inactive rather than as a different colour.
- **Danger is one token.** CSS has no red system keyword, so `--danger` mixes `red` with the text colour.
- **Pressed is darker.** A bordered button's pressed fill is `--fill-pressed`; the primary button's is `CanvasText` and a destructive one's `--danger`, both with a `Canvas` label. Hover is a `CanvasText` border. Touch devices see only the pressed state.
- **Buttons are tinted, fields are not** (owner, 2026-11-28). With the same border and corners, a button and a field looked alike. Buttons got a fill and kept the border; fields stay `Canvas`. Weighed against it: accent-outlined buttons (they compete with the one primary button and with the "on" state) and pill-shaped buttons (a second radius). The text identifies a button, so its border against the fill needn't reach 3:1; a field's border against the page does.
- **Errors are one card.** The `.problem` section holds the alert (a `<strong>` heading on its own line in `--danger`, the explanation in the text colour), any buttons, and a `details` ("What to do" or "Details") behind a hairline. Session ended is the same card, not a separate warning colour. Statuses are the `.pill`: inverted colours (plain with an outline under forced colours, where inverted text can't be read), a few seconds on screen (until the task ends), `aria-hidden` because the status line it mirrors is what a screen reader announces; the slow-server notice and its Cancel use the same pill. Statuses inside a sheet stay in the sheet: `Notices` (the announcement, the slow notice with its Cancel, and the toast) is rendered inside an open sheet and not behind it, because the page behind a modal dialog is `inert` and Cancel could not be pressed there.
- **Actions are toggles, undone by pressing again.** Like, Repost and Follow (in the byline) keep their place; when on, the icon fills, the border and label take the accent colour on a faint tint of it and the label switches to the done form ("Liked", "Reposted", "Requested"), with `aria-pressed` as the standard toggle signal. Pressing an on button undoes it. A status line below carries the past tense and the account: "Liked as @me.", "Follow request sent as @me." (a request is all the client knows), "Like undone." Where the server does not expose the activity ID, the button keeps its on look but is `aria-disabled` and the status says "This server doesn’t allow undo from here." Reply is not a toggle and is never locked: more than one reply is fine.
- **Follow sits with the author.** Like, Repost and Reply act on the post; Follow acts on the person, so it is a toggle at the trailing end of the byline, as in Mastodon, Elk and Bluesky. Its label is just "Follow" (no "Follow author"), the action row is three equal columns that fit at 320 px, and a profile shows only the byline.
- **Busy and failure.** The pressed button says what it is doing (Liking…, Reposting…, Undoing…, Sending…) and the other actions are `aria-disabled`, not `disabled`, so focus stays put. A failed action returns the button to its previous state; pressing it again is the retry.
- **Alternatives weighed and rejected** : label-only toggles ("Liked", no icon: a "Liked" button does not say it can be pressed), a result row with an inline Undo link (the row jumps, results stack and it is a button dressed as a link), and a delayed send with an Undo bar (closing the page during the delay silently drops the action). Mastodon, Elk, Ivory, Bluesky and X all toggle in place with a filled, coloured icon; Gmail-style undo bars are for actions that are not toggles.
- **Actions are real buttons.** The same bordered, tinted button as everything else, in the `.actions` row under the post and the byline. Two styles exist for controls: a button looks like a button, navigation looks like a link (the header mark, Source code); the header's account buttons draw as avatars; there is no button dressed as a link and no row dressed as a button.
- **The field is never hidden or disabled by an error.** An input that has been shown stays shown, with its value. While a request runs the input is `readonly` and its buttons `aria-disabled` with `aria-busy` on the pressed one, so text and focus are never lost; there is no loading card and no Change link. A failure prints below the field and the field is editable at once.
- **Paste lives inside the field**, in the link field and the account field. A small tinted button (`--small`, 2.25rem drawn, tappable over the field's full 2.75rem) at the trailing end of the `.field`; it reads the clipboard and fills the field. In the link field it also submits, and so does pasting a whole HTTPS link there by keyboard or menu: it replaces what the field held, because a link dropped into the middle of another is never meant. Text that isn't a whole link pastes as usual. In the account field it moves focus to Connect instead, because Connect leaves the page and the pasted text deserves a look first. The one filled button sits to the right of the field.
- **Failures with no field sit under the title.** The storage-blocked screen has no field to attach the alert to.
- **A sheet cannot be dismissed while it works.** `closedby` is `any` when idle and `none` while a task runs (a repeated Android back gesture would get past a `cancel` handler alone); where `closedby` is unknown a click handler closes it, and only when the press and the release are both outside the box, so dragging a text selection out doesn't. A scroll over the backdrop doesn't move the page (`overscroll-behavior: contain`).
- **The page's own errors, not the browser's.** The forms are `novalidate`; `required` stays for assistive technology, and an empty or malformed entry goes through the same error card. A field that has no error says `aria-invalid="false"`, because Safari and Firefox expose an empty required field as invalid from the start. The reply sheet is a `<form>` with a submit Send.
- **One dialog element.** The accounts and reply dialogs use `.sheet` (bottom-docked); removal is confirmed inside the Accounts sheet. The bottom-docked form is not limited to narrow screens: it stays centred and at most 36rem wide on a desktop, which keeps the CSS free of media queries.
- **The legend is hidden, the label is visible.** A `fieldset` names a group for assistive technology; the visible name is a heading or a label.
- **Links keep a 44 px target where they stand alone.** A link inside a `.row` is a 2.75rem flex item. A link inside running text is exempt.
- **Residual exceptions.** The disclosure summary is 2.75rem tall with its text near the top, because `display: flex` would remove its marker. The dialog backdrop and the mock frame's scrim use `--line` at 50%, not a fifth colour.
- **One placeholder.** Waiting is shown by the one pattern under Loading: grey bars for the post and the action buttons held in place, greyed and inert, so nothing jumps when the post arrives.
- **Server consent and system sheets are drawn with the same components.** They are not our pages (A5, B1, I1, I3, I5), but the mock draws them with the same elements so the flow reads as one system.
- **Mock-only styling stays in `mocks.html`.** The frame, the scrim behind an open dialog and the `data-force` rules that show hover, pressed and focus on a static page live in its inline style.
- **Not adopted:** Dynamic Type through `font: -apple-system-body`, a toggle for the colour scheme, transitions, and per-component colours.

## App states and live regions

`src/app.css` holds only the components. Which parts of the page show is decided by the Svelte components (`{#if}` on `app.view`: `signed-out`, `ready`, `loaded`, `unsupported`), not by CSS, and copy for the Home Screen app or Safari is chosen the same way. An empty `role="status"` or `role="alert"` is visually hidden, never `display: none`, so a screen reader announces text put into it later. A message slot (`section` with an id ending in `-error`) holds one alert, its buttons and an optional `details`; it takes no space when empty. The only motion is the pulsing dot in the link field, the pulsing circle of an account being switched to, the placeholder bars and the pill's slide-in, all of which stop under `prefers-reduced-motion`. `main[data-view]` carries the screen name and `button[data-action]` the action, so tests and scripts never depend on copy.

## Loading

Every task that waits on a server (opening a link, sending an action, undoing, signing in, renewing a token) looks the same. `runTask` in `src/state.svelte.js` is the one place that does it.

1. **The pressed control owns the message.** It says what it is doing (Loading…, Sending…, Undoing…, Looking up…, Signing in…) with `aria-busy`, keeps its fill (a primary button stays primary) and, except beside an input, keeps its width, because `BusyLabel` reserves the widest text it can show (idle, working and done, the done one in bold). Everything else dims through the disabled fieldsets. There is no second status line for it.
2. **One progress cue.** A dot (`.pulse`, decorative) pulses at the end of the link field while a link loads; the field's input gives up the room, so nothing outside it moves. A hidden live region (`#task-announce`) tells screen readers what is happening. Both start after 150 ms, so a quick response shows nothing extra.
3. **Nothing on screen is thrown away early.** While another link opens, the loaded post and its actions stay, dimmed and `inert`, and the title does not change; nothing below them moves. With no post yet, a placeholder card (grey bars shaped like the byline and text, named "Loading {host}…" for screen readers only) stands in for it, and the action groups appear greyed and inert below it, with the buttons the account is known to have. The post is replaced in one step when the new one arrives. A link that fails leaves nothing on screen for it.
4. **A slow task says so.** After 5 s the pill says "Still waiting for your server…". Opening a link and the sign-in lookup add Cancel, which aborts the request . Sending, undoing and token requests are never cancellable, because they may already have gone through (or, for a token, must be saved).

Only read-only requests listen for Cancel (`src/lib/signal.js`): discovery, the Mastodon instance probe, opening a link through the proxy or the Mastodon search. The ActivityPub proxy, the Mastodon `GET` calls and WebFinger are cancellable; every `POST` is not.
