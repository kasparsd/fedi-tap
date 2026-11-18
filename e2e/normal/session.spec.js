import { expect, test } from "@playwright/test";
import { action, mockUrl, received, resetMock, signIn } from "../helpers.js";

// The mock's "shorty" and "erin" accounts have tokens that last 61 seconds, and the page renews a
// token that has less than 60 seconds left, so every request after the first second renews it.
test.beforeEach(({ page }) => resetMock(page));

const shared = (page, path) => `/?url=${encodeURIComponent(mockUrl(page, path))}`;

test("a short-lived token is renewed before each action", async ({ page }) => {
  await signIn(page, "shorty", { from: shared(page, "/notes/1"), ready: "#target-card" });
  await page.waitForTimeout(1500);
  await action(page, "Like").click();
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "true");
  expect((await received(page)).map((activity) => activity.type)).toEqual(["Like"]);
});

test("an expired session keeps the reply draft and the draft returns after signing in", async ({
  page,
}) => {
  await signIn(page, "erin", { from: shared(page, "/notes/1"), ready: "#target-card" });
  await action(page, "Reply").click();
  await page.fill("#reply-text", "My draft");
  await page.waitForTimeout(1500);
  await page.click("#reply-send");

  await expect(page.locator("#reply-error-text")).toContainText("Connection expired");
  await expect(page.locator("#reply-sheet")).toHaveJSProperty("open", true);
  await expect(page.locator("#reply-text")).toHaveValue("My draft");
  await expect(page.locator("#account-select option:checked")).toContainText("reconnect");

  await Promise.all([
    page.waitForURL(/oauth\/authorize/),
    page.locator("#reply-error").getByRole("button", { name: "Reconnect" }).click(),
  ]);
  await page.selectOption("select[name=user]", "erin");
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/" && !url.search.includes("code=")),
    page.click("button[value=approve]"),
  ]);
  await expect(page.locator("#target-card")).toBeVisible();
  await expect(page.locator("#action-status")).toHaveText("Reply draft restored.");
  await action(page, "Reply").click();
  await expect(page.locator("#reply-text")).toHaveValue("My draft");
});

test("opening a link with an expired session asks to sign in again", async ({ page }) => {
  await signIn(page, "erin");
  await page.waitForTimeout(1500);
  await page.fill("#post-url", mockUrl(page, "/notes/3"));
  await page.click("#open-link");
  await expect(page.locator("#reauth")).toBeVisible();
  await expect(page.locator("#reauth-text")).toHaveText("Reconnect as @erin@localhost.");
  await expect(page.locator("#lookup")).toBeVisible();
  await expect(page.locator("#open-link")).not.toHaveClass(/primary/);
  await expect(page.locator("#target-card")).toHaveCount(0);
});
