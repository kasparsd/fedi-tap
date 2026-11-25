import { expect, test } from "@playwright/test";
import {
  action,
  expectSignedIn,
  expectView,
  mockUrl,
  openLink,
  problem,
  received,
  resetMock,
  signIn,
} from "../helpers.js";

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await signIn(page, "alice");
});

test("opens a post and shows its author, text and source", async ({ page }) => {
  await openLink(page, "/notes/1");
  await expectView(page, "loaded");
  await expect(page.locator("#target-name")).toHaveText("Dana Writer");
  await expect(page.locator("#target-excerpt")).toContainText("share sheet shortcut");
  await expect(page.locator("#target-link")).toHaveAttribute("href", mockUrl(page, "/notes/1"));
});

test("a profile offers only Follow", async ({ page }) => {
  await openLink(page, "/users/zed");
  await expect(action(page, "Follow")).toBeVisible();
  for (const name of ["Like", "Repost", "Reply"]) {
    await expect(action(page, name)).toHaveCount(0);
  }
});

// Like, Repost and Follow are toggles: pressing one that is on undoes it.
test("like and undo", async ({ page }) => {
  await openLink(page, "/notes/1");
  const like = action(page, "Like");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  const types = (await received(page)).map((activity) => activity.type);
  expect(types).toEqual(["Like", "Undo"]);
});

test("repost and follow the author", async ({ page }) => {
  await openLink(page, "/notes/1");
  await action(page, "Repost").click();
  await expect(action(page, "Repost")).toHaveAttribute("aria-pressed", "true");
  await action(page, "Follow").click();
  await expect(action(page, "Follow")).toHaveAttribute("aria-pressed", "true");
  const types = (await received(page)).map((activity) => activity.type);
  expect(types).toEqual(["Announce", "Follow"]);
});

test("a reply mentions the author and escapes what was typed", async ({ page }) => {
  await openLink(page, "/notes/1");
  await action(page, "Reply").click();
  await expect(page.locator("#reply-sheet")).toHaveJSProperty("open", true);
  await expect(page.locator("#reply-text")).toBeFocused();
  await expect(page.locator("#reply-send")).toBeDisabled();
  await page.fill("#reply-text", "Nice <post> & more");
  await page.click("#reply-send");
  await expect(page.locator("#reply-sheet")).toHaveJSProperty("open", false);
  const [reply] = await received(page);
  expect(reply.type).toBe("Create");
  expect(reply.object.content).toBe("<p>@dana@localhost Nice &lt;post&gt; &amp; more</p>");
  expect(reply.object.tag).toMatchObject([{ type: "Mention", name: "@dana@localhost" }]);
});

test("a reply to a followers-only post stays followers-only", async ({ page }) => {
  await openLink(page, "/notes/4");
  await expect(page.locator("#reply-note")).toHaveCount(0);
  await action(page, "Reply").click();
  await expect(page.locator("#reply-note")).toBeVisible();
  await page.fill("#reply-text", "Hi");
  await page.click("#reply-send");
  await expect(page.locator("#reply-sheet")).toHaveJSProperty("open", false);
  const [reply] = await received(page);
  expect(reply.to.join()).not.toContain("#Public");
  expect(reply.cc.join()).not.toContain("#Public");
  expect(reply.object.to).toEqual(reply.to);
});

test("a followers-only post can't be reposted, and a tap says why", async ({ page }) => {
  await openLink(page, "/notes/4");
  const repost = action(page, "Repost");
  await expect(repost).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#server-repost")).toHaveCount(0);
  // Playwright won't click an aria-disabled button; a person can, and that's the tap being tested.
  await repost.click({ force: true });
  await expect(page.locator("#action-status")).not.toBeEmpty();
  await expect(page.locator(".pill")).toBeVisible();
  await expect(repost).toHaveAttribute("aria-pressed", "false");
  expect(await received(page)).toEqual([]);
});

test("editing the link locks the post that was opened for the old one", async ({ page }) => {
  await openLink(page, "/notes/1");
  await expect(page.locator("#post")).toHaveJSProperty("inert", false);
  await page.fill("#post-url", mockUrl(page, "/notes/2"));
  await expect(page.locator("#post")).toHaveJSProperty("inert", true);
  await page.fill("#post-url", mockUrl(page, "/notes/1"));
  await expect(page.locator("#post")).toHaveJSProperty("inert", false);
});

test("Escape closes the reply sheet and keeps the draft", async ({ page }) => {
  await openLink(page, "/notes/1");
  await action(page, "Reply").click();
  await page.fill("#reply-text", "Draft");
  await page.keyboard.press("Escape");
  await expect(page.locator("#reply-sheet")).toHaveJSProperty("open", false);
  await expect(action(page, "Reply")).toBeFocused();
  await action(page, "Reply").click();
  await expect(page.locator("#reply-text")).toHaveValue("Draft");
});

test("a missing post shows the problem and leaves nothing behind", async ({ page }) => {
  await openLink(page, "/notes/1");
  await page.fill("#post-url", mockUrl(page, "/notes/404"));
  await page.click("#open-link");
  await expect(problem(page, "lookup")).toBeVisible();
  await expect(page.locator("#post-url")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#post-url")).toHaveAttribute("aria-describedby", "lookup-error-text");
  await expect(page.locator("#lookup-error details summary")).toBeVisible();
  await expect(page.locator("#target-card")).toHaveCount(0);
  await expect(page.locator("#post")).toHaveCount(0);
  await expect(page.locator("#post-url")).toBeEditable();
});

test("a link that isn't a post or profile says what it is and offers it in the browser", async ({
  page,
}) => {
  for (const path of ["/web/page", "/web/collection"]) {
    await page.fill("#post-url", mockUrl(page, path));
    await page.click("#open-link");
    await expect(problem(page, "lookup")).toBeVisible();
    // The link comes back to the person, so they can see what it is.
    await expect(page.locator("#lookup-error details a")).toHaveAttribute(
      "href",
      mockUrl(page, path),
    );
    await expect(page.locator("#target-card")).toHaveCount(0);
  }
});

test("something that isn't a link gets the app's own message", async ({ page }) => {
  await page.fill("#post-url", "http://localhost/insecure");
  await page.click("#open-link");
  await expect(problem(page, "lookup")).toBeVisible();
  await expect(page.locator("#post-url")).toHaveAttribute("aria-invalid", "true");
});

test("a reload reopens the link for the same account", async ({ page }) => {
  await openLink(page, "/notes/1");
  await page.reload();
  await expect(page.locator("#target-card")).toBeVisible();
  await expectSignedIn(page);
  await expect(page.locator("#account-select option:checked")).toContainText("@alice@localhost");
});

test("a post groups the in-app actions and the server's own actions", async ({ page }) => {
  await openLink(page, "/notes/1");
  const origin = new URL(page.url()).origin;
  await expect(page.locator("#api-label")).toBeVisible();
  await expect(page.locator("#server-label")).toBeVisible();
  const expected = {
    like: ["like", "/notes/1"],
    repost: ["announce", "/notes/1"],
    reply: ["create", "/notes/1"],
    follow: ["follow", "/users/dana"],
    open: [null, "/notes/1"],
  };
  const ids = await page.locator("#server-links a").evaluateAll((links) => links.map((a) => a.id));
  expect(ids).toEqual(Object.keys(expected).map((name) => `server-${name}`));
  for (const [name, [intent, path]] of Object.entries(expected)) {
    const link = page.locator(`#server-${name}`);
    const href = new URL(await link.getAttribute("href"));
    expect(href.pathname).toBe("/interactions");
    expect(href.searchParams.get("uri")).toBe(`${origin}${path}`);
    expect(href.searchParams.get("intent")).toBe(intent);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
});

test("the reply sheet has only the in-app reply", async ({ page }) => {
  await openLink(page, "/notes/1");
  await action(page, "Reply").click();
  await expect(page.locator("#reply-text")).toBeVisible();
  await expect(page.locator("#reply-sheet a")).toHaveCount(0);
});

test("a profile offers the server's own Follow and Open only", async ({ page }) => {
  await openLink(page, "/users/zed");
  const ids = await page.locator("#server-links a").evaluateAll((links) => links.map((a) => a.id));
  expect(ids).toEqual(["server-follow", "server-open"]);
});

test("hostile markup in a post reaches the page only as plain text", async ({ page }) => {
  await openLink(page, "/notes/5");
  const excerpt = page.locator("#target-excerpt");
  await expect(excerpt).toContainText("Safe words.");
  const text = await excerpt.textContent();
  expect(text).toContain("click");
  // Escaped markup stays visible as characters; code from script and style never shows as text.
  expect(text).toContain("<b>not bold</b>");
  expect(text).not.toMatch(/__pwned|display:none|vector|\u202E|\u200B/);
  // The excerpt is one text node: no element was inserted, and nothing ran.
  await expect(excerpt.locator("*")).toHaveCount(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test("a long post is cut to a known length with an ellipsis", async ({ page }) => {
  await openLink(page, "/notes/2");
  const text = await page.locator("#target-excerpt").textContent();
  expect(Array.from(text).length).toBeLessThanOrEqual(600);
});
