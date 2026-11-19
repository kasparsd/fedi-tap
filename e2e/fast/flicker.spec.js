import { expect, test } from "@playwright/test";
import { action, mockUrl, resetMock, signIn } from "../helpers.js";

// The fast server answers at once: progress, the placeholder and the slow notice are only shown
// after a delay, so they must never be added to the page.
test("quick responses show nothing extra", async ({ page }) => {
  await resetMock(page);
  await signIn(page, "alice");
  await page.evaluate(() => {
    window.__added = [];
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          const extra = node.matches(".pulse, #target-loading, #slow");
          if (extra || node.querySelector(".pulse, #target-loading, #slow")) {
            window.__added.push(node.nodeName);
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await page.click("#open-link");
  await expect(page.locator("#target-name")).toHaveText("Dana Writer");
  await page.fill("#post-url", mockUrl(page, "/notes/2"));
  await page.click("#open-link");
  await expect(page.locator("#target-name")).toHaveText("Zed Remote");
  await action(page, "Like").click();
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "true");

  expect(await page.evaluate(() => window.__added)).toEqual([]);
});
