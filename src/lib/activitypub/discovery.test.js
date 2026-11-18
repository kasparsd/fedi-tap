import { describe, expect, it } from "vitest";
import { actorSettings, hasClientApi } from "./discovery.js";

const origin = "https://home.example";
const actor = {
  outbox: `${origin}/outbox`,
  followers: `${origin}/followers`,
  endpoints: { proxyUrl: `${origin}/proxy` },
};

describe("actorSettings", () => {
  it("returns the endpoints", () => {
    expect(actorSettings(actor, origin)).toEqual({
      outbox: `${origin}/outbox`,
      proxy: `${origin}/proxy`,
      followers: `${origin}/followers`,
    });
  });

  it("says the API is off when an endpoint is missing", () => {
    expect(() => actorSettings({ ...actor, outbox: undefined }, origin)).toThrow(
      "It has no ActivityPub API.",
    );
  });

  it("refuses endpoints on another site", () => {
    expect(() =>
      actorSettings({ ...actor, endpoints: { proxyUrl: "https://evil.example/proxy" } }, origin),
    ).toThrow("The outbox and proxy addresses are on a different site.");
  });
});

describe("hasClientApi", () => {
  it("is true when any client API endpoint is advertised", () => {
    expect(hasClientApi(actor)).toBe(true);
    expect(hasClientApi({ endpoints: { oauthTokenEndpoint: `${origin}/token` } })).toBe(true);
  });

  it("is false for a plain actor, like Mastodon's", () => {
    expect(hasClientApi({ outbox: `${origin}/outbox` })).toBe(false);
    expect(hasClientApi(null)).toBe(false);
  });
});
