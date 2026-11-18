# FediTap

Like, repost, reply to or follow a Fediverse post from your own account. Use FediTap directly in your browser or open it from the Apple share sheet.

## Install and connect

FediTap works with Mastodon-compatible servers (Mastodon, GoToSocial, Pleroma, Akkoma, and Pixelfed on a best-effort basis) and with servers that have a client-to-server ActivityPub API. It has been tested with ActivityPub for WordPress 9.4 or later; on WordPress, enable **ActivityPub API** under **Settings › ActivityPub › Advanced**. [WordPress setup instructions](https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/) Lemmy and Misskey are not supported.

1. Open [FediTap](https://kasparsd.github.io/fedi-tap/) and connect your account on your home server.
2. Choose **Paste** in the link field (or type a link and choose **Open**), then choose an action.
3. On iPhone, iPad or Mac, to use the Apple share sheet, choose **Add Apple Shortcut** (**Add Shortcut**), open the file in Apple Shortcuts, and add it. Share a Fediverse link to **FediTap** to open the same page with the link filled in.

## Use multiple accounts

Connect each account once, then use the account menu at the top to switch accounts or choose **Manage accounts**. In the Accounts dialog, **Remove** clears that account from this browser. Clear or revoke its authorization on your home server if you want to end access there.

The browser stores accounts and tokens locally. The shortcut sends only the shared link and never receives credentials. If you used the earlier shortcut, replace it with the new launcher and connect again in your browser.

[Build, hosting, and testing guide](docs/development.md)
