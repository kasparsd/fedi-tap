# Fediverse UI conventions

Research input for the FediTap copy and panel layout. Not canonical: decisions move into `docs/ux/components.md` (Copy) once the owner accepts them. Gathered 2026-11-18 from the sources linked inline. Where a source could not be fetched, the finding is marked as unverified.

## Vocabulary findings

### Reposting: Boost, Repost, Share, Renote

- Mastodon's UI says **Boost** ("Boost", "Unboost", "{name} boosted"); the ActivityPub type `Announce` is documented as "transformed into a boost on a status" ([Mastodon ActivityPub spec](https://docs.joinmastodon.org/spec/activitypub/), [Mastodon en.json](https://raw.githubusercontent.com/mastodon/mastodon/main/app/javascript/mastodon/locales/en.json)).
- Elk, Ivory, Ice Cubes and Mona follow Mastodon: Boost / Boosted ([Elk en.json](https://raw.githubusercontent.com/elk-zone/elk/main/locales/en.json); Ivory, Ice Cubes and Mona strings were not fetchable, so treat them as unverified but widely reported, see [fedi.tips](https://fedi.tips/how-do-i-do-likes-and-re-tweets-in-mastodon-and-what-are-bookmarks)).
- **Repost** is the word of non-Mastodon, newer or publisher products: Ghost's Reader lists "follows, replies, likes, and reposts" ([Ghost changelog](https://ghost.org/changelog/social-web-beta/)); the WordPress ActivityPub plugin's own text says "reposts" while reviews say "boost" ([plugin page](https://wordpress.org/plugins/activitypub/)).
- **Renote** is Misskey and its forks ([Misskey en-US.yml](https://raw.githubusercontent.com/misskey-dev/misskey/develop/locales/en-US.yml)).
- **Share** in Mastodon's UI is not a repost: it is the "Share" action that copies or shares the post's link (`status.share`). Pixelfed's "Share" does mean a boost, which is a known cross-product clash. Avoid "Share" for the repost action.
- The Friends plugin changelog says "ActivityPub boosts" ([Friends plugin](https://wordpress.org/plugins/friends/)).
- Community glossaries treat boost, repost and reblog as the same thing ([Fediverse wiki terminology](https://thefedi.wiki/terminology), [SocialHub term map](https://socialhub.activitypub.rocks/t/map-terms-of-e-g-mastodon-pleroma-to-ap/2451)).

### Liking: Favorite, Like, Star

- Mastodon: **Favorite** (en-US; "Favourite" in the docs, which use the British spelling) with a star icon; its `Like` activity "becomes a favourite" ([Mastodon docs, network](https://docs.joinmastodon.org/user/network/)). Elk: "Favorite" / "Favorited".
- Everyone else says **Like**: Ghost (heart icon, [Ghost on likes](https://activitypub.ghost.org/do-you-like-the-way-i-like-that/)), Misskey ("Like"/"Unlike"; Reactions are a separate emoji feature), the WordPress plugin ("likes" in the Fediverse Reactions block), Pixelfed, and the ActivityPub vocabulary itself.
- Micro.blog has no public favourites at all ([Micro.blog help](https://help.micro.blog/t/whats-the-difference-between-micro-blog-and-mastodon/1395)).
- Lemmy has Upvote/Downvote, which maps to Like/Dislike activities; it is not comparable.
- Star is dead terminology (Twitter pre-2015, GNU social).

### Server vs instance

- Mastodon's current UI and docs say **server** ("On a different server", "whatever Mastodon server you use"); "instance" survives in the API (`/api/v2/instance`) and in some clients ([Mastodon docs](https://docs.joinmastodon.org/user/network/), [Mastodon API instance](https://docs.joinmastodon.org/methods/instance/)). Elk's field is "Mastodon Server Address" yet its follower warning says "other instances".
- Misskey and Lemmy keep "Instance" in their UI.
- The WordPress plugin avoids both in the UI: it says "site", "blog profile", "Fediverse profile", and its handle is `@example.com@example.com` ([plugin page](https://wordpress.org/plugins/activitypub/)). A WordPress admin does not think of their blog as an "instance"; a Mastodon user does not mind "server".
- Recommendation: **server** (neutral, current Mastodon) or "site" where the account is plainly a website.

### Post, status, note, toot

- Mastodon replaced "toot" and "status" with **post** in the UI ([SocialHub thread title](https://socialhub.activitypub.rocks/t/mastodon-to-replace-terminology-of-toots-and-status-with-post/1627); only the title was verifiable). Elk uses "post" everywhere ("boosted your post").
- "Status" is API-only. `Note` is the ActivityStreams type (Misskey also says Note and Renote); `Article` is what WordPress sends for long posts. Users never see these words.
- "Toot" is retired in Mastodon and unwelcome as a generic term on other platforms (Pixelfed, Lemmy and WordPress users do not "toot").
- Use **post** for any object; the app already accepts profiles too, so "link" is the neutral word for the input.

### Handle, profile, account, identity

- Mastodon says **handle** ("Handle unavailable") and shows `@user@domain`; the leading `@` is display, and typing `user@domain` is accepted everywhere. WordPress shows `@user@domain` too, with the domain repeated for the blog profile (`@example.com@example.com`).
- "Profile" is the page or actor (the WordPress plugin: "Fediverse profile", "blog profile"). "Account" is what a person holds on a server (Elk: "Switch account", "Add an existing account"). "Identity" is not used in any of these products; avoid.
- WebFinger input accepts `acct:user@domain`, `@user@domain` and `user@domain`; products show the first two forms only.

### Follow, Follow request, Requested

- Mastodon: **Follow** (button) and "Cancel follow" for a pending request; the owner side says "{name} has requested to follow you" ([Mastodon en.json](https://raw.githubusercontent.com/mastodon/mastodon/main/app/javascript/mastodon/locales/en.json)).
- Elk is the clearest: **Request to follow** (locked target, before sending), **Requested** (after), **Withdraw follow request**, notification "requested to follow you" ([Elk en.json](https://raw.githubusercontent.com/elk-zone/elk/main/locales/en.json)).
- Misskey: "Send follow request", "Follow request pending". Lemmy: "Subscribe pending" while a remote server has not acknowledged ([lemmy-ui commit](https://git.join-lemmy.org/LemmyNet/lemmy-ui/commit/a8339c38c771c136871714547372f65e9cb12810)).
- Protocol fact: a `Follow` is answered asynchronously by `Accept` (unlocked accounts, automatic) or `Accept`/`Reject` by a human (locked, `manuallyApprovesFollowers`); the pending state "is not represented in the ActivityPub data model" and a request can be silently ignored ([Mastodon ActivityPub spec](https://docs.joinmastodon.org/spec/activitypub/), [SocialHub on Follow/Accept](https://socialhub.activitypub.rocks/t/an-fep-for-follow-accept-mechanics/4266)). A client that only sends the activity can therefore claim only "requested" or "sent", never "following".
- FediTap sends Follow without reading the target's `manuallyApprovesFollowers` (the actor document is already fetched, so it could). "Follow requested" is already the honest done-label for both cases.

### Reply and visibility

- Reply is universal. Mastodon's four audience labels: **Public**, **Quiet public** (unlisted), **Followers** (Elk: "Followers only"), **Private mention** (direct) ([Mastodon en.json](https://raw.githubusercontent.com/mastodon/mastodon/main/app/javascript/mastodon/locales/en.json), [Elk en.json](https://raw.githubusercontent.com/elk-zone/elk/main/locales/en.json)). Misskey: Public, Home, Followers, Direct.
- Wire format ([Mastodon ActivityPub spec](https://docs.joinmastodon.org/spec/activitypub/)): public = `as:Public` in `to`; unlisted = `as:Public` in `cc`; followers-only = followers collection, no Public; direct = actors only, all with `Mention` tags. Mention tags are also what generates a notification for the mentioned author.
- Consequence for FediTap: replies and likes are addressed `to: [author], cc: [Public]`, which Mastodon renders as **Quiet public**, not Public, and the reply has no `Mention` tag. The text "Replies are public." is therefore inaccurate for Mastodon recipients, and the author may not be notified. Repost (`to: [Public]`, `cc: [followers]`) is a genuine public Announce.

### Sign in, Log in, Connect, Authorize

- Mastodon's remote-interaction modal: **"Sign in to continue"**, with "On a different server" / "On this server" ([Mastodon en.json](https://raw.githubusercontent.com/mastodon/mastodon/main/app/javascript/mastodon/locales/en.json)). Elk: "Sign in". Misskey: "Sign In". Lemmy and some Mastodon pages say "Log in". Both are understood; **Sign in** is the better match for OAuth to an existing account.
- Update 2026-11-18: FediTap now says **Connect**. It has no accounts of its own; the person links an existing one, as in Buffer's [Mastodon flow](https://support.buffer.com/articles/using-mastodon-with-buffer-owHRCwpxsR) ("sign into your account to connect it to Buffer"). The Sign in advice above fits clients people live in. See `docs/ux/components.md`, Decisions.
- "Connect" is used by Micro.blog, Friends and WordPress for linking apps ("connected apps", "third-party Fediverse apps", [ActivityPub 8.1 post](https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/)); for a web app that holds a token, "Sign in" is more familiar to Mastodon users, "Connect" to WordPress admins. The consent screen on the server is the server's own wording and cannot be changed.

### How comparable tools word the remote flow

- Mastodon "Interact with" modal and `authorize_interaction?uri=`: you type your own server, are sent there, and act inside your own server's UI ([Mastodon helper](https://codeclimate.com/github/glitch-soc/mastodon/app/javascript/entrypoints/remote_interaction_helper.ts/source), [Hugh Rundle on remote following](https://www.hughrundle.net/how-to-implement-remote-following-for-your-activitypub-project)). Lemmy asks for "the domain of your home instance" ([joinlemmy changelog](https://git.join-lemmy.org/LemmyNet/joinlemmy-site/commit/4517bdced2f8aa9a21c840d4dda2d563df1b64ef)).
- Extensions that hop to your own server: [Mastodon Redirector](https://chromewebstore.google.com/detail/limifnkopacddgpihodacjeckfkpbfoe), [Mastodon Simplified Federation](https://addons.mozilla.org/addon/mastodon-simplified-federation/), FediAct ("follow, boost, bookmark, reply and favourite on external servers"), [Share to Mastodon](https://addons.mozilla.org/en-US/firefox/addon/share-to-mastodon/). Their vocabulary is Mastodon's (boost, favourite) and they say "your server" or "home server".
- FediTap is closest to FediAct plus Elk's share target ("Share with Elk"): it acts through the API instead of redirecting, so it needs an account and sign-in step that those tools avoid.

## Comparison table

| Action | Mastodon web | Elk | Misskey | Ghost | WordPress ActivityPub plugin | Pixelfed | Lemmy |
|---|---|---|---|---|---|---|---|
| Re-share | Boost / Unboost | Boost / Boosted | Renote | Repost (Reader notifications) | "reposts" in text, Boost in reviews | Share (unverified) | none (crosspost) |
| Appreciate | Favorite | Favorite / Favorited | Like (+ Reactions) | Like (heart) | Like (Fediverse Reactions block) | Like (unverified) | Upvote |
| Respond | Reply | Reply | Reply | Reply | "Federated Reply" block | Comment (unverified) | Reply |
| Follow | Follow | Follow | Follow | Follow | "Follow me on the Fediverse" | Follow | Subscribe |
| Locked / pending | Cancel follow (pending) | Request to follow, Requested, Withdraw follow request | Send follow request, Follow request pending | not found | not found | Follow requests (unverified) | Subscribe pending |
| Audience | Public, Quiet public, Followers, Private mention | same, "Followers only" | Public, Home, Followers, Direct | n/a (public) | n/a | Public, Unlisted, Followers | n/a |
| Server word | server | server (field), instance | Instance | n/a | site, "Fediverse profile" | instance | instance |
| Account switch | n/a | Switch account, Add an existing account | account menu | n/a | n/a | n/a | n/a |
| Sign in | Sign in to continue | Sign in | Sign In | n/a | connected apps | n/a | Log in |

Pixelfed, Ghost and WordPress cells marked "unverified" or "not found" could not be confirmed from fetchable first-party strings; Ivory, Ice Cubes and Mona strings could not be fetched at all.

## Recommended principles

1. **Pick one audience-neutral vocabulary and say it once.** Fediverse users know both Boost and Repost, and Favorite and Like; people from WordPress, Ghost and Misskey know Repost and Like and do not know Boost or Favorite. Prefer the ActivityPub-neutral pair **Like / Repost** and make the done-label and the status match.
2. **Never claim more than the client knows.** The client knows the outbox accepted the activity. Delivery, Accept, notification and visibility on the other side are not known. "Sent", "Requested" and "Replied" are true; "Following" and "Liked by them" are not.
3. **Name the audience that is actually used.** If the reply is `to: author, cc: Public`, either change addressing to Public (`to: Public, cc: author` plus a `Mention` tag) or stop saying "public". Use Mastodon's labels (Public, Quiet public, Followers) if an audience is ever shown.
4. **Prefer "server" and "link" over "instance" and "URL".** On WordPress, say "site" only where a website is plainly meant. Do not use "toot", "status", "note", "identity" or "token" in the UI.
5. **Account means the thing you act as; profile means the thing you act on.** The header says who you are signed in as (`@you@example.com`, with "Account" as its accessible name); the post card says who wrote the post. Do not use "Account" for the target.
6. **One name per concept across product and docs.** Elk's pattern is a good reference: Sign in, Switch account, Add account, Follow, Request to follow, Requested, Withdraw follow request.
7. **Label platform-specific features with the platform.** "Add Shortcut for iOS", "Add to Home Screen" (iOS only), "Safari" only when the instruction is Safari-specific; otherwise "browser".
8. **Say what happens on the server side only where a wrong guess would surprise.** Server consent ("Allow") is the server's page; the app can name it ("Sign in on your server") on the button, not in help text.
