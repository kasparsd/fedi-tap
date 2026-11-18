import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fakeFetch, reply } from "../test-helpers.js";

let activityKey;
let backendFor;
let detect;

beforeAll(async () => {
  // The store, which the backends load, reads the page address when it loads.
  vi.stubGlobal("location", new URL("https://page.example/app/"));
  ({ activityKey, backendFor, detect } = await import("./backend.js"));
});

const HOME = "https://home.example";
const id = new URL(`${HOME}/users/me`);

afterEach(() => vi.unstubAllGlobals());

describe("detect", () => {
  it("uses the ActivityPub API when the profile advertises it, without probing", async () => {
    const fetch = fakeFetch({});
    vi.stubGlobal("fetch", fetch);
    const backend = await detect({ id, actor: { endpoints: { proxyUrl: `${HOME}/proxy` } } });
    expect(backend.type).toBe("activitypub");
    expect(fetch.calls).toHaveLength(0);
  });

  it("falls back to a Mastodon API when the instance answers", async () => {
    const fetch = fakeFetch({ [`GET ${HOME}/api/v1/instance`]: { version: "4.3.0" } });
    vi.stubGlobal("fetch", fetch);
    const backend = await detect({ id, actor: { outbox: `${HOME}/outbox` } });
    expect(backend.type).toBe("mastodon");
    expect(fetch.calls[0].url.href).toBe(`${HOME}/api/v1/instance`);
  });

  it("says the server isn't supported when neither answers", async () => {
    for (const answer of [undefined, { nothing: true }, reply(500, {})]) {
      vi.stubGlobal("fetch", fakeFetch({ [`GET ${HOME}/api/v1/instance`]: answer }));
      await expect(detect({ id, actor: {} })).rejects.toThrow(
        "It has neither the ActivityPub API nor a Mastodon-compatible API.",
      );
    }
  });

  it("ignores an answer from a different origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const response = reply(200, { version: "4.3.0" });
        Object.defineProperty(response, "url", { value: "https://other.example/api/v1/instance" });
        return response;
      }),
    );
    await expect(detect({ id, actor: {} })).rejects.toThrow("neither the ActivityPub API");
  });
});

describe("backendFor", () => {
  it("picks the backend by account type and knows no other", () => {
    expect(backendFor({ type: "mastodon" }).type).toBe("mastodon");
    expect(backendFor({ type: "activitypub" }).type).toBe("activitypub");
    expect(backendFor({})).toBeUndefined();
  });
});

describe("activityKey", () => {
  const post = {
    id: "https://social.example/notes/1",
    author: "https://social.example/users/dana",
  };

  it("keys a follow by the author and other actions by the post", () => {
    expect(activityKey("me", post, "follow")).toBe(`me ${post.author} follow`);
    expect(activityKey("me", post, "like")).toBe(`me ${post.id} like`);
  });
});
