import { expect, test } from "@playwright/test";
import { action, mockUrl, openLink, received, resetMock, signIn } from "../helpers.js";

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await signIn(page, "alice");
});

test("opens a post and shows its author, text and source", async ({ page }) => {
  await openLink(page, "/notes/1");
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
  await expect(page.locator("#target-name")).toHaveText("Dana Writer");
  await expect(page.locator("#target-excerpt")).toContainText("share sheet shortcut");
  await expect(page.locator("#target-link")).toHaveText("View on localhost");
});

test("a profile offers only Follow", async ({ page }) => {
  await openLink(page, "/users/zed");
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
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
  await expect(page.locator("#action-status")).toHaveText("Liked as @alice@localhost.");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#action-status")).toHaveText("Like undone.");
  const types = (await received(page)).map((activity) => activity.type);
  expect(types).toEqual(["Like", "Undo"]);
});

test("repost and follow the author", async ({ page }) => {
  await openLink(page, "/notes/1");
  await action(page, "Repost").click();
  await expect(action(page, "Repost")).toHaveAttribute("aria-pressed", "true");
  await action(page, "Follow").click();
  await expect(action(page, "Follow")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#action-status")).toHaveText(
    "Follow request sent as @alice@localhost.",
  );
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
  await expect(page.locator("#action-status")).toHaveText("Reply sent as @alice@localhost.");
  const [reply] = await received(page);
  expect(reply.type).toBe("Create");
  expect(reply.object.content).toBe("<p>@dana@localhost Nice &lt;post&gt; &amp; more</p>");
  expect(reply.object.tag).toMatchObject([{ type: "Mention", name: "@dana@localhost" }]);
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
  await expect(page.locator("#lookup-error-text")).toContainText("Couldn’t open this link");
  await expect(page.locator("#post-url")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#post-url")).toHaveAttribute("aria-describedby", "lookup-error-text");
  await expect(page.locator("#lookup-error details summary")).toBeVisible();
  await expect(page.locator("#target-card")).toHaveCount(0);
  await expect(page.locator("#post")).toHaveCount(0);
  await expect(page.locator("#post-url")).toBeEditable();
});

test("something that isn't a link gets the app's own message", async ({ page }) => {
  await page.fill("#post-url", "http://localhost/insecure");
  await page.click("#open-link");
  await expect(page.locator("#lookup-error-text")).toContainText("That isn’t a link.");
  await expect(page.locator("#post-url")).toHaveAttribute("aria-invalid", "true");
});

test("a reload reopens the link for the same account", async ({ page }) => {
  await openLink(page, "/notes/1");
  await page.reload();
  await expect(page.locator("#target-card")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("Open a post or profile");
  await expect(page.locator("#account-select option:checked")).toContainText("@alice@localhost");
});
