import { expect, test } from "@playwright/test";
import { action, mockUrl, openLink, resetMock, signIn } from "../helpers.js";

// "mario" is a Mastodon-API account on the mock; "gone" is one whose token is rejected after sign-in.
test.beforeEach(({ page }) => resetMock(page));

test("signs in to a Mastodon-API server and acts on a post", async ({ page }) => {
  await signIn(page, "mario");
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
  await openLink(page, "/notes/1");
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
  await action(page, "Like").click();
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "true");
  await action(page, "Like").click();
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "false");
});

test("a rejected token asks to sign in again", async ({ page }) => {
  await signIn(page, "gone");
  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await page.click("#open-link");
  await expect(page.locator("#reauth")).toBeVisible();
  await expect(page.locator("#reauth-text")).toContainText("Reconnect as");
});

test("a Mastodon-style server offers only Open on its own site", async ({ page }) => {
  await signIn(page, "mario");
  await openLink(page, "/notes/1");
  await expect(page.locator("#server-links a")).toHaveText([/Open/]);
  await action(page, "Reply").click();
  await expect(page.locator("#reply-sheet a")).toHaveCount(0);
});
