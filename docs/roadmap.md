# Roadmap

Open work that needs the owner's decision. Plans for work in progress are in `docs/plans/`.

- **A dedicated origin.** The app is served from `kasparsd.github.io`, an origin shared with every other project published there, so the stored tokens and `script-src 'self'` cover all of them. A custom domain would fix this, but Web App Origin Migration needs same-site origins and `github.io` is a public suffix, so moving later means everyone installs again and signs in again. Postponed by the owner (2026-11-25); decide before anyone depends on the installed app. See [the review](research/modern-web-guidance.md).
- **Follow the phone's text size.** `<meta name="text-scale" content="scale">`, with the root font size left unset. Conflicts with "Dynamic Type: not adopted" in [components.md](ux/components.md).
- **`autocomplete="username"` on the handle field.** Small gain (no password, the credentials live on the user's server); the link field keeps `autocomplete="off"`.
- **Toggle names.** Like, Repost and Follow set `aria-pressed` and also change their label ("Liked"), so a screen reader hears the state twice. Fixing it means a fixed name (breaks "label in name") or dropping `aria-pressed` (the tests read it).
- **Account switching.** "Manage accounts" is still an option of the header `<select>`, so a desktop arrow key opens a dialog. A separate button crowds the header at 320 px. Related open items in [the UI consistency plan](plans/ui-consistency-review.md): the Accounts sheet doesn't mark the active account and focuses "Add account" on open.
- **Smaller review items not done:** a `beforeinstallprompt` install button, `preconnect` to the account's server, carrying `{ cause }` on `Problem`, `focus({ preventScroll })` in `focusFirst`, `scroll-padding` while a pill shows, the declarative WebMCP experiment, and gating `Notices` text for VoiceOver's repeated-message skipping.
