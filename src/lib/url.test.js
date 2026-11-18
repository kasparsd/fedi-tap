import { describe, expect, it } from "vitest";
import { homeEndpoint, httpsUrl, parseHandle } from "./url.js";

describe("httpsUrl", () => {
  it("accepts plain HTTPS", () => {
    expect(httpsUrl("https://example.com/a?b=1")?.href).toBe("https://example.com/a?b=1");
  });

  it.each([
    "http://example.com",
    "https://user:pass@example.com",
    "https://user@example.com",
    "javascript:alert(1)",
    "not a url",
    "",
    null,
    42,
  ])("refuses %s", (value) => {
    expect(httpsUrl(value)).toBeNull();
  });
});

describe("homeEndpoint", () => {
  const origin = "https://example.com";

  it("accepts a URL on the same origin", () => {
    expect(homeEndpoint("https://example.com/oauth/token", origin)?.href).toBe(
      "https://example.com/oauth/token",
    );
  });

  it("refuses another origin, a fragment or a port change", () => {
    expect(homeEndpoint("https://evil.example/oauth", origin)).toBeNull();
    expect(homeEndpoint("https://example.com/oauth#x", origin)).toBeNull();
    expect(homeEndpoint("https://example.com:8443/oauth", origin)).toBeNull();
  });
});

describe("parseHandle", () => {
  it("reads @user@host, user@host and acct: forms", () => {
    for (const value of ["@me@example.com", "me@example.com", "acct:me@example.com"]) {
      expect(parseHandle(value)).toEqual({
        handle: "me@example.com",
        origin: "https://example.com",
      });
    }
  });

  it("refuses anything that is not a handle", () => {
    for (const value of ["me", "@me@", "me@exa mple.com", "me@example.com/path", "me@a@b", null]) {
      expect(parseHandle(value)).toBeNull();
    }
  });
});
