// Captures the app from the mock server: the README screens (docs/images/) and the app picture in
// the link preview (tools/screenshots/og-app.png). Start the dev server first (`npm run dev`), then
// run `node tools/screenshots/capture.js [base URL]`; the default base is https://localhost:8443.
// Then run og-image.js to rebuild the preview image. Set CHROMIUM_PATH to use another Chromium.
import { execFileSync } from "node:child_process";
import { chromium, devices } from "@playwright/test";

const root = new URL("../..", import.meta.url).pathname;
const base = process.argv[2] ?? "https://localhost:8443";
// A real post, which the mock answers the way the ActivityPub plugin federates it (note 6).
const shared = "https://kaspars.net/blog/high-power-capacity-battery-power-tools";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

async function signIn(page) {
  await page.fill("#account-input", `${base}/users/alice`);
  await Promise.all([page.waitForURL(/oauth\/authorize/), page.click("#continue")]);
  await page.selectOption("select[name=user]", "alice");
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/"),
    page.click("button[value=approve]"),
  ]);
}

async function reset(page) {
  await page.goto(`${base}/_dev/`);
  await page.evaluate(() => fetch("/_dev/reset", { method: "POST" }));
}

// README: the whole screen of an iPhone 17 Pro (402×874 points) in dark mode, at 600 px wide like
// the share sheet screenshots beside them.
{
  const { defaultBrowserType, ...iPhone } = devices["iPhone 15 Pro"];
  const context = await browser.newContext({
    ...iPhone,
    viewport: { width: 402, height: 874 },
    colorScheme: "dark",
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const shot = async (name) => {
    const path = `${root}docs/images/${name}.png`;
    await page.waitForTimeout(400); // sheets and focus rings settle
    await page.screenshot({ path });
    execFileSync("convert", [path, "-resize", "600x", "-strip", path]);
  };
  const action = (name) => page.locator(`button[data-action="${name}"]`).first();

  await reset(page);
  await page.goto(`${base}/?url=${encodeURIComponent(shared)}`);
  await page.waitForSelector("#account-input");
  await shot("connect");

  await signIn(page);
  await action("like").waitFor();
  await page.evaluate(() => document.activeElement?.blur());
  await shot("actions");

  await action("reply").click();
  await page.fill("#reply-text", "Great write-up! How long does the trimmer run on the new pack?");
  await shot("reply");

  await page.click("#reply-send");
  await page
    .locator("#reply-sheet")
    .evaluate(
      (sheet) => !sheet.open || new Promise((done) => sheet.addEventListener("close", done)),
    );
  await action("like").click();
  await page.locator('button[data-action="like"][aria-pressed="true"]').first().waitFor();
  await page.evaluate(() => document.activeElement?.blur());
  await shot("done");
  await context.close();
}

// Link preview: light mode, cropped after the first row of actions, and the mock's localhost
// shown as social.example so the handles read as they would on a real server.
{
  const page = await browser.newPage({
    viewport: { width: 390, height: 482 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    ignoreHTTPSErrors: true,
  });
  await reset(page);
  await page.goto(`${base}/`);
  await signIn(page);
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
  await page.screenshot({ path: `${root}tools/screenshots/og-app.png` });
}

await browser.close();
