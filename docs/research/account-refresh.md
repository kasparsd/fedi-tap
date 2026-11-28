# Keeping saved accounts up to date (2026-11-28)

Question: FediTap reads an account's details only at sign-in, so a release that saves something new (the profile photo) leaves connected accounts without it. Should the account list have a refetch button?

Answer: no. Refresh quietly in the background, with no new interface.

## What goes stale

| Saved at sign-in | Seen as | Refresh in background? |
|---|---|---|
| `avatar` | Header and Accounts sheet circles | Yes |
| `intents` | The "Using {host} links" group | Yes |
| `handle` | Account names, "Liked as @…" | No: it names the account the person approved, and rarely changes |
| `outbox`, `proxy`, `followers`, `token_endpoint`, `client_id` | Not seen | No: where tokens and posts go changes only by signing in |
| Scopes | Not seen | Can't: new access needs the person's consent |

## What other clients do

From a reading of each project's source on 2026-11-28 (default branch). This shows what the code calls, not how each app behaves on a device. I found no control for refetching accounts in the paths read.

| Client | When it refetches your own account | Which accounts | On failure |
|---|---|---|---|
| [Mastodon for Android](https://github.com/mastodon/mastodon-android/blob/4f503d6/mastodon/src/main/java/org/joinmastodon/android/api/session/AccountSessionManager.java) | App start, if older than 24 hours | All | Ignored |
| [Mastodon for iOS](https://github.com/mastodon/mastodon-ios/blob/f3dc8d3/MastodonSDK/Sources/MastodonCore/AuthenticationServiceProvider.swift) | App activation, if older than 24 hours | All | Silent; an unauthorized answer is handled |
| [Elk](https://github.com/elk-zone/elk/blob/ff32c55/app/composables/users.ts) | App load and account switch; after a profile edit | Current | Not checked |
| [Pinafore](https://github.com/nolanlawson/pinafore/blob/eb975d8/src/routes/_actions/instances.js) | When the instance is set up or shown; cached copy first | Current | Unauthorized signs out |
| [Phanpy](https://github.com/cheeaun/phanpy/blob/846d239/src/utils/store-utils.js) | Sign-in, viewing your own profile, after editing it | The one viewed | Logged |
| [Tusky](https://github.com/tuskyapp/Tusky/blob/43ae0bb/app/src/main/java/com/keylesspalace/tusky/MainViewModel.kt) (this copy dates from 2025-05) | Main screen start | Current | Logged |
| [Pachli](https://github.com/pachli/pachli-android/blob/3d9eddf/core/data/src/main/kotlin/app/pachli/core/data/repository/AccountManager.kt) | Account switch | Chosen | The switch fails |
| [Ice Cubes](https://github.com/Dimillian/IceCubesApp/blob/98098b9/Packages/AppAccount/Sources/AppAccount/AppAccountViewModel.swift) | App load; account rows when shown | Current, then each row | Ignored |

The common pattern is automatic. The official apps, which refresh every account, limit it to once a day. FediTap shows every account in the header, so it has the same need.

Pachli's blocking check doesn't fit FediTap: a switch here must work without waiting for the server.

## User flows

| Flow | Today | Proposed |
|---|---|---|
| A release saves a new detail | Missing until the person signs in again, with no hint | Filled in on the next open |
| Share a link to FediTap (main flow) | Post loads | Same speed; refresh starts after the link has loaded |
| Photo changed on the server, old address gone | Initials until sign-in | The failed image triggers a refresh |
| Photo changed, old address still works | Old photo | New one within a day |
| Server turns on interaction links | Hidden until sign-in | Shown within a day, from the next open |
| Account needs reconnecting | Card with Reconnect | Unchanged; an ActivityPub photo still refreshes, as the profile is public |
| Offline or server down | Saved values | Saved values, no message, tried again on the next open |
| Account removed while refreshing | n/a | The result is dropped; the account stays removed |
| Home Screen app and browser | Separate sign-ins | Each refreshes its own |

## Options

| Option | Verdict |
|---|---|
| Refetch button per account | No. Needs the person to notice staleness; adds a third control to each row beside the account and Remove |
| One "Refresh" for all in the sheet | Not now. Same discovery problem; could reuse the code later |
| Sign in again (today) | Keeps working, but is a redirect and consent screen to fetch public data |
| Current account only, on open and switch | Leaves the other header circles stale |
| All accounts, on open, once a day | **Yes** |
| Also when a photo fails to load | **Yes**, at most once per account per page load |

## Proposed design

1. After start-up and the first link load, refresh each account whose stamp is older than 24 hours or from an older refresh version. The stamp is `refreshed: { at, version }`; sign-in sets it. Raising the version in code makes a release that saves a new detail fill it in at once.
2. ActivityPub: read the public actor and require its `id` to equal the saved one. Mastodon: `verify_credentials` with the saved token, requiring the same account. Both: the WebFinger interaction links.
3. Never renew or discard a token, or ask to reconnect, from a background refresh. A 401 is ignored; the next thing the person does handles it.
4. Fetch without holding the store lock. `withAccount` holds it for a whole request, so a slow refresh under it would stall opening links and switching. Lock only to merge, and only into an account that still exists.
5. No spinner, status or announcement, and it never sets the app busy.
6. A new photo shows at once. Changed interaction links apply from the next open or switch, because adding that group under a loaded post moves the buttons.
7. Replace a value only after a successful answer. Clear the photo when the profile has none. `findIntents` currently returns `{}` for both "none" and "failed", so it must tell them apart.
8. Stamp only a fully successful refresh.

## Costs

- Each connected server gets a profile and a WebFinger request about once a day. The header already loads each account's photo from its server, so this reveals little more.
- A server that refuses one of the reads is retried on every open. Acceptable for a first version; add a retry delay if it shows.
- Update `docs/development.md` ("Templates are read once, at sign-in") and the account storage paragraph.
