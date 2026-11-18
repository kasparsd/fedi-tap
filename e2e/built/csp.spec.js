import { expect, test } from "@playwright/test";
import { action, openLink, resetMock, signIn } from "../helpers.js";

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

  await signIn(page, "alice");
  await openLink(page, "/notes/1");
  await action(page, "Like").click();
  await expect(action(page, "Like")).toHaveAttribute("aria-pressed", "true");
  await action(page, "Reply").click();
  await expect(page.locator("#reply-sheet")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await page.selectOption("#account-select", "add");
  await expect(page.locator("#accounts-sheet")).toHaveJSProperty("open", true);

  violations.push(...(await page.evaluate(() => window.__violations)));
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});
