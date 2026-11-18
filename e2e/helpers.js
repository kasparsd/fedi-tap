import { expect } from "@playwright/test";

/** Clears the mock server's tokens, received activities and its "API off" switch. */
export async function resetMock(page) {
  await page.goto("/_dev/");
  await page.evaluate(() => fetch("/_dev/reset", { method: "POST" }));
}

/** The activities the mock server received, oldest first. */
export const received = (page) =>
  page.evaluate(() => fetch("/_dev/activities").then((response) => response.json()));

/** A mock user's profile link on the server under test. */
export const profileLink = (page, user) => `${new URL(page.url()).origin}/users/${user}`;

/** Any post or profile on the mock server, as a link. */
export const mockUrl = (page, path) => `${new URL(page.url()).origin}${path}`;

/**
 * Signs in as a mock user with a profile link, through the mock's authorize page, and waits for
 * the page to come back. `from` is the first address (a shared link, for example).
 */
export async function signIn(page, user, { from = "/", ready = "#post-url" } = {}) {
  await page.goto(from);
  const origin = new URL(page.url()).origin;
  await page.fill("#account-input", `${origin}/users/${user}`);
  await Promise.all([page.waitForURL(/oauth\/authorize/), page.click("#continue")]);
  await page.selectOption("select[name=user]", user);
  await Promise.all([
    page.waitForURL((url) => url.origin === origin && url.pathname === "/"),
    page.click("button[value=approve]"),
  ]);
  await page.waitForSelector(ready, { timeout: 30000 });
}

/** Opens a link through the form and waits for the post or profile card. */
export async function openLink(page, path) {
  await page.fill("#post-url", mockUrl(page, path));
  await page.click("#open-link");
  await expect(page.locator("#target-card")).toBeVisible();
}

/** The text a button shows, without the hidden text that keeps its width. */
export const shownText = (button) => button.locator(".swap > span").first().textContent();

/** The width of an element in pixels. */
export async function widthOf(locator) {
  const box = await locator.boundingBox();
  return Math.round(box.width * 10) / 10;
}

/** The page's own vertical position of an element, which moves when content above it changes size. */
export function topOf(locator) {
  return locator.evaluate((element) => Math.round(element.getBoundingClientRect().top + scrollY));
}

// A toggle's name changes when it is on (Like, Liked), so match both.
const ACTION_NAMES = {
  Like: /^(Like|Liked)$/,
  Repost: /^(Repost|Reposted)$/,
  Follow: /^(Follow|Requested)$/,
  Reply: /^Reply$/,
};

/** One of the action buttons (Like, Repost, Reply, Follow), whether or not it is on. */
export const action = (page, name) => page.getByRole("button", { name: ACTION_NAMES[name] });
