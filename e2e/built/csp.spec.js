import { expect, test } from "@playwright/test";
import { action, openAccounts, openLink, resetMock, signIn } from "../helpers.js";

// The production build runs under its Content Security Policy. Walk through the screens and make
// sure the browser never blocks anything and nothing logs an error.
test("the built page works under its Content Security Policy", async ({ page }) => {
  const violations = [];
  const errors = [];
  await page.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  await resetMock(page);
  await page.goto("/");
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(policy).toContain("script-src 'self'");
  expect(policy).not.toContain("unsafe-");
  expect(policy).toContain("require-trusted-types-for 'script'");
  expect(policy).toContain("form-action 'none'");
  // A plain string never reaches an HTML sink, from this page's own code or anyone else's.
  expect(
    await page.evaluate(() => {
      try {
        document.createRange().createContextualFragment("<b>x</b>");
        return "allowed";
      } catch (error) {
        return error.name;
      }
    }),
  ).toBe("TypeError");

  await signIn(page, "alice");
  // The account's own photo is the one remote image the policy has to let through.
  await expect(page.locator("#account-active img")).toBeVisible();
  // Hostile server markup is parsed into an inert document without a Trusted Types violation. The browser
  // may report the markup's own inline handlers (onload, onerror) as blocked while parsing it (some
  // versions do, some don't), though nothing runs there; those reports are allowed here and nothing else is.
  const logged = violations.length;
  await openLink(page, "/notes/5");
  await expect(page.locator("#target-excerpt")).toContainText("Safe words.");
  await expect(page.locator("#target-excerpt *")).toHaveCount(0);
  const hostile = await page.evaluate(() => window.__violations.splice(0));
  expect(hostile.filter((violation) => !violation.startsWith("script-src-attr"))).toEqual([]);
  violations.splice(logged);
  await openLink(page, "/notes/1");
  await action(page, "Like").click();
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "true");
  await action(page, "Reply").click();
  await expect(page.locator("#reply-sheet")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await openAccounts(page);

  violations.push(...(await page.evaluate(() => window.__violations)));
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});
