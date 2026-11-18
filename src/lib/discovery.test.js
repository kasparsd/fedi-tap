import { afterEach, describe, expect, it, vi } from "vitest";
import { findActor, isActorLink } from "./discovery.js";

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

describe("findActor with a server that refuses unsigned profile reads", () => {
  const jrd = {
    links: [
      { rel: "self", type: "application/activity+json", href: "https://example.social/users/me" },
    ],
  };

  function serve(actorStatus) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const href = String(url);
        const refused = href.includes("/users/me");
        const response = new Response(refused ? "{}" : JSON.stringify(jrd), {
          status: refused ? actorStatus : 200,
        });
        Object.defineProperty(response, "url", { value: href });
        return response;
      }),
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it("goes on with the address WebFinger gave, without the document", async () => {
    serve(401);
    const found = await findActor("@me@example.social");
    expect(found.actor).toBeNull();
    expect(found.id.href).toBe("https://example.social/users/me");
  });

  it("still refuses a typed profile link", async () => {
    serve(401);
    await expect(findActor("https://example.social/users/me")).rejects.toThrow();
  });

  it("still fails on other errors", async () => {
    serve(500);
    await expect(findActor("@me@example.social")).rejects.toThrow();
  });
});
