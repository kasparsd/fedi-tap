import { expect, test } from "@playwright/test";
import {
  addAccount,
  circle,
  expectCurrent,
  expectSignedIn,
  expectView,
  mockUrl,
  openAccounts,
  resetMock,
  signIn,
} from "../helpers.js";

test.beforeEach(({ page }) => resetMock(page));

/** The users of the header's circles, in order. */
const circles = (page) =>
  page
    .locator(".others button[aria-label^='Switch to']")
    .evaluateAll((buttons) => buttons.map((button) => button.title.split("@")[0]));

/** Taps a circle after the pause that tells a switch from a double tap. */
async function switchTo(page, user) {
  await page.waitForTimeout(450);
  await circle(page, user).click();
  await expectCurrent(page, user);
}

test("adds a second account, switches between them and removes one", async ({ page }) => {
  await signIn(page, "alice");
  // Signed in, the accounts take the product name's place.
  await expect(page.locator("header a")).toHaveCount(0);
  await openAccounts(page);
  await expect(page.locator("#account-list li")).toHaveCount(1);
  await expect(page.locator("#account-list [aria-current=true]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#account-active")).toBeFocused();

  await addAccount(page, "shorty");
  await switchTo(page, "alice");
  await expect(page.locator("#account-active")).toBeFocused();
  await expect(page.locator(".pill")).toContainText(/Switched to alice@localhost/);

  await openAccounts(page);
  await page.getByRole("button", { name: /^Remove shorty@/ }).click();
  // The question replaces the account's row; no second dialog opens.
  await expect(page.locator("#remove-text")).toContainText("shorty@localhost");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.click("#remove-cancel");
  await expect(page.getByRole("button", { name: /^Remove shorty@/ })).toBeFocused();
  await page.getByRole("button", { name: /^Remove shorty@/ }).click();
  await page.click("#remove-confirm");
  await expect(page.locator("#account-list li")).toHaveCount(1);
  await page.click("#sheet-done");
  await expect(page.locator("#account-active")).toBeFocused();
});

test("the button at the top right closes the Accounts sheet like Done", async ({ page }) => {
  await signIn(page, "alice");
  await openAccounts(page);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("#accounts-sheet")).toHaveJSProperty("open", false);
  await expect(page.locator("#account-active")).toBeFocused();
});

test("circles trade places with the current account, and +N holds the rest", async ({ page }) => {
  await signIn(page, "alice");
  for (const user of ["mario", "erin", "shorty"]) await addAccount(page, user);
  // Three others fit. Each new account took the front, as one picked from the sheet would.
  await expect.poll(() => circles(page)).toHaveLength(3);
  await expect(page.locator("#account-more")).toHaveCount(0);
  const before = await circles(page);

  // The previous account takes the tapped circle's place, so the same spot switches back.
  await switchTo(page, before[1]);
  await expect.poll(() => circles(page)).toEqual([before[0], "shorty", before[2]]);
  await switchTo(page, "shorty");
  await expect.poll(() => circles(page)).toEqual(before);

  await addAccount(page, "flaky");
  await expect.poll(() => circles(page)).toHaveLength(2);
  await expect(page.locator("#account-more")).toHaveAccessibleName("+2 more accounts");

  // One picked from behind "+N": the previous account comes to the front.
  const shown = await circles(page);
  await page.locator("#account-more").click();
  const rows = page.locator("#account-list .pick");
  await expect(rows).toHaveCount(5);
  const hidden = (
    await rows.evaluateAll((buttons) => buttons.map((b) => b.ariaLabel.split("@")[0]))
  ).filter((user) => user !== "flaky" && !shown.includes(user));
  await page.waitForTimeout(450);
  await page
    .locator("#account-list")
    .getByRole("button", { name: new RegExp(`^${hidden[0]}@`) })
    .click();
  await expectCurrent(page, hidden[0]);
  await expect(page.locator("#accounts-sheet")).toHaveJSProperty("open", false);
  await expect.poll(() => circles(page)).toEqual(["flaky", shown[1]]);

  // The order is saved.
  await page.reload();
  await expectCurrent(page, hidden[0]);
  await expect.poll(() => circles(page)).toEqual(["flaky", shown[1]]);
});

test("a second tap right after a switch does nothing", async ({ page }) => {
  await signIn(page, "alice");
  await addAccount(page, "shorty");
  await page.waitForTimeout(450);
  await circle(page, "alice").dblclick();
  await expectCurrent(page, "alice");
  await page.waitForTimeout(100);
  await expectCurrent(page, "alice");
});

test("circles show the account's photo, and letters when there is none", async ({ page }) => {
  await signIn(page, "alice");
  await expect(page.locator("#account-active img")).toBeVisible();
  // No photo, and a photo that can't be loaded.
  for (const user of ["shorty", "erin"]) {
    await addAccount(page, user);
    await expect(page.locator("#account-active img:visible")).toHaveCount(0);
    await expect(page.locator("#account-active .avatar")).toHaveText(user[0].toUpperCase());
  }
});

test("switching to an account that needs reconnecting shows the card and stays here", async ({
  page,
}) => {
  await signIn(page, "alice");
  await addAccount(page, "shorty");
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => localStorage[name].includes('"accounts"'));
    const store = JSON.parse(localStorage[key]);
    for (const account of Object.values(store.accounts)) {
      if (account.handle.startsWith("alice@")) account.needsReauth = true;
    }
    localStorage[key] = JSON.stringify(store);
  });
  await page.reload();
  await expect(circle(page, "alice")).toHaveAccessibleName(/needs reconnecting/);
  const address = page.url();
  await switchTo(page, "alice");
  await expect(page.locator("#reauth")).toBeVisible();
  expect(page.url()).toBe(address);
});

test("with large text the header wraps without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await signIn(page, "alice");
  for (const user of ["mario", "erin", "shorty", "flaky"]) await addAccount(page, user);
  await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
  const overflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await overflow()).toBeLessThanOrEqual(0);
  await openAccounts(page);
  expect(await overflow()).toBeLessThanOrEqual(0);
  expect(
    await page.locator("#accounts-sheet").evaluate((e) => e.scrollWidth - e.clientWidth),
  ).toBeLessThanOrEqual(0);
});

test("switching accounts reopens the shared link for the new one", async ({ page }) => {
  await signIn(page, "alice");
  await page.fill("#post-url", mockUrl(page, "/notes/3"));
  await page.click("#open-link");
  await expect(page.locator("#target-card")).toBeVisible();
  await addAccount(page, "shorty");
  await expect(page.locator("#target-card")).toBeVisible();
  await switchTo(page, "alice");
  await expect(page.locator("#target-card")).toBeVisible();
  // Loading the link doesn't clear the word that the account changed.
  await expect(page.locator(".pill")).toContainText(/Switched to alice@/);
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
  await page.getByRole("button", { name: /^Remove alice@/ }).click();
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
  await other.getByRole("button", { name: /^Remove alice@/ }).click();
  await other.click("#remove-confirm");
  await expectView(other, "signed-out");
  await expectView(page, "signed-out");
});

/** Changes the one saved account, as an older release or a changed server would leave it. */
const editSaved = (page, edit) =>
  page.evaluate(`(() => {
    const key = Object.keys(localStorage).find((name) => localStorage[name].includes('"accounts"'));
    const store = JSON.parse(localStorage[key]);
    for (const account of Object.values(store.accounts)) (${edit})(account);
    localStorage[key] = JSON.stringify(store);
  })()`);

const savedAccount = (page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => localStorage[name].includes('"accounts"'));
    return Object.values(JSON.parse(localStorage[key]).accounts)[0];
  });

test("an account saved without a photo or links gets them on the next open", async ({ page }) => {
  await signIn(page, "alice");
  await editSaved(page, (account) => {
    delete account.avatar;
    delete account.intents;
    delete account.refreshed;
  });
  await page.reload();
  await expect(page.locator("#account-active img")).toBeVisible();
  await expect.poll(async () => (await savedAccount(page)).refreshed?.version).toBe(1);
  expect((await savedAccount(page)).intents).toHaveProperty("like");
});

test("a photo that fails to load is looked up again", async ({ page }) => {
  await signIn(page, "alice");
  await editSaved(page, (account) => {
    account.avatar = new URL("/avatars/moved.svg", account.actor).href;
  });
  await page.reload();
  await expect(page.locator("#account-active img")).toBeVisible();
  expect((await savedAccount(page)).avatar).toContain("/avatars/alice.svg");
});

test("a refresh under a shared post shows the photo and leaves the buttons where they are", async ({
  page,
}) => {
  await signIn(page, "alice");
  await editSaved(page, (account) => {
    delete account.avatar;
    delete account.intents;
    delete account.refreshed;
  });
  // Hold the profile back until the post is on screen.
  let release;
  const held = new Promise((done) => {
    release = done;
  });
  await page.route("**/users/alice", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`/?url=${encodeURIComponent(mockUrl(page, "/notes/1"))}`);
  await expect(page.locator("#target-card")).toBeVisible();
  const serverLinks = page.getByRole("link", { name: /Like/ });
  await expect(serverLinks).toHaveCount(0);
  release();
  await expect(page.locator("#account-active img")).toBeVisible();
  await expect(serverLinks).toHaveCount(0);
  await page.reload();
  await expect(serverLinks).toHaveCount(1);
});
