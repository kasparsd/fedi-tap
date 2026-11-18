# Interface components

The mocks drifted: every screen restyled labels, buttons and notices on its own. This document lists the shared elements and fixes one pattern for each, so markup and CSS are written once (`components.css`) and reused by the mocks and, later, the app. The reference is Apple's Human Interface Guidelines (iOS grouped lists, navigation bars, sheets, action sheets), not a web component library or a generic "card" look.

## Principles

- **Follow the platform.** Forms look like Settings: grouped inset lists with a header above and help text below each group. Navigation looks like a navigation bar with a title and text bar buttons. Secondary tasks are sheets. Destructive confirmation is an action sheet.
- **One prominent action per screen.** At most one filled button; everything else is a plain text button or a list row. Filled buttons are not repeated as a row of equals.
- **Rows, not tiles.** Group related things as rows in one grouped list (separators inside, one rounded container). Avoid grids of boxes, nested cards and a rounded box around every piece of text.
- **Structure from layout, not decoration.** Hierarchy comes from type size, weight, spacing and system colours. No tinted callout boxes with a coloured edge, no gradients, shadows, emoji, icons used as ornament, or pastel fills.
- **Words carry the state.** A status or error is plain text in the footer of the thing it refers to, in the secondary or red system colour, not a separate coloured panel.
- **Everything has a state.** Default, pressed, focus-visible, disabled, selected, loading, error.
- **44 pt minimum target, system text styles, rem units, light and dark by system colours only.**

## Tokens

Defined once in `components.css` as custom properties. Hex fallbacks first, then a `prefers-color-scheme: dark` block, then an `@supports (color: -apple-system-label)` block that swaps in the live system colours in Safari. A token is never redeclared as a "fallback" (the later declaration would win and break it).

| Group | Tokens |
|-------|--------|
| Colour | `--bg` (grouped background), `--surface` (secondary grouped background, list fill), `--sheet-bg` and `--sheet-surface` (elevated levels used inside sheets), `--label`, `--label-2` (secondary), `--label-3` (tertiary: placeholder and disabled), `--separator`, `--fill` (pressed rows, placeholders, disabled prominent button), `--tint`, `--destructive`, `--warning`, `--on-tint`, `--scrim` |
| Type | `--text-large-title` 34 bold, `--text-title` 22 bold, `--text-headline` 17 semibold, `--text-body` 17, `--text-subhead` 15, `--text-footnote` 13, `--text-caption` 12, each a `font` shorthand in `rem` relative to the body size, so Dynamic Type (`font: -apple-system-body` on the root) scales everything |
| Space | `--space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 20, `-8` 32 (4-point scale, in `rem`) |
| Shape | `--radius` 10 for lists, buttons and the top corners of sheets; `--target` 44 pt minimum |
| Motion | `--ease` 200 ms for the disclosure chevron; all animation and transitions off under `prefers-reduced-motion` |

## Inventory

Class names in the second column; the markup contract is the comment at the top of each block in `components.css`, and every component is shown in all its states in the first section of `mocks.html`.

### Structure
| Component | Classes | Purpose and notes |
|-----------|---------|-------------------|
| Screen | `.screen` | Full-height container, safe-area padding via `--inset-top`, `--inset-bottom`, `--bottom-bar`, grouped background. Children are inset 1 rem except the navigation bar |
| Large title, lede | `.large-title`, `.lede` | Screen title for Sign in and the unsupported state; one-sentence purpose below it |
| Navigation bar | `.navbar`, `.navbar-title` | Always three children: leading, title, trailing. Title is inline and centred |
| Bar button | `.bar-button`, `.is-strong`, `.is-warning`, `.has-menu` | Text button in the bar: Cancel, Done, Send, Edit and the account button (`.has-menu` adds a chevron, `.is-warning` when the session ended) |
| Section | `.section`, `.section-header`, `.section-footer` | The unit of layout; header is uppercase footnote, footer is footnote in `--label-2` and holds help, status and errors. `.is-split` footer puts two items at the edges (visibility and counter) |
| List | `.list` | The one rounded container (radius 10, `--surface`) with inset separators between children |
| Sheet | `.scrim`, `.sheet`, `.is-tall`, `.sheet-grabber` | Modal task over a scrim. The sheet holds a navigation bar and sections |
| Action sheet | `.action-sheet`, `.action-sheet-header` | Two lists: choices (centred rows, destructive in red) and a separate Cancel |

### Rows and inputs
| Component | Classes | Purpose and notes |
|-----------|---------|-------------------|
| Row | `.row`, `.row-main`, `.row-title`, `.row-subtitle`, `.row-accessory` | Title, optional subtitle, accessory. Accessories: value text, `.is-chevron`, `.is-check`, `.spinner`, or a button or link with `.is-button` (add `.is-destructive` for Remove) |
| Selection row | `.row` with `.is-selected` or `aria-checked="true"` | The check accessory shows only on the selected row |
| Button row | `.row-button`, `.row-destructive` | A row that acts: tint text, red for destructive. Finished: `.is-done` plus a check accessory and `disabled` |
| Text field row | `.row-field`, `.field` | Borderless input inside a list row; optional left label as `.row-title`; trailing accessory button. `aria-invalid="true"` turns the text red; the message is the footer |
| Text area row | `.row-field` with `textarea.field` | Multi-line; counter in a `.is-split` footer |
| Disclosure | `.disclosure`, `.disclosure-body` | Native `details`; the summary is styled as a row and the chevron turns when open |

### Controls
| Component | Classes | Purpose and notes |
|-----------|---------|-------------------|
| Button | `.button` | Base: full width, 44 pt minimum |
| Prominent button | `.button-prominent` | The one main action: filled tint, white label, 50 pt. Disabled and loading become `--fill` with grey text |
| Plain button | `.button-plain` | Secondary action: tint text, no background |
| Destructive button | `.button-destructive` | Removal outside a list: red text |
| Link | `.link` | Inline navigation in text: tint, underline on hover and focus |

All interactive components have `:active` (or `.is-pressed`), `:focus-visible` (or `.is-focus`) and `:disabled` / `[aria-disabled="true"]` (or `.is-disabled`) states. Loading is `aria-busy="true"` plus a `.spinner`.

### Feedback
| Component | Classes | Purpose and notes |
|-----------|---------|-------------------|
| Status text | `.section-footer.status` | Result or progress ("Liked as @me.", spinner plus "Loading post…"); `role="status"` |
| Error text | `.error` inside `.section-footer` | Red semibold first line, secondary explanation below; `role="alert"`; details go behind a disclosure |
| Warning text | `.warning` inside `.section-footer` | Same, orange; used when a session ended |
| Activity indicator | `.spinner` | In the button, row, bar button or footer that caused the work |
| Placeholder | `.placeholder`, `.is-short`, `.is-medium` | Flat `--fill` bars inside a post row while loading; no shimmer |

### Content
| Component | Classes | Purpose and notes |
|-----------|---------|-------------------|
| Post | `.post`, `.post-author`, `.post-handle`, `.post-body` | One row with stacked text, used for posts and profiles. The source and date are a normal row below it (`Change link` or `Open original` as the accessory) |
| Account identifier | `.row-title` over `.row-subtitle` | `@handle` over domain in account rows |

## Decisions

Things the spec left open, decided while building the mocks.

- **Prominent button.** At most one per screen, always outside a list. Pressed dims, disabled and loading switch to a `--fill` background with tertiary or secondary text (no opacity fade), so a disabled Continue is obviously inert.
- **Actions are a grouped list, not tiles.** Like, Repost, Reply… and Follow are button rows in one list. A finished action gets a trailing checkmark, turns secondary and cannot be pressed again; the footer of that list holds the status ("Liked as @me."). Follow on a profile is a single button row. Reply… ends with an ellipsis because it opens a sheet.
- **Next steps are rows.** "Undo Like", "Open another link" and "Change link" (on failure) are button rows or plain buttons, never inline links, so every target is 44 pt.
- **Paste is a row.** "Paste from Clipboard" is the second row under the field in the same list. It loads the link at once. Typing needs an explicit "Open link" prominent button, shown disabled until the input is a valid link.
- **Failures with a field use the footer; failures without one use the lede.** The storage-blocked screen has no field, so the red line sits in the `.lede` under the title.
- **Errors lead with the consequence in the first line.** The explanation follows in secondary colour; HTTP codes and setup steps live in a disclosure under the Try again button.
- **Retry is prominent, alternatives are plain.** On a failed lookup, Try again is filled and Change link is plain. On a failed handle, the profile-link fallback is the filled button because retrying the same input would fail again.
- **Edit mode shows Remove as a trailing red button.** The iOS minus-in-circle control is a decorative icon, so it is not used.
- **Warnings.** A session that ended is orange: the account bar button (`.is-warning`) and the footer heading (`.warning`). Nothing else uses orange.
- **No empty-state component.** The Open a link screen is the empty state; it asks for one thing with one field and a Paste row.
- **Server consent** (A5, I3) is not our page, but the mock builds it from the same components so the flow reads as one system.
- **Sheet levels.** Inside a sheet the background is elevated one level (`--sheet-bg`, `--sheet-surface`), which has no `-apple-system-*` keyword, so those two tokens are plain hex values that equal the system colours.
- **Safe areas** are CSS variables on `.screen` (`--inset-top`, `--inset-bottom`, `--bottom-bar`) defaulting to `env(safe-area-inset-*)`; the mocks only override them for the phone frame.
- **Chevron and check** are drawn with borders, not glyphs or icon fonts.
- **Mock-only classes** (`.phone`, `.statusbar`, `.safari`, `.home`, `.stage`, `.spec`) are presentation devices defined in the inline style of `mocks.html`; they are not part of the component set.

## Screen recipes

- **Sign in:** large title and lede; Section (header "Account") with one text field row and the help in its footer; the prominent Continue; the Shortcut as its own Section; a Server not working disclosure.
- **Open a link:** inline title with the account bar button; Section (header "Link") with a text field row and a Paste from Clipboard row; Shortcut Section below.
- **Post:** Section with the post row and a source row; Section of action rows (Like, Repost, Reply…, Follow) whose footer carries the status; a Section with next-step rows after an action.
- **Accounts sheet:** Section of selection rows; Section with an Add account button row and the footer; Edit swaps the accessories for red Remove buttons.
- **Reply sheet:** bar buttons Cancel and Send; text area row; split footer with visibility and counter.
- **Remove account:** action sheet.
- **Problems:** the same screen with the error in the relevant footer, one prominent Try again, a plain alternative and the details in a disclosure.
