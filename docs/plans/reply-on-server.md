# Actions on the home server

Goal: besides the in-app actions, offer "Reply / Like / Repost / Follow / Open on {server}" links for each FEP-3b86 intent the person's own server advertises in WebFinger.

## Decisions

- Reply uses only a `Create` template that contains `{inReplyTo}` counts. Mastodon's `Create` template takes `{content}` only (`/share?text={content}`), so it cannot open a reply and gets no button. `Object` (and the legacy subscribe link, `{uri}`) become an "Open on {server}" link instead.
- The template is read once, when sign-in finishes (best effort: any failure means no button, never a failed sign-in), and saved per intent on the account as `intents`.
- The lookup is `acct:{handle}` on the account's own origin. The template must be HTTPS on that same origin, have no fragment, and contain `{inReplyTo}` as its only placeholder; it is checked again when the link is built.
- The links are real links (`target="_blank"`, `rel="noopener noreferrer"`), grouped under the heading "On {host}" and shown with the same icons as the in-app buttons, which sit under the heading "Using API". Reply is a link in that group, not in the Reply sheet. The group names appear only when the server offers something.
- The post address that fills `{inReplyTo}` is the resolved target's `id`, percent-encoded.

## Todos

- [x] `findIntents` and `intentLink` in `src/lib/discovery.js`, with unit tests
- [x] Save `intents` in `completeSignIn`
- [x] Grouped "On {host}" links in `ServerLinks.svelte`, shared `ActionIcon.svelte`
- [x] Mock server WebFinger (an ActivityPub user with every intent, a Mastodon user with compose and Object) and e2e tests
- [x] Document in `docs/development.md`
- [x] `biome check` (src, e2e, tools), `svelte-check`, unit tests, build and `check` pass
- [ ] Run the new e2e tests (Playwright isn't installed here; `npm install && npm run e2e:install`)
- [ ] Check against kaspars.net with a signed-in account (owner): do the `interactions` links open a reply and follow screen? WordPress has no Like, Repost or Object link, so there it adds Reply, Follow and Open (from the subscribe link)
