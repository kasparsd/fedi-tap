// Renders tools/screenshots/og-image.svg (with the app picture og-app.png from capture.js) to
// public/og-image.png, 1200×630, for link previews. Run with `node tools/screenshots/og-image.js`.
// Uses Inter when installed, else system-ui.
// Set CHROMIUM_PATH to use a browser other than the one `npm run e2e:install` installs.
import { chromium } from "@playwright/test";

const dir = new URL(".", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${dir}og-image.svg`);
await page.screenshot({ path: `${dir}../../public/og-image.png` });
await browser.close();
