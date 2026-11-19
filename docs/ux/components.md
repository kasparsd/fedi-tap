# Interface components

The page is a web page, also usable as a Home Screen web app. It should look like a clean, well-made web page that uses the browser's own elements, not like an iPhone app. This document describes the small system behind it: a base layer for HTML elements, a handful of classes and a short token list, all in [`src/app.css`](../../src/app.css) (about 150 lines). The mocks in [`mocks.html`](mocks.html) show every screen and every component using that file alone. It is the app's stylesheet.

## Principles

Taken as ideas from Apple's guidelines and component thinking, without copying any iOS controls.

- **Reuse before inventing.** Style the HTML elements first (`h1`, `p`, `label`, `input`, `button`, `a`, `fieldset`, `ul`, `details`, `dialog`). Add a class only where an element alone cannot do the job. Every class is used by at least one screen.
- **One prominent action per screen.** At most one filled button per screen area; everything else is a bordered button. An action that is on is outlined in the accent colour with a filled icon, never a solid fill.
- **Progressive disclosure.** Show the one thing the person came to do. Help, details and secondary tasks sit behind `details` or a `dialog`.
- **State is told in one place each.** A status is a short pill over the bottom of the screen (`.pill`); an error is the standard error card (`.problem`: a danger-coloured outline, a heading, what happened, buttons and a `details` for the rest). Both keep their `role="status"` or `role="alert"` text in the page.
- **No decoration.** No shadows, gradients, emoji, tinted boxes or side borders. Cards are for one object only: the opened post (`.card`) and the error card, never a card inside a card. The one exception is the icon on the four actions (Like, Repost, Reply, Follow): state needs more than colour, and a label alone cannot show on or off. Related actions are buttons in one row, not tiles.
- **Every control has its states.** Hover, active, `:focus-visible`, `:disabled`, `[aria-invalid]`, `[aria-busy]`, all from real pseudo-classes and attributes.
- **Strict consistency.** Two font sizes, two weights, four spaces, four colours and a line colour (see Scale). The same element looks and measures the same on every screen.
- **44 px targets, system fonts and colours, light and dark by themselves.** Minimum target 2.75rem, sizes in `rem` so the browser's text size scales them, `color-scheme: light dark`.

## Tokens

One `:root` block: seven custom properties for colour and border, three for space, plus size, radius and target. The full set of values in use is in Scale below; nothing else appears in `src/app.css` or `mocks.html`.

| Token | Value |
|-------|-------|
| `--quiet` | `CanvasText` 65% mixed into `Canvas` |
| `--line` | `CanvasText` 45% mixed into `Canvas` |
| `--accent` | Brand blue `#00a6f5`: `light-dark(#006fa6, #00a6f5)` |
| `--danger` | `red` 75% mixed into `CanvasText` |
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
- **Radius (1):** `--radius` 0.5rem on controls and dialogs; a bottom-docked sheet squares its lower corners.
- **Border (1):** `--rule`, 1px in `--line`. The focus ring is `--focus`, 2px in `--accent`, offset 2px.
- **Layout dimensions (not spacing):** column 36rem, dialog 30rem (a sheet 36rem), dialog maximum height `100dvh` minus two `--space-2`, input minimum 12rem, 100% widths, 1px hidden legend. In `mocks.html` only: page 84rem, text measure 46rem, grid tracks 24.375rem (the 390px frame) and 20rem, frame minimum height 36rem (22rem with a dialog in the specimen), swatches 7rem by 3rem.
- **Mix ratios in the derived tokens:** 65%, 45%, 85%, 75%, and 50% for the dialog backdrop (`--line` over transparent).

### Colour uses

| Token | Where it is used |
|-------|------------------|
| `Canvas` | Page, field and dialog backgrounds; the label on the primary button |
| `CanvasText` | All content text; the hover border; the pressed primary fill |
| `--quiet` | Supportive text: `.quiet`, `role="status"`, placeholders, disabled text, a loading post |
| `--accent` | Links, the one `.primary` fill, the border, label and filled icon of an action that is on (`aria-pressed`), the current choice's border, the focus ring |
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

Every screen starts with the same `header` (a `.row`, one line, no rule below): the product mark on the left and the account switcher on the right.

- **Mark:** the text "⁂tap" as a plain link to the page start, `<a href="./" aria-label="FediTap"><abbr title="fedi">⁂</abbr>tap</a>`. Body size, weight 600, inherited colour, no underline, no logo. The aria-label makes screen readers say "FediTap" instead of reading the symbol. It is the only place the product name shows in the visible UI besides the Shortcut and Home Screen copy.
- **Dropdown:** a native `select` labelled "Account", hidden until an account is stored. Each account is `@handle@domain`, with " (reconnect)" appended when it needs connecting again; the last option is "Manage accounts". Choosing an account switches to it (the post reloads for it; one that needs reconnecting goes to its connect step). Choosing the last option opens the Accounts dialog and the select stays on the active account. It uses the same control tokens as inputs, shrinks and clips its text (`max-inline-size: 70%`) and never pushes the mark off at 320 px.

## Classes

| Class | What it is | Markup contract |
|-------|------------|-----------------|
| `.primary` | The one filled button: `--accent` fill, `Canvas` label (5.5:1 in light and dark). Disabled becomes a plain outline. One per screen; on the connection-expired screen it is Reconnect and Load is a normal button | `<button class="primary">Connect</button>` |
| `.field` | An input with a button inside its trailing end; the wrapper draws the border (an inset outline) and the input has none | `<div class="field"><input type="url"><button type="button">Paste</button></div>` |
| `.destructive` | Red label on the normal button | `<button class="destructive">Remove</button>` |
| `.button` | A link that looks like a button | `<a class="button" href download>Add Shortcut</a>` |
| `.quiet` | Secondary text (hints, meta) | `<p class="quiet">Replies are public.</p>` |
| `.actions` | Three equal columns under a post: Like and Repost are toggles (`aria-pressed`, an inline `svg` icon that goes from outline to filled), Reply is a plain button. Follow acts on the person, not the post, so it lives in `.byline`, not here. The icon is an `aria-hidden` inline `svg`, so the CSP is unchanged | `<div class="actions"><button aria-pressed="false"><svg>…</svg>Like</button><button><svg>…</svg>Reply</button></div>` |
| `.row` | Items side by side, wrapping, spread to the edges. A row that holds an input or `.field` never wraps: the input shrinks (`min-inline-size: 0`) and the button keeps its width, down to 320 px | `<div class="row"><input><button class="primary">Load</button></div>` |
| `.list` | A plain stack of choices. Each row is a real button, optionally followed by a second button | `<ul class="list"><li><button aria-current="true">@me</button></li><li><button>@other</button><button class="destructive">Remove</button></li></ul>` |
| `.byline` | The author line of a post or profile: name and handle on the left (handle and date on their own lines, so they never break mid-word), the Follow toggle at the trailing end. The button never wraps and is at least 6.5rem wide | `<div class="byline"><div><h2>Name</h2><p class="quiet"><span>@handle</span><span>Date</span></p></div><button aria-pressed="false">…Follow</button></div>` |
| `.post` | The post or profile being acted on, kept with the link field above it | `<article class="post"><h2>Name</h2><p class="quiet">@handle</p><p>Text</p><footer class="row quiet">…</footer></article>` |
| `.sheet` | Dialog modifier: docked to the bottom edge, full width up to 36rem | `<dialog class="sheet" aria-labelledby="t"><form method="dialog"><h2 id="t">Reply</h2>…</form></dialog>` |

Attributes the CSS also reads: `aria-pressed="true"` (an action that is on: accent border, label and filled icon; keeps its look under `aria-disabled`), `aria-current="true"` (the current choice, bold), `aria-busy="true"` (progress cursor; a busy button keeps its look and says what it is doing, see Loading).

## Copy

Every word on screen has to earn its place. The mocks and the app share these rules.

- **A label names the thing, in one to three words.** "Account", "Link", "Reply". Not "Fediverse handle or profile URL". The input accepts what it accepts; the placeholder shows the shape (`you@example.com`) and the error says what was wrong.
- **No help text by default.** Add supportive text only when a person would otherwise make a mistake or be surprised, and say only that thing in one short sentence. Never restate the label ("Your handle or profile link."), explain what a field is for, or reassure ("You sign in on your own server.").
- **Where explanation belongs.** What happens next goes on the button ("Connect", "Load", "Add Shortcut"; "Loading…" while it runs). Consequences of an irreversible action go in the confirmation. Background and troubleshooting go behind a disclosure ("Supported servers"), not in the flow.
- **Buttons are verbs, one or two words.** Sentences and trailing ellipses are not labels.
- **Status and errors state the result or the fix, not the process.** "Liked as @me", "Couldn't find me@example.com. Use a profile link." Not "Contacting your server…" repeated three ways.
- **One idea per screen.** If a screen needs a paragraph to explain itself, the screen is wrong, not the paragraph.
- **Connect, not sign in.** FediTap has no accounts of its own: the person links one they already have, and their server grants access. So the verb is Connect (button, heading, "Add account" in the Accounts dialog, Reconnect when the grant expires, "Connection expired", "Couldn’t connect"). Buffer says the same ("sign into your account to connect it"); Mastodon and Elk clients say Sign in because they are apps you live in. Remove stays Remove: it forgets the account on this device and does not revoke access on the server, so Disconnect would overpromise. The page where the server asks for approval is the server's own wording.
- **One heading for the link screen.** "Open a post or profile" in every state (ready, loading, loaded), so the title never jumps to Post or Profile above a "Link" field; the card below shows what was found. The field label is "Link" and the placeholder "Paste a link".
- **Same thing, same words everywhere.** One label per concept across screens (the account field is "Account" in the connect form, in the Accounts dialog and in the first-run screen), and the same wording in the live app.
- **Audit rule.** For each string ask whether removing it changes what a person does or understands. If not, remove it. Example from the first pass: the connect field had the label "Fediverse handle or profile URL" plus the help "Your handle or profile link. You sign in on your own server."; it is now the label "Account", the placeholder `you@example.com` and no help text.

## Screen recipes

- **Connect account:** `header`, `h1`, an intro (one plain line and three numbered steps: connect your account, open or share a link, then like, repost, reply or follow) shown only while no account is stored, a `form` with a labelled `input` and `.primary` Connect in one `.row`, the error directly below that row, one compatibility sentence below the form (Mastodon-compatible servers, WordPress and servers with the ActivityPub API), `details` "Supported servers" (what works as is, what WordPress needs, and that Lemmy and Misskey are not supported). The "Add Apple Shortcut" panel (a description of the share-sheet use on iPhone, iPad and Mac, the source link inline, then the Add Shortcut button) shows below, as on every screen except the unsupported one.
- **Open a post or profile:** `header` with the mark and the account dropdown, `h1`; a labelled `.field` (input with Paste inside) and `.primary` Load in one `.row`; status and error below the row. The field stays visible in the ready, loading and loaded states and keeps its value. On iOS only, the Shortcut panel and the Add to Home Screen disclosure sit below.
- **Post:** the link row, then `.post` with the Follow toggle in its `.byline`, all inside the `.card`; below it two labelled groups (`.group-label`: body text on a top rule): "Using API" holds the `.actions` row (Like, Repost, Reply; a profile has none) and "Using {host} links" the links the server advertises; the title is always "Open a post or profile", the author name is bold text (not a heading), and a status line below says what happened. Once a post is on screen Load is a plain button, so the action buttons are the only emphasis. With two or more accounts a quiet "Acting as @me" line sits under the actions. The post is removed while the next link loads or fails.
- **Accounts:** `dialog.sheet` opened only from the dropdown's last option: a heading, a `.list` of stored accounts (text and a `.destructive` Remove button each), then the add-account `.row` (field labelled "Add account", and Connect), and a Done button. Remove asks in place: the row becomes "Remove @me?" with Cancel and `.destructive` Remove, and the one-sentence explanation appears below the list; no second dialog opens on top. Close verbs: Cancel for a sheet that edits something (Reply), Done for one that only manages (Accounts). It cannot be dismissed while a connection runs.
- **Reply:** `dialog.sheet` with a label, `textarea`, a note on who can see the reply ("Replies are public." unless a Mastodon-compatible post is unlisted, followers-only or direct, in which case the reply keeps that reach and the note says so) and a `.row` of Cancel and `.primary` Send (disabled while empty). A reply mentions the author, so the author is notified.
- **Problems:** a `role="alert"` directly below the input it belongs to (the input gets `aria-invalid` and `aria-describedby`), technical detail in `details`. The person edits the value and presses the same primary button again, so a failure adds a button only when there is a different way forward (Use profile link, Reconnect).

## Decisions

- **Native web, not iOS.** No navigation bar, bar buttons, inset grouped lists, action sheets, status bar or grabber. A header with the name, a native dropdown for accounts, and a dialog for secondary tasks do the same jobs with elements the browser already provides.
- **One body size, one supportive size.** There are no large titles: a heading is the same size as the text under it and is told apart by weight and by the space above it. The screen title is the first line of the page, so it needs no size.
- **Four colours and a line.** `--accent` is the fixed brand blue `#00a6f5`, darkened in light mode (`#006fa6`, 5.5:1 against white; the brand blue itself is only 2.7:1) and used as is in dark mode (7.8:1 against black), so links read well and the primary button can use `Canvas` for its label in both schemes. The system `AccentColor` is not used. `LinkText` is not used, so links and the primary button share one blue.
- **Disabled is quiet.** There is no `GrayText`. A disabled control has `--quiet` text and a `--line` border, which is also what the supportive text looks like, so a disabled control reads as inactive rather than as a different colour.
- **Danger is one token.** CSS has no red system keyword, so `--danger` mixes `red` with the text colour.
- **Pressed is inverted.** A bordered button's pressed fill is `--line`; the primary button's is `CanvasText`. Hover is a `CanvasText` border. Touch devices see only the pressed state.
- **Errors are one card.** The `.problem` section holds the alert (a `<strong>` heading on its own line in `--danger`, the explanation in the text colour), any buttons, and a `details` ("What to do" or "Details") behind a hairline. Session ended is the same card, not a separate warning colour. Statuses are the `.pill`: inverted colours, a few seconds on screen (until the task ends), `aria-hidden` because the status line it mirrors is what a screen reader announces; the slow-server notice and its Cancel use the same pill. Statuses inside a sheet stay in the sheet.
- **Actions are toggles, undone by pressing again.** Like, Repost and Follow (in the byline) keep their place; when on, the icon fills, the border and label take the accent colour and the label switches to the done form ("Liked", "Reposted", "Requested"), with `aria-pressed` as the standard toggle signal. Pressing an on button undoes it. A status line below carries the past tense and the account: "Liked as @me.", "Follow request sent as @me." (a request is all the client knows), "Like undone." Where the server does not expose the activity ID, the button keeps its on look but is `aria-disabled` and the status says "This server doesn’t allow undo from here." Reply is not a toggle and is never locked: more than one reply is fine.
- **Follow sits with the author.** Like, Repost and Reply act on the post; Follow acts on the person, so it is a toggle at the trailing end of the byline, as in Mastodon, Elk and Bluesky. Its label is just "Follow" (no "Follow author"), the action row is three equal columns that fit at 320 px, and a profile shows only the byline.
- **Busy and failure.** The pressed button says what it is doing (Liking…, Reposting…, Undoing…, Sending…) and the other actions are `aria-disabled`, not `disabled`, so focus stays put. A failed action returns the button to its previous state; pressing it again is the retry.
- **Alternatives weighed and rejected** : label-only toggles ("Liked", no icon: a "Liked" button does not say it can be pressed), a result row with an inline Undo link (the row jumps, results stack and it is a button dressed as a link), and a delayed send with an Undo bar (closing the page during the delay silently drops the action). Mastodon, Elk, Ivory, Bluesky and X all toggle in place with a filled, coloured icon; Gmail-style undo bars are for actions that are not toggles.
- **Actions are real buttons.** The same bordered button as everything else, in the `.actions` row under the post and the byline. Two styles exist for controls: a button looks like a button, navigation looks like a link (the header mark, Source code); there is no button dressed as a link and no row dressed as a button.
- **The field is never hidden or disabled by an error.** An input that has been shown stays shown, with its value. While a request runs the input is `readonly` and its buttons `aria-disabled` with `aria-busy` on the pressed one, so text and focus are never lost; there is no loading card and no Change link. A failure prints below the field and the field is editable at once.
- **Paste lives inside the link field.** A bordered button segment at the trailing end of the `.field`; it reads the clipboard, fills the field and submits. Load is the one filled button to the right of the row.
- **Failures with no field sit under the title.** The storage-blocked screen has no field to attach the alert to.
- **One dialog element.** The accounts and reply dialogs use `.sheet` (bottom-docked); the removal confirmation is the plain centred dialog. The bottom-docked form is not limited to narrow screens: it stays centred and at most 36rem wide on a desktop, which keeps the CSS free of media queries.
- **The legend is hidden, the label is visible.** A `fieldset` names a group for assistive technology; the visible name is a heading or a label.
- **Links keep a 44 px target where they stand alone.** A link inside a `.row` is a 2.75rem flex item. A link inside running text is exempt.
- **Residual exceptions.** The disclosure summary is 2.75rem tall with its text near the top, because `display: flex` would remove its marker. The dialog backdrop and the mock frame's scrim use `--line` at 50%, not a fifth colour.
- **One placeholder.** Waiting is shown by the one pattern under Loading: grey bars for the post and the action buttons held in place, greyed and inert, so nothing jumps when the post arrives.
- **Server consent and system sheets are drawn with the same components.** They are not our pages (A5, B1, I1, I3, I5), but the mock draws them with the same elements so the flow reads as one system.
- **Mock-only styling stays in `mocks.html`.** The frame, the scrim behind an open dialog and the `data-force` rules that show hover, pressed and focus on a static page live in its inline style.
- **Not adopted:** Dynamic Type through `font: -apple-system-body`, a toggle for the colour scheme, transitions, and per-component colours.

## App states and live regions

`src/app.css` holds only the components. Which parts of the page show is decided by the Svelte components (`{#if}` on `app.view`: `signed-out`, `ready`, `loaded`, `unsupported`), not by CSS, and copy for the Home Screen app or Safari is chosen the same way. An empty `role="status"` or `role="alert"` is visually hidden, never `display: none`, so a screen reader announces text put into it later. A message slot (`section` with an id ending in `-error`) holds one alert, its buttons and an optional `details`; it takes no space when empty. The only motion is the pulsing dot in the link field, the placeholder bars and the pill's slide-in, all of which stop under `prefers-reduced-motion`. `main[data-view]` carries the screen name and `button[data-action]` the action, so tests and scripts never depend on copy.

## Loading

Every task that waits on a server (opening a link, sending an action, undoing, signing in, renewing a token) looks the same. `runTask` in `src/state.svelte.js` is the one place that does it.

1. **The pressed control owns the message.** It says what it is doing (Loading…, Sending…, Undoing…, Looking up…, Signing in…) with `aria-busy`, keeps its fill (a primary button stays primary) and, except beside an input, keeps its width, because `BusyLabel` reserves the widest text it can show (idle, working and done, the done one in bold). Everything else dims through the disabled fieldsets. There is no second status line for it.
2. **One progress cue.** A dot (`.pulse`, decorative, no width) pulses at the end of the link field while a link loads. A hidden live region (`#task-announce`) tells screen readers what is happening. Both start after 150 ms, so a quick response shows nothing extra.
3. **Nothing on screen is thrown away early.** While another link opens, the loaded post and its actions stay, dimmed and `inert`, and the title does not change; nothing below them moves. With no post yet, a placeholder card (grey bars shaped like the byline and text) says "Loading {host}…", and the action groups appear greyed and inert below it, with the buttons the account is known to have. The post is replaced in one step when the new one arrives. A link that fails leaves nothing on screen for it.
4. **A slow task says so.** After 5 s the pill says "Still waiting for your server…". Opening a link and the sign-in lookup add Cancel, which aborts the request . Sending, undoing and token requests are never cancellable, because they may already have gone through (or, for a token, must be saved).

Only read-only requests listen for Cancel (`src/lib/signal.js`): discovery, the Mastodon instance probe, opening a link through the proxy or the Mastodon search. The ActivityPub proxy, the Mastodon `GET` calls and WebFinger are cancellable; every `POST` is not.
