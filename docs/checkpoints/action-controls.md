# Action controls checkpoint

2026-11-18. Like, Repost and Follow became in-place toggles (`aria-pressed`, outline icon that fills, accent border) with a status line and press-again undo; Reply stays a plain button. Decisions are in `docs/ux/components.md`; screens B3, B4, B4a, B4b, E3 and F2 in `docs/ux/mocks.html`.

- `biome check src tools`, `svelte-check`, `vitest` (73 tests), `vite build` and `npm run check` pass.
- Seen in the running app (Mastodon-style mock account, dark mode): Like shows "Liking…", then the filled on state and the status line; pressing again shows "Undoing…" and "Like undone."; focus stays on the button. Actions use two columns after "Follow author" crowded a four-across row.

2026-11-18, later: Follow moved into the byline next to the author; Like, Repost and Reply are three columns. Seen at 320 px in the running app (Follow request sent, status line, no overflow). Merged to main with the loading-feedback work (`BusyLabel`); the `.reserve` width is hidden inside `.actions` and `.byline` because their widths are already fixed.
