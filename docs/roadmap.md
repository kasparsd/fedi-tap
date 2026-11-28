# Roadmap

Open work that needs the owner's decision. Plans for work in progress are in `docs/plans/`.

- **A dedicated origin.** The app is served from `kasparsd.github.io`, an origin shared with every other project published there, so the stored tokens and `script-src 'self'` cover all of them. A custom domain would fix this, but Web App Origin Migration needs same-site origins and `github.io` is a public suffix, so moving later means everyone installs again and signs in again. Postponed by the owner (2026-11-25); decide before anyone depends on the installed app. See [the review](research/modern-web-guidance.md).
- **Follow the phone's text size.** `<meta name="text-scale" content="scale">`, with the root font size left unset. Conflicts with "Dynamic Type: not adopted" in [components.md](ux/components.md).
- **`autocomplete="username"` on the handle field.** Small gain (no password, the credentials live on the user's server); the link field keeps `autocomplete="off"`.
- **Toggle names.** Like, Repost and Follow set `aria-pressed` and also change their label ("Liked"), so a screen reader hears the state twice. Fixing it means a fixed name (breaks "label in name") or dropping `aria-pressed` (the tests read it).
- **A way back to the empty start screen.** With an account, the header no longer has the "⁂tap" link. Decide whether the installed Home Screen app, which has no address bar, needs one.
- **The header is not a banner landmark.** `header` sits inside `main`.
- **Account switcher on real devices.** Not yet tried on a phone with VoiceOver or TalkBack, nor with the system's enlarged text; see [the checkpoint](checkpoints/2026-11-28-account-switcher.md).
- **Smaller review items not done:** a `beforeinstallprompt` install button, `preconnect` to the account's server, carrying `{ cause }` on `Problem`, `focus({ preventScroll })` in `focusFirst`, `scroll-padding` while a pill shows, the declarative WebMCP experiment, and gating `Notices` text for VoiceOver's repeated-message skipping.
- **Check Undo on a real WordPress site (owner).** With a signed-in account, Like or Follow, then Undo. The [fix](checkpoints/2026-11-28-activitypub-undo.md) rests on the plugin's source and the mock server.
