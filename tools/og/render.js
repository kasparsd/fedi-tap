// Renders tools/og/og-image.svg (with the app screenshot tools/og/app.png) to public/og-image.png (1200×630) for link previews.
// Run with `node tools/og/render.js`. Uses Inter when installed, else system-ui.
// Set CHROMIUM_PATH to use a browser other than the one `npm run e2e:install` installs.
import { chromium } from "@playwright/test";

const root = new URL("../..", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${root}tools/og/og-image.svg`);
await page.screenshot({
  path: `${root}public/og-image.png`,
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});
await browser.close();
