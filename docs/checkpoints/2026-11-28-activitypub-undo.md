# ActivityPub undo, actor and OAuth endpoints (2026-11-28)

Three fixes found by comparing with [fedifox](https://github.com/pfefferle/fedifox) 1.0.1 and 1.1.0. The behaviour is described in [development.md](../development.md#activitypub-srclibactivitypub) and under Server compatibility.

## Evidence from ActivityPub for WordPress

- Source at [`6758263`](https://github.com/Automattic/wordpress-activitypub/tree/6758263): the outbox answers 201 with `Location` and the stored activity, including its `id`. It accepts an `actor` that matches the signed-in account and rejects any other. No CORS rule in the plugin exposes `Location`.
- `kaspars.net`, without credentials: the outbox preflight's exposed headers did not include `Location`. The actor's authorization and token endpoints matched the `.well-known` metadata.

## Validation

- `npm run validate`: passed, 133 unit tests.
- `npm run e2e`: 66 passed. The mock server now answers the outbox like a cross-origin WordPress (no `Location`, the activity in the body) and rejects a missing or wrong `actor`.

## Not verified

No activity was sent to a real server with a signed-in account.
