import { expect, test } from "@playwright/test";
import { action, mockUrl, resetMock, shownText, signIn } from "../helpers.js";

// The slow server answers each request after 6.5 s. After 5 s the page says it is still waiting.
test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await signIn(page, "alice");
});

test("opening a link can be cancelled, and the same link opens afterwards", async ({ page }) => {
  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await page.click("#open-link");
  await expect(page.locator("#slow p")).toHaveText("Still waiting for your server…", {
    timeout: 8000,
  });
  await page.locator("#slow").getByRole("button", { name: "Cancel" }).click();

  await expect(page.locator("#lookup-status")).toHaveText("Canceled.");
  await expect(page.locator("#slow")).toHaveCount(0);
  await expect(page.locator("header .pulse")).toHaveCount(0);
  await expect(page.locator("#target-loading")).toHaveCount(0);
  await expect(page.locator("#lookup-error")).toHaveCount(0);
  await expect(page.locator("#post-url")).toBeEditable();
  await expect(page.locator("#post-url")).not.toHaveAttribute("aria-describedby", /.+/);
  await expect(page.locator("#post-url")).not.toHaveAttribute("aria-invalid", "true");
  expect(await shownText(page.locator("#open-link"))).toBe("Open");
  await expect(page.locator("h1")).toHaveText("Open a post or profile");

  await page.click("#open-link");
  await expect(page.locator("#target-name")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
});

test("a send says the server is slow but can't be cancelled", async ({ page }) => {
  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await page.click("#open-link");
  await expect(page.locator("#target-name")).toBeVisible({ timeout: 30000 });

  await action(page, "Like").click();
  await expect(page.locator("#slow p")).toHaveText("Still waiting for your server…", {
    timeout: 8000,
  });
  await expect(page.locator("#slow button")).toHaveCount(0);
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "true", { timeout: 10000 });
  await expect(page.locator("#slow")).toHaveCount(0);
});
