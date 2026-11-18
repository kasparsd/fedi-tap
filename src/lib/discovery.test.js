import { describe, expect, it } from "vitest";
import { isActorLink } from "./discovery.js";

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
