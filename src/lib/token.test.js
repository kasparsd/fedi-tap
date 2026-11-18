import { describe, expect, it } from "vitest";
import { base64url, renewableCredentials } from "./token.js";

describe("renewableCredentials", () => {
  const good = { access_token: "a", refresh_token: "r", expires_in: 3600 };

  it("returns the credentials with an absolute expiry", () => {
    const credentials = renewableCredentials(good);
    expect(credentials).toMatchObject({ token: "a", refresh_token: "r" });
    expect(credentials.expires).toBeGreaterThan(Date.now() / 1000);
  });

  it("falls back to the previous refresh token", () => {
    expect(renewableCredentials({ ...good, refresh_token: undefined }, "old")?.refresh_token).toBe(
      "old",
    );
  });

  it("refuses responses that can't be renewed", () => {
    expect(renewableCredentials({ ...good, refresh_token: undefined })).toBeNull();
    expect(renewableCredentials({ ...good, expires_in: 0 })).toBeNull();
    expect(renewableCredentials({ ...good, expires_in: "soon" })).toBeNull();
    expect(renewableCredentials({ ...good, access_token: "" })).toBeNull();
    expect(renewableCredentials(null)).toBeNull();
  });
});

describe("base64url", () => {
  it("is URL-safe and unpadded", () => {
    expect(base64url(new Uint8Array([251, 255, 254]))).toBe("-__-");
    expect(base64url(new Uint8Array([1]))).toBe("AQ");
  });
});
