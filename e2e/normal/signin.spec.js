import { expect, test } from "@playwright/test";
import { mockUrl, profileLink, resetMock, signIn } from "../helpers.js";

test.beforeEach(({ page }) => resetMock(page));

test.describe("signed out", () => {
  test("shows the mark, explains the app and offers the Shortcut", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Connect account");
    const mark = page.getByRole("link", { name: "FediTap" });
    await expect(mark).toHaveText("⁂tap");
    await expect(page.getByText("Act on Fediverse posts from your own account:")).toBeVisible();
    await expect(page.locator("main ol li")).toHaveText([
      "Connect your Fediverse account.",
      "Open a post or profile link, or share one from your phone.",
      "Like, repost, reply or follow.",
    ]);
    await expect(page.locator("#shortcut-card")).toBeVisible();
    await expect(page.locator("#shortcut-have")).toHaveCount(0);
  });

  test("a handle that can't be found offers a profile link", async ({ page }) => {
    await page.goto("/");
    await page.fill("#account-input", "@nobody@localhost");
    await page.click("#continue");
    await expect(page.locator("#error-text")).toContainText("Can’t find nobody@localhost");
    await expect(page.locator("#account-input")).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Use profile link" }).click();
    await expect(page.locator("#account-input")).toHaveAttribute("type", "url");
    await expect(page.locator("#account-label")).toHaveText("Profile link");
  });

  test("a server without the API says so and points to help", async ({ page }) => {
    await page.goto("/_dev/");
    await page.evaluate(() => fetch("/_dev/api-off", { method: "POST" }));
    await page.goto("/");
    await page.fill("#account-input", profileLink(page, "alice"));
    await page.click("#continue");
    await expect(page.locator("#error-text")).toContainText("Server not supported");
    await expect(page.locator("#error details a")).toHaveCount(1);
  });
});

test.describe("signing in", () => {
  test("signs in with a profile link and cleans up the address", async ({ page }) => {
    await signIn(page, "alice");
    await expect(page.locator("h1")).toHaveText("Open a post or profile");
    expect(page.url()).not.toMatch(/code=|state=|iss=/);
    await expect(page.locator("#account-select option:checked")).toContainText("@alice@localhost");
  });

  test("a shared link waits through sign-in and then opens", async ({ page }) => {
    await page.goto(`/?url=${encodeURIComponent(mockUrl(page, "/notes/1"))}`);
    await expect(page.locator("#pending-link")).toHaveText(mockUrl(page, "/notes/1"));
    await signIn(page, "alice", {
      from: `/?url=${encodeURIComponent(mockUrl(page, "/notes/1"))}`,
      ready: "#target-card",
    });
    await expect(page.locator("h1")).toHaveText("Open a post or profile");
    await expect(page.locator("#post-url")).toHaveValue(mockUrl(page, "/notes/1"));
    expect(page.url()).toContain("url=");
    expect(page.url()).not.toMatch(/code=|state=/);
  });

  test("an account that authorizes as someone else is refused", async ({ page }) => {
    await signIn(page, "mismatch", { ready: "#error-text" });
    await expect(page.locator("#error-text")).toContainText("Wrong account");
    await expect(page.locator("h1")).toHaveText("Connect account");
  });

  test("the Shortcut launch parameter is removed from the address", async ({ page }) => {
    await signIn(page, "alice");
    await page.goto("/?via=shortcut");
    await expect(page.locator("#post-url")).toBeVisible();
    expect(page.url()).not.toContain("via=");
  });
});

test.describe("unsupported", () => {
  test("damaged saved data offers a reset", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem(`feditap.accounts:${new URL("./", location.href).pathname}`, "{bad");
    });
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Saved data is damaged");
    await Promise.all([page.waitForEvent("load"), page.click("#reset-data")]);
    await expect(page.locator("h1")).toHaveText("Connect account");
  });
});

test.describe("on an iPhone", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });

  test("shows the Home Screen hint with the Shortcut", async ({ page }) => {
    await signIn(page, "alice");
    await expect(page.locator("#shortcut-card")).toBeVisible();
    await expect(page.locator("#a2hs")).toBeVisible();
  });
});

test("desktop browsers get the Shortcut but no Home Screen hint", async ({ page }) => {
  await signIn(page, "alice");
  await expect(page.locator("#shortcut-card")).toBeVisible();
  await expect(page.locator("#a2hs")).toHaveCount(0);
});
