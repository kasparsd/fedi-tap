# ⁂tap

[![CI](https://github.com/kasparsd/fedi-tap/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kasparsd/fedi-tap/actions/workflows/ci.yml)
[![Pages](https://github.com/kasparsd/fedi-tap/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/kasparsd/fedi-tap/actions/workflows/pages.yml)

Like, repost, reply to or follow a Fediverse post or profile from your own account, without leaving the page you found it on.

FediTap is a small static web app. Open it in a browser, connect your account, paste a link and choose an action. On iPhone, iPad and Mac an Apple Shortcut adds FediTap to the share sheet, so sharing a link from any app opens FediTap with the link filled in.

**Use it:** <https://kasparsd.github.io/fedi-tap/>

## What it does

- **Like, Repost and Follow** are toggles. Each shows its done state (Liked, Reposted, Follow requested) and offers **Undo**.
- **Reply** opens a sheet that names the post and your account and says who can see the reply. The author is mentioned. A failed send keeps your draft.
- **Posts and profiles.** A post link shows the post with its author. A profile link offers only Follow.
- **Several accounts.** Connect as many as you like and switch from the account menu. Removing an account clears it from this browser only.
- **Installable.** Add it to the Home Screen on iOS and Android. It keeps its own sign-in, separate from the browser.

## Supported servers

| Server | How FediTap connects |
|---|---|
| Mastodon, GoToSocial, Pleroma, Akkoma | Mastodon API. FediTap registers itself as an app on your server the first time you connect |
| Pixelfed | Mastodon API, best effort (like, reply and follow) |
| WordPress with the ActivityPub plugin 9.4 or later | Client-to-server ActivityPub. Enable **ActivityPub API** under **Settings › ActivityPub › Advanced** |
| Other servers with an ActivityPub client API | The [Social API Basic Profile](https://swicg.github.io/activitypub-api/basicprofile) with OAuth and PKCE |

Lemmy and Misskey use different APIs and are not supported. FediTap picks the backend itself: it looks for the ActivityPub client API first, then for a Mastodon-compatible `/api/v1/instance`.

## Connect and use

1. Open FediTap and enter your handle (`@you@example.social`) or a link to your profile. Approve access on your home server.
2. Choose **Paste** in the link field, or type a link and choose **Open**, then choose an action.
3. On iPhone, iPad or Mac, choose **Add Apple Shortcut**, open the file in Shortcuts and add it. Share a Fediverse link to **FediTap** to open the page with the link filled in.
4. On Android, install the app from your browser's menu (**Install app** or **Add to Home screen**). Then share a Fediverse link to **⁂tap** from the share sheet, and long-press the home-screen icon for **Paste a link**. Sharing works in Chrome, Edge, Brave and Samsung Internet; Firefox for Android doesn't reliably support it.

## Privacy and security

- Accounts and tokens live in your browser's local storage and are sent only to your own server. There is no FediTap backend.
- The shortcut sends only the shared link, in the page address, and never receives credentials.
- Remote text is shown as plain text; HTML from servers is never rendered. A strict Content Security Policy forbids inline code.
- Sign-in uses OAuth with PKCE and checks that the account that signs in is the one you asked for. To end access completely, also revoke FediTap in your server's settings.

## Develop

```bash
npm install
npm run dev        # https://localhost:8443/_dev/ with a mock server, no real account needed
npm run validate   # lint, svelte-check, unit tests, build and static checks
npm run e2e        # Playwright end-to-end tests (first run: npm run e2e:install)
```

The app is Svelte 5 and Vite, built to a static `dist/` and published to GitHub Pages on every push to `main`. The dev server fakes ActivityPub, Mastodon API and OAuth servers, with sample users for each failure path.

Details are in [docs/development.md](docs/development.md): hosting, backends, the mock server, testing, CORS and the shortcut build. Interface rules are in [docs/ux/components.md](docs/ux/components.md) and dated test evidence is in [docs/checkpoints/](docs/checkpoints/).
