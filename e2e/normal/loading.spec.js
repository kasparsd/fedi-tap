import { expect, test } from "@playwright/test";
import {
  action,
  mockUrl,
  openLink,
  resetMock,
  shownText,
  signIn,
  topOf,
  widthOf,
} from "../helpers.js";

// The normal server answers each request after 400 ms, so the loading states stay on screen long
// enough to inspect. The pattern is described in docs/ux/components.md (Loading).
test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await signIn(page, "alice");
});

test("the first link shows progress, a placeholder and a busy button that keeps its look", async ({
  page,
}) => {
  const open = page.locator("#open-link");
  const idleWidth = await widthOf(open);
  const headerHeight = await page.locator("header").evaluate((header) => header.offsetHeight);

  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await open.click();

  await expect(page.locator("header progress")).toHaveAttribute("aria-label", "Opening localhost…");
  await expect(page.locator("#target-loading h2")).toHaveText("Opening localhost…");
  await expect(page.locator("#target-loading")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#task-announce")).toHaveText("Opening localhost…");
  expect(await shownText(open)).toBe("Opening…");
  await expect(open).toHaveAttribute("aria-busy", "true");
  // It stays filled (a primary button) and the same width, and the header does not grow.
  const colors = await open.evaluate((button) => ({
    background: getComputedStyle(button).backgroundColor,
    page: getComputedStyle(document.body).backgroundColor,
  }));
  expect(colors.background).not.toBe(colors.page);
  expect(await widthOf(open)).toBe(idleWidth);
  expect(await page.locator("header").evaluate((header) => header.offsetHeight)).toBe(headerHeight);
  // No second status line for the same thing.
  await expect(page.locator("#lookup-status")).toHaveText("");

  await expect(page.locator("#target-name")).toBeVisible();
  await expect(page.locator("header progress")).toHaveCount(0);
  await expect(page.locator("#target-loading")).toHaveCount(0);
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
});

test("a second link keeps the first post, dimmed, and nothing below it moves", async ({ page }) => {
  await openLink(page, "/notes/1");
  await expect(page.locator("#target-name")).toHaveText("Dana Writer");
  const shortcutTop = await topOf(page.locator("#shortcut-card"));

  await page.fill("#post-url", mockUrl(page, "/notes/2"));
  await page.click("#open-link");
  await expect(page.locator("header progress")).toBeVisible();

  const post = page.locator("#post");
  await expect(post).toHaveAttribute("aria-busy", "true");
  await expect(post).toHaveJSProperty("inert", true);
  await expect(post).toHaveCSS("opacity", "0.5");
  await expect(page.locator("#target-name")).toHaveText("Dana Writer");
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
  expect(await topOf(page.locator("#shortcut-card"))).toBe(shortcutTop);

  await expect(page.locator("#target-name")).toHaveText("Zed Remote");
  await expect(post).not.toHaveAttribute("aria-busy", "true");
  await expect(post).toHaveJSProperty("inert", false);
});

test("an action keeps its button width while sending and when done", async ({ page }) => {
  await openLink(page, "/notes/1");
  const like = action(page, "Like");
  const idleWidth = await widthOf(like);
  await like.click();
  const busy = page.locator("#action-controls button[aria-busy=true]");
  await expect(busy).toBeVisible();
  expect(await shownText(busy)).toBe("Liking…");
  expect(await widthOf(busy)).toBe(idleWidth);
  await expect(like).toHaveAttribute("aria-pressed", "true");
  expect(await widthOf(like)).toBe(idleWidth);
  // Taking it back is the same button, working in place.
  await like.click();
  await expect(busy).toBeVisible();
  expect(await shownText(busy)).toBe("Undoing…");
  expect(await widthOf(busy)).toBe(idleWidth);
  await expect(like).toHaveAttribute("aria-pressed", "false");
});

test("a link that fails to open clears the post and frees the form", async ({ page }) => {
  await openLink(page, "/notes/1");
  await page.fill("#post-url", mockUrl(page, "/notes/404"));
  await page.click("#open-link");
  await expect(page.locator("#lookup-error-text")).toBeVisible();
  await expect(page.locator("#post")).toHaveCount(0);
  await expect(page.locator("#post-url")).toBeEditable();
  expect(await shownText(page.locator("#open-link"))).toBe("Open");
});
