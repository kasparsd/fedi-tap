import { expect, test } from "@playwright/test";
import { expectSignedIn, expectView, mockUrl, profileLink, resetMock, signIn } from "../helpers.js";

test.beforeEach(({ page }) => resetMock(page));

/** Opens the Accounts sheet through the account menu's last option. */
async function openAccounts(page) {
  await page.selectOption("#account-select", "add");
  await expect(page.locator("#accounts-sheet")).toHaveJSProperty("open", true);
}

/** Adds another mock account from inside the Accounts sheet. */
async function addAccount(page, user) {
  await openAccounts(page);
  await page.fill("#account-input", profileLink(page, user));
  await Promise.all([page.waitForURL(/oauth\/authorize/), page.click("#accounts-sheet #continue")]);
  await page.selectOption("select[name=user]", user);
  const origin = new URL(page.url()).origin;
  await Promise.all([
    page.waitForURL((url) => url.origin === origin && url.pathname === "/"),
    page.click("button[value=approve]"),
  ]);
  await expect(page.locator("#account-select")).toBeVisible();
}

test("adds a second account, switches between them and removes one", async ({ page }) => {
  await signIn(page, "alice");
  await openAccounts(page);
  await expect(page.locator("#account-list li")).toHaveCount(1);
  await expect(page.locator("#accounts-sheet #account-input")).toBeFocused();
  await page.keyboard.press("Escape");

  await addAccount(page, "shorty");
  await expect(page.locator("#account-select option")).toHaveCount(3);
  await expect(page.locator("#account-select option:checked")).toContainText("@shorty@localhost");

  await page.selectOption("#account-select", { label: "@alice@localhost" });
  await expect(page.locator("#account-select option:checked")).toContainText("@alice@localhost");

  await openAccounts(page);
  await page.getByRole("button", { name: "Remove @shorty@localhost" }).click();
  // The question replaces the account's row; no second dialog opens.
  await expect(page.locator("#remove-text")).toContainText("@shorty@localhost");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.click("#remove-confirm");
  await expect(page.locator("#account-list li")).toHaveCount(1);
  await page.click("#sheet-done");
  await expect(page.locator("#account-select")).toBeFocused();
});

test("switching accounts reopens the shared link for the new one", async ({ page }) => {
  await signIn(page, "alice");
  await page.fill("#post-url", mockUrl(page, "/notes/3"));
  await page.click("#open-link");
  await expect(page.locator("#target-card")).toBeVisible();
  await addAccount(page, "shorty");
  await expect(page.locator("#target-card")).toBeVisible();
  await page.selectOption("#account-select", { label: "@alice@localhost" });
  await expect(page.locator("#account-select option:checked")).toContainText("@alice@localhost");
  await expect(page.locator("#target-card")).toBeVisible();
});

test("an account whose first token is rejected renews it and carries on", async ({ page }) => {
  await signIn(page, "flaky");
  await page.fill("#post-url", mockUrl(page, "/notes/3"));
  await page.click("#open-link");
  await expect(page.locator("#target-card")).toBeVisible();
  await expectSignedIn(page);
});

test("removing the last account closes the sheet and signs out", async ({ page }) => {
  await signIn(page, "alice");
  await openAccounts(page);
  await page.getByRole("button", { name: "Remove @alice@localhost" }).click();
  await page.click("#remove-confirm");
  await expectView(page, "signed-out");
  await expect(page.locator("#accounts-sheet")).toHaveJSProperty("open", false);
});

test("another tab sees accounts that are added and removed", async ({ context, page }) => {
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.locator("#account-input")).toBeVisible();

  await signIn(page, "alice");
  await expectSignedIn(other);

  await openAccounts(other);
  await other.getByRole("button", { name: "Remove @alice@localhost" }).click();
  await other.click("#remove-confirm");
  await expectView(other, "signed-out");
  await expectView(page, "signed-out");
});
