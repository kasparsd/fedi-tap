# FediTap

Like, repost, and reply to Fediverse posts or follow their authors from your ActivityPub account. Use FediTap directly in your browser or open it from the Apple share sheet.

## Install and connect

Your home server needs a compatible client-to-server ActivityPub API. FediTap has been tested with ActivityPub for WordPress 9.4 or later. On WordPress, enable **ActivityPub API** under **Settings › ActivityPub › Advanced**. [WordPress setup instructions](https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/)

1. Open [FediTap](https://kasparsd.github.io/fedi-tap/) and sign in on your home server.
2. Paste a Fediverse link and choose **Find**, then choose an action.
3. To use the Apple share sheet, choose **Download Shortcut**, open the file in Apple Shortcuts, and choose **Add Shortcut**. Share a Fediverse link to **FediTap** to open the same page with the link filled in.

## Use multiple accounts

Connect each account once, then use **Act as** to switch accounts. **Remove account** clears that account from this browser. Clear or revoke its authorization on your home server if you want to end access there.

The browser stores accounts and tokens locally. The shortcut sends only the shared link and never receives credentials. If you used the earlier shortcut, replace it with the new launcher and sign in again in your browser.

[Build, hosting, and testing guide](docs/development.md)
