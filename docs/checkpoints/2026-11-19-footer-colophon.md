# Footer colophon · 2026-11-19

- Reviewed both states in Safari on the `open-in-fediverse` iOS 26.5 simulator. The closed disclosure aligns with the install options, and the expanded view shows compatibility, integration references, and credits together.
- At 320 CSS pixels, verified that the disclosure immediately follows the Android install control with the same height, starts closed, toggles on tap, and reveals both APIs, compatibility information, ten links including the GitHub repository, and no horizontal overflow.
- After the spacing revision, checked the collapsed footer in Safari on the same simulator and measured a 16 CSS pixel gap above it at 320 CSS pixels. The two install rows remained adjacent and all three controls shared the same height.
- At 320 CSS pixels, verified that the sign-in Learn more link opens the disclosure, scrolls to and focuses its summary, and opens it again after manual collapse.
- After the copy and menu revision, verified three consecutive 44 CSS pixel disclosure rows at 320, 390 and 768 CSS pixels, with no install intro or horizontal overflow. Learn more still expands How it works and reveals the revised compatibility text and all ten links. Reviewed the open and closed states in iOS Safari.
- After moving the credits, confirmed in iOS Safari that the author and GitHub links appear below the closed disclosures. At 320 CSS pixels they remained visible in the footer across both states, and opening How it works via Learn more revealed the eight reference links.
- Biome passed on the project paths, excluding unrelated nested worktrees. Svelte diagnostics, all 103 unit tests, and the production build and artifact check passed.
