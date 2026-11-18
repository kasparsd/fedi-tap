# FediTap

Like, repost, and reply to Fediverse posts or follow their authors from the Apple share sheet with your ActivityPub account.

## Install and connect

Your home server needs a compatible client-to-server ActivityPub API. FediTap has been tested with ActivityPub for WordPress 9.4 or later. On WordPress, enable **ActivityPub API** under **Settings › ActivityPub › Advanced**. [WordPress setup instructions](https://activitypub.blog/2026/04/22/8-1-0-by-the-numbers/)

1. Open the [FediTap setup page](https://kasparsd.github.io/fedi-tap/), enter your Fediverse handle, and sign in on your home server.
2. Choose **Download Shortcut**, open the file in Apple Shortcuts, and choose **Add Shortcut**.
3. Return to the setup page and choose **Connect FediTap**. If Shortcuts asks to save your settings, allow it. **Connected as …** confirms the account was saved.

## Use the shortcut

Open an ActivityPub post and choose **Share → FediTap**. Choose **Like**, **Repost**, **Reply**, or **Follow author**. If you’ve connected more than one account, choose which account to use first.

If FediTap opens the setup page again, sign in and choose **Connect FediTap** to refresh your saved account. You can skip the download if the shortcut is already installed.

[Build, hosting, and testing guide](docs/development.md)
