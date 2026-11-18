import { describe, expect, it } from "vitest";
import { actorSettings, isActorLink } from "./discovery.js";

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

describe("isActorLink", () => {
  it("accepts the self link with an activity+json or profiled ld+json type", () => {
    expect(isActorLink({ rel: "self", type: "application/activity+json" })).toBe(true);
    expect(
      isActorLink({
        rel: "self",
        type: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
      }),
    ).toBe(true);
  });

  it("refuses other links", () => {
    expect(isActorLink({ rel: "alternate", type: "application/activity+json" })).toBe(false);
    expect(isActorLink({ rel: "self", type: "text/html" })).toBe(false);
    expect(isActorLink({ rel: "self", type: "application/ld+json" })).toBe(false);
  });
});
