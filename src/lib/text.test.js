import { describe, expect, it } from "vitest";
import { cleanText } from "./text.js";

describe("cleanText", () => {
  it("collapses whitespace and keeps line breaks", () => {
    expect(cleanText("  a \t b \n\n  c  ", 100)).toBe("a b\nc");
  });

  it("removes control, bidirectional and zero-width characters", () => {
    expect(cleanText("a\u0000b\u202Ec\u200Bd\u2066e\uFEFFf\u0007", 100)).toBe("abcdef");
  });

  it("keeps joiners that emoji and scripts need", () => {
    expect(cleanText("👩\u200D👩\u200D👧", 100)).toBe("👩\u200D👩\u200D👧");
  });

  it("leaves text within the limit alone, with no ellipsis", () => {
    expect(cleanText("12345", 5)).toBe("12345");
  });

  it("cuts to the limit including the ellipsis, at a word when one is near", () => {
    const out = cleanText("one two three four five six", 20);
    expect(out).toBe("one two three four…");
    expect(Array.from(out).length).toBeLessThanOrEqual(20);
  });

  it("cuts a long unbroken run at the limit", () => {
    const out = cleanText("x".repeat(50), 10);
    expect(out).toBe(`${"x".repeat(9)}…`);
  });

  it("never splits an emoji", () => {
    const out = cleanText("😀".repeat(30), 10);
    expect(out).toBe(`${"😀".repeat(9)}…`);
  });

  it("returns an empty string for nothing", () => {
    expect(cleanText(undefined, 10)).toBe("");
    expect(cleanText("\u200B\u202E", 10)).toBe("");
  });
});
