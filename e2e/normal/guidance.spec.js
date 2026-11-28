import { expect, test } from "@playwright/test";
import { action, openAccounts, openLink, problem, resetMock, signIn } from "../helpers.js";

// Behaviour taken from the Modern Web Guidance review (docs/research/modern-web-guidance.md).
test.beforeEach(({ page }) => resetMock(page));

test("the title names the screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^Connect account/);
  await signIn(page, "alice");
  await expect(page).toHaveTitle(/^Open a post or profile/);
});

test("the accent has a plain value, not only light-dark()", async ({ page }) => {
  await page.goto("/");
  const accent = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(),
    );
  await page.emulateMedia({ colorScheme: "light" });
  expect(await accent()).toBe("#006fa6");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await accent()).toBe("#00a6f5");
  // The primary button keeps a background that is not transparent.
  await expect(page.locator("#continue")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("both fields start valid and an empty entry gets the page's own error card, not the browser's", async ({
  page,
}) => {
  await page.goto("/");
  const account = page.locator("#account-input");
  await expect(account).toHaveAttribute("aria-invalid", "false");
  await expect(account).toHaveAttribute("enterkeyhint", "go");
  await expect(account).toHaveAttribute("autocorrect", "off");
  await expect(account).toHaveAttribute("inputmode", "email");
  await expect(page.locator("#sign-in")).toHaveAttribute("novalidate", "");
  await page.click("#continue");
  await expect(problem(page, "auth")).toBeVisible();
  await expect(account).toHaveAttribute("aria-invalid", "true");
  expect(await account.evaluate((input) => input.validationMessage)).not.toBe("");

  await signIn(page, "alice");
  const link = page.locator("#post-url");
  await expect(link).toHaveAttribute("aria-invalid", "false");
  await expect(link).toHaveAttribute("name", "url");
  await link.fill("not a link");
  await page.click("#open-link");
  await expect(problem(page, "lookup")).toBeVisible();
  await expect(link).toHaveAttribute("aria-invalid", "true");
  await expect(link).toBeFocused();
  await link.fill("");
  await expect(link).toHaveAttribute("aria-invalid", "false");
  await page.click("#open-link");
  await expect(problem(page, "lookup")).toBeVisible();
});

test("the Paste button's focus ring is drawn inside the clipped field", async ({ page }) => {
  await signIn(page, "alice");
  await page.locator("#paste-link").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const ring = await page
    .locator("#paste-link")
    .evaluate((button) => getComputedStyle(button).outlineOffset);
  expect(ring).toBe("-2px");
});

test("buttons sit the same distance from their fields and rows", async ({ page }) => {
  const gap = async (left, right) => {
    const [a, b] = [await left.boundingBox(), await right.boundingBox()];
    return Math.round(b.x - (a.x + a.width));
  };
  await signIn(page, "alice");
  const link = await gap(page.locator("#lookup .field"), page.locator("#open-link"));
  await openAccounts(page);
  const sheet = page.locator("#accounts-sheet");
  expect(await gap(sheet.locator(".field"), sheet.locator("#continue"))).toBe(link);
  expect(await gap(sheet.locator(".pick"), sheet.locator("[data-remove]"))).toBe(link);
});

test("the Paste button is drawn small and still taps over the field's full height", async ({
  page,
}) => {
  await signIn(page, "alice");
  const button = await page.locator("#paste-link").boundingBox();
  const field = await page.locator("#lookup .field").boundingBox();
  expect(button.height).toBeLessThan(field.height);
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.id,
    [button.x + button.width / 2, field.y + 2],
  );
  expect(hit).toBe("paste-link");
});

test("the reply sheet is a form: Send submits it, and a drag out of the box doesn't close it", async ({
  page,
}) => {
  await signIn(page, "alice");
  await openLink(page, "/notes/1");
  await action(page, "Reply").click();
  const sheet = page.locator("#reply-sheet");
  await expect(sheet.locator("form#reply-form")).toBeVisible();
  await expect(page.locator("#reply-send")).toHaveAttribute("type", "submit");
  await expect(page.locator("#reply-send")).toBeDisabled();
  await page.fill("#reply-text", "A first line\nand a second");
  await expect(page.locator("#reply-text")).toHaveAttribute("name", "reply");

  // Select text and release the pointer on the backdrop: the sheet stays open.
  const box = await page.locator("#reply-text").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, 20);
  await page.mouse.up();
  await expect(sheet).toHaveJSProperty("open", true);

  await page.click("#reply-send");
  await expect(action(page, "Reply")).toBeVisible();
  await expect(sheet).toHaveJSProperty("open", false);
});

test("a tap on the backdrop closes an idle sheet, and the page behind doesn't scroll with it", async ({
  page,
}) => {
  await signIn(page, "alice");
  await openAccounts(page);
  const sheet = page.locator("#accounts-sheet");
  await expect(sheet).toHaveAttribute("closedby", "any");
  await expect(sheet).toHaveCSS("overscroll-behavior-y", "contain");
  await page.mouse.click(195, 20);
  await expect(sheet).toHaveJSProperty("open", false);
  await expect(page.locator("#account-active")).toBeFocused();
});

test("a page framed by another page draws nothing to tap", async ({ page, baseURL }) => {
  await page.goto("/_dev/");
  await page.setContent(`<iframe id="f" src="${baseURL}/"></iframe>`);
  const frame = page.frameLocator("#f");
  await expect(frame.locator("[role=alert]")).toContainText("can’t run inside another page");
  await expect(frame.locator("main")).toHaveCount(0);
  await expect(frame.locator("button")).toHaveCount(0);
});
