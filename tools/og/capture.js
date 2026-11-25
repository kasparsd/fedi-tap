// Captures the app with a post loaded from the mock server, for the link preview image
// (tools/og/app.png, framed by tools/og/og-image.svg). Start the dev server first (`npm run dev`),
// then run `node tools/og/capture.js [base URL]`; the default base is https://localhost:8443.
// The mock's host shows as social.example, so handles read as they would on a real server.
import { chromium } from "@playwright/test";

const root = new URL("../..", import.meta.url).pathname;
const base = process.argv[2] ?? "https://localhost:8443";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({
  viewport: { width: 390, height: 482 },
  deviceScaleFactor: 2,
  colorScheme: "light",
  ignoreHTTPSErrors: true,
});

await page.goto(`${base}/_dev/`);
await page.evaluate(() => fetch("/_dev/reset", { method: "POST" }));
await page.goto(`${base}/`);
await page.fill("#account-input", `${base}/users/alice`);
await Promise.all([page.waitForURL(/oauth\/authorize/), page.click("#continue")]);
await page.selectOption("select[name=user]", "alice");
await Promise.all([page.waitForURL(`${base}/`), page.click("button[value=approve]")]);
await page.fill("#post-url", "https://social.example/@dana/1");
await page.click("#open-link");
await page.waitForSelector('main[data-view="loaded"] button[data-action="like"]');
await page.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    walker.currentNode.nodeValue = walker.currentNode.nodeValue.replaceAll(
      "localhost",
      "social.example",
    );
  }
});
await page.screenshot({ path: `${root}tools/og/app.png` });
await browser.close();
