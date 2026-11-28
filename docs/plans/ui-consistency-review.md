# UI consistency review and proposal

Goal: remove inconsistent elements and unclear grouping across the user-facing panels, and use the remaining room to make the main task (open a link, act on it) feel more finished. Follows `docs/plans/ux-redesign.md`; canonical component rules live in `docs/ux/components.md`.

Method: ran the dev server with the mock backend and walked every panel in dark and light mode (signed out, sign-in error, signed in and empty, link error, post, post after Like, profile, Reply sheet, Accounts sheet, Remove confirmation), then read the matching components. Not reviewed visually: the session-expired card (`ReauthCard`), the storage-blocked card (`Unsupported`), the iOS-only Home Screen hint and the 320 px width. Findings on those come from source only.

## Findings

### Inconsistencies

1. **Two headings say the same thing.** The page title (`<h1>`, "Connect account", "Post", "Profile") and the form's visible label repeat each other, and the signed-out page stacks three headings before the field: "Connect account", "Act on Fediverse posts…", "Account". The title "Post" or "Profile" says what was loaded, which the card below already shows.
2. **"Connect account" names two different things.** The header dropdown's last option is "Connect account", but it opens a sheet titled "Accounts" that mainly lists and removes accounts. Inside the sheet, "Accounts" holds a field labelled "Account" with a Connect button. The reconnect card has a button also called "Connect account" that opens the same sheet.
3. **Sheets have different shapes.** Reply and Accounts dock to the bottom and close with Cancel or Done. Remove is a centred dialog stacked on top of the docked Accounts sheet (two modals open at once, two backdrops).
4. **Close verbs vary.** Cancel (Reply, Remove), Done (Accounts), none for the error panels.
5. **The primary button never moves on.** "Open" stays filled blue after the post has loaded, so it competes with the actions that matter next (Like, Repost, Reply, Follow), which are all outlined. The disabled filled Send in the Reply sheet looks like a secondary button until text is typed.
6. **Heading weight is reused for data.** The author's name ("Dana Writer", "Zed Remote") is an `<h2>` drawn in the same weight as section headings like "Add Shortcut for iOS". On a profile there is no other heading in the card, so the name reads as a section title.
7. **The date uses the browser locale ("2026. gada 17. nov.") while the interface is English only.** Mixed languages in one line.
8. **Follow is the only action outside the action row.** It sits in the byline, right-aligned, while Like, Repost and Reply are in a row below. This was a deliberate choice (`4f71a23`) but it makes the byline a second control area, and on a profile it is the only action.
9. **The plan says the Shortcut card is iOS-only and never shown signed out, but it shows on desktop and signed out.** Either the rule or the behaviour is stale (the browser pane reports a non-iOS device).
10. **"Source code" sits between the heading and the button in the Shortcut card.** The link about the thing precedes the thing, and it competes with the real action for attention.
11. **Messages use three different shapes.** A bold-title paragraph with a "What to do" or "Details" disclosure (link errors), an inline status line (Liked as…), and the reconnect card (legend, bold title and alert repeating "Connection expired" twice in source).
12. **Pressed-state feedback is weak.** After Like, only the heart turns blue and the border changes slightly. The status line below ("Liked as @alice@localhost. Press Like again to undo.") is the only explicit confirmation, and it is separated from the button by a gap.

### Unclear grouping

- On the signed-in screen the first group ("Open a post or profile" + link field) and the result (card + actions) are separated only by a rule, while the Shortcut card follows with the same visual weight as the post. Three sections of equal weight stack in one column.
- The Shortcut section appears below the post actions, so after Like the confirmation line sits between the actions and an unrelated promotion.
- The header holds the account but the actions say "as @alice…" only in the status line; nothing near Like or Reply says whose account will act.
- "Supported servers" and the explanatory sentence ("Works with Mastodon-compatible servers…") say the same thing in two places on the signed-out screen.
- The Accounts sheet puts the destructive Remove next to the account name and the connect form below it with no separator, so "add" and "remove" read as one list.

## Opportunities

- **Make one screen tell one story.** Signed out: pitch, field, supported servers. Signed in: link field, then the result. Everything else (Shortcut, Home Screen) moves out of the main flow.
- **Show whose account will act** next to the actions, which also teaches the account switcher.
- **Make results self-explanatory** with a persistent pressed state (filled icon, "Liked" label) so the confirmation sentence can shrink to errors and ambiguous results only.
- **Use one dialog pattern** so account management feels like one place.
- **Reduce copy.** Several strings explain the interface instead of the task ("Press Like again to undo", "Signs out here only…").

## Proposal

### 1. Headings and labels

- Drop the visible `<h1>` text for signed-in screens, or make it the post's author and keep a visually hidden `<h1>` for assistive technology. Keep one heading per section: signed out has "Connect account" as the form's only heading; the pitch becomes a plain paragraph.
- Rename the dropdown option to "Manage accounts" and the sheet title to "Accounts". The sheet's field label becomes "Add account" (placeholder stays `@you@example.com`). The reconnect card's second button becomes "Use another account".
- Author name becomes a `<strong>` in the byline, not an `<h2>`.

### 2. Primary-button logic

- One filled button per screen: Open before a post is loaded; after loading, Open becomes a normal button and no action is primary. Send in the Reply sheet is the sheet's primary and disabled state gets a distinct appearance (lower contrast with a dashed or plain border, not a faded fill).

### 3. One dialog pattern

- Remove opens inline in the Accounts sheet: the row swaps to "Remove @alice? Cancel / Remove" in place, with no second modal. Close verb is Cancel for sheets that edit something (Reply) and Done for sheets that only manage (Accounts); document the rule in `docs/ux/components.md`.

### 4. Post card and actions

- Keep Follow in the byline, but give it the same shape as the other actions (same height, icon, label), and make the card a single bordered group with the actions inside it so the card reads as one object: byline, text, link, actions.
- Pressed state: filled icon, label "Liked", "Reposted", "Following", and a small caption below the row for failures only. Success confirms in the button itself.
- Add "Acting as @alice@localhost" as a quiet line under the actions (hidden when only one account is stored and it was just used).
- Format the date with `en` or `Intl.RelativeTimeFormat` consistently, or drop it from the byline and keep it in the "View on host" footer.

### 5. Move secondary material out of the way

- Shortcut card: show only on iOS (as documented) and move below the fold or into a collapsed `<details>` named "Share from your phone"; put "Source code" as a quiet link after the button.
- Merge "Supported servers" and the intro sentence into one disclosure.

### 6. Messages

- One `Problem` shape for every failure (title, message, optional button, optional details); the reconnect card reuses it with its two buttons instead of its own fieldset, legend and alert.

## Todos

- [ ] Verify the unreviewed panels in the browser: reconnect (`erin`), storage blocked, Home Screen hint, 320 px
- [x] Headings: remove duplicate h1/legend text, author name as strong
- [x] Rename "Connect account" option, sheet title and field labels
- [x] Inline Remove confirmation inside the Accounts sheet
- [x] Primary-button rules and disabled style
- [x] Pressed-state labels and "Acting as" line
- [x] Date format
- [x] Shortcut card gating and order; merge server copy
- [x] Unify problem and reconnect messaging
- [x] Update `docs/ux/components.md` with the dialog, button and message rules, then re-run `npm run validate`

## Walkthrough 2026-11-25

Drove every state against the mock (normal and 6.5 s slow servers) at 390 px in dark and light, plus 320 px and desktop: signed out, every sign-in failure (empty, bad handle, not a profile, API off, wrong account, denied), the authorize round trip, post, profile, long and followers-only posts, Like/Repost/Follow and undo, Reply, every link failure, editing the link, Accounts with one and two accounts, Remove, Mastodon account, both reconnect cases, the slow notice with Cancel and a slow send.

Fixed:

- [x] Slow-notice pill: Cancel sat below the text (the section's flow margin) and the end padding was doubled
- [x] Action labels broke mid-word ("Reposte/d" at 390 px, "Repos/t" at 320 px): `.actions` is at most three equal columns, two when a label won't fit, labels never wrap; a group of one or two keeps the same button width
- [x] "Remove @alice@localho/st?" broke mid-word: the question takes its own line, Cancel and Remove share the next
- [x] The connection-expired message was plain red text, the only failure outside the `.problem` card
- [x] "Canceled." beside "Connection cancelled": one spelling, "Cancelled."
- [x] After a denied or wrong-account return the field was empty but marked invalid: what was typed is put back
- [x] The loading placeholder's Follow was a thin bar, not button-sized (selector specificity)
- [x] With two accounts and server links, nothing named the acting account; the "Acting as" line now always shows with two or more accounts, under the API group

Open (need a decision):

- [x] Repost was offered on followers-only and direct posts: it is now greyed for any post that isn't public or unlisted, a tap says why, and the server's Repost link is left out
- [x] The Accounts sheet doesn't mark which account is active (2026-11-28, account switcher)
- [x] Opening the Accounts sheet focuses "Add account", so on a phone the keyboard covers the list when the person only wanted to switch or remove (2026-11-28: it focuses the current account)
- [ ] Text that isn't a link in the link field gets the browser's "Please enter a URL." bubble, while the account field answers with the app's own card ("Check the account")
- [ ] The Reply sheet stacks two headings: "Reply" and the field label "Your reply"
- [ ] A profile shows Follow twice: unlabelled in the byline (API) and in the labelled server-links group; a post's API buttons are labelled "Using API"
- [ ] "Not a Fediverse post or profile" and "This isn't a post or profile" are near-identical titles for different failures, and the first says "ActivityPub data"
- [ ] The header select clips " (reconnect)" to "(recon…" at 390 px
- [ ] A long post's paragraphs have no space between them

## Decisions

- Follow stays in the byline.
- The Shortcut card shows on every device (it works on iOS, iPadOS and macOS) and now explains the share-sheet use.
- The reconnect card keeps its structure: its legend is hidden, so the repetition was not visible.
- The post card keeps the single-rule style from `components.md`; no border box was added.
