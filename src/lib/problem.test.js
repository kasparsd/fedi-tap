import { describe, expect, it } from "vitest";
import { networkProblem } from "./problem.js";

const timeout = () => new DOMException("The operation timed out.", "TimeoutError");

describe("networkProblem", () => {
  it("says a read that timed out was slow, not blocked", () => {
    const problem = networkProblem(timeout());
    expect(problem.title).toBe("Your server took too long.");
    expect(problem.message).not.toMatch(/gone through/);
    expect(problem.link).toBeUndefined();
  });

  it("warns that a send that timed out may still have gone through", () => {
    expect(networkProblem(timeout(), { sent: true }).message).toMatch(
      /may still have gone through/,
    );
  });

  it("keeps the CORS and offline help for any other failure", () => {
    const problem = networkProblem(new TypeError("Failed to fetch"));
    expect(problem.title).toBe("Couldn’t reach your server.");
    expect(problem.link).toBeDefined();
    expect(problem.detail).toContain("Failed to fetch");
  });
});
