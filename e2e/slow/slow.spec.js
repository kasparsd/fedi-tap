import { expect, test } from "@playwright/test";
import { action, expectSignedIn, mockUrl, resetMock, signIn } from "../helpers.js";

// The slow server answers each request after 6.5 s. After 5 s the page says it is still waiting.
test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await signIn(page, "alice");
});

test("opening a link can be cancelled, and the same link opens afterwards", async ({ page }) => {
  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await page.click("#open-link");
  await expect(page.locator("#slow")).toBeVisible({ timeout: 8000 });
  await page.locator("#slow button").click();

  await expect(page.locator("#slow")).toHaveCount(0);
  await expect(page.locator("#lookup .pulse")).toHaveCount(0);
  await expect(page.locator("#target-loading")).toHaveCount(0);
  await expect(page.locator("#lookup-error")).toHaveCount(0);
  await expect(page.locator("#post-url")).toBeEditable();
  await expect(page.locator("#post-url")).not.toHaveAttribute("aria-describedby", /.+/);
  await expect(page.locator("#post-url")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#open-link")).not.toHaveAttribute("aria-busy", "true");
  await expectSignedIn(page);

  await page.click("#open-link");
  await expect(page.locator("#target-name")).toBeVisible({ timeout: 30000 });
  await expectSignedIn(page);
});

test("a send says the server is slow but can't be cancelled", async ({ page }) => {
  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await page.click("#open-link");
  await expect(page.locator("#target-name")).toBeVisible({ timeout: 30000 });

  await action(page, "Like").click();
  await expect(page.locator("#slow")).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#slow button")).toHaveCount(0);
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "true", { timeout: 10000 });
  await expect(page.locator("#slow")).toHaveCount(0);
});
