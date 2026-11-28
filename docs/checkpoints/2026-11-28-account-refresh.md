# Refreshing saved accounts (2026-11-28)

Accounts connected before a release saved the profile photo showed initials until the person signed in again. Saved accounts now refresh in the background, as described in [development.md](../development.md#refreshing-saved-accounts); [the research](../research/account-refresh.md) compares the options and other clients.

## Validation

- `npm run validate`: passed. Unit tests cover when an account is due, both backends, cleared and failed reads, another account's profile, a refused token, and an account removed or signed in again meanwhile.
- `npm run e2e`: 69 passed against the mock server. New browser tests cover an account saved without a photo or links, a photo that fails to load, and a refresh under a shared post, which shows the photo and leaves the links for the next open.

## Not verified

Not tried against a real server or with accounts saved by the published app.
