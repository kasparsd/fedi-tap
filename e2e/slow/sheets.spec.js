import { expect, test } from "@playwright/test";
import { action, mockUrl, openAccounts, profileLink, resetMock, signIn } from "../helpers.js";

// The page behind an open sheet is inert, so the slow notice and its Cancel have to be inside the sheet.
test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await signIn(page, "alice");
});

test("signing in from the Accounts sheet can be cancelled from inside the sheet", async ({
  page,
}) => {
  // Looking the account up is what is slow here: the mock only delays its API, so hold the lookup back.
  await page.route(/\/users\/shorty|\/\.well-known\//, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 6500));
    await route.continue().catch(() => {});
  });
  await openAccounts(page);
  const sheet = page.locator("#accounts-sheet");
  await page.fill("#account-input", profileLink(page, "shorty"));
  await page.click("#accounts-sheet #continue");
  // While it works the sheet can't be closed by Escape or a tap outside it.
  await expect(sheet).toHaveAttribute("closedby", "none");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveJSProperty("open", true);

  const slow = sheet.locator("#slow");
  await expect(slow).toBeVisible({ timeout: 8000 });
  await expect(page.locator("main #slow")).toHaveCount(0);
  await slow.locator("button").click();
  await expect(sheet.locator("#slow")).toHaveCount(0);
  await expect(sheet).toHaveJSProperty("open", true);
  await expect(sheet).toHaveAttribute("closedby", "any");
});

test("a reply being sent keeps its sheet open, says it is slow, and is announced in the sheet", async ({
  page,
}) => {
  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await page.click("#open-link");
  await expect(page.locator("#target-name")).toBeVisible({ timeout: 30000 });
  await action(page, "Reply").click();
  const sheet = page.locator("#reply-sheet");
  await page.fill("#reply-text", "Hello");
  await page.click("#reply-send");
  await expect(sheet.locator("#task-announce")).toHaveText(/Sending/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveJSProperty("open", true);
  await expect(sheet.locator("#slow")).toBeVisible({ timeout: 8000 });
  await expect(sheet.locator("#slow button")).toHaveCount(0);
  await expect(sheet).toHaveJSProperty("open", false, { timeout: 15000 });
});
