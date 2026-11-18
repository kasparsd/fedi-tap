import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeFetch, reply } from "../../test-helpers.js";
import { act, resolve, undo } from "./actions.js";

// Server HTML needs a browser's DOMParser; the text itself is covered elsewhere.
vi.mock("../text.js", async (original) => ({
  ...(await original()),
  plainText: (value, limit) => (typeof value === "string" ? value.slice(0, limit) : ""),
}));

const API = "https://home.example";
const account = { api: API, token: "t1", handle: "me@home.example" };
const dana = {
  id: "77",
  username: "dana",
  acct: "dana@social.example",
  uri: "https://social.example/users/dana",
  display_name: "Dana",
};
const status = {
  id: "100",
  uri: "https://social.example/users/dana/statuses/100",
  url: "https://social.example/@dana/100",
  created_at: "2026-11-17T09:30:00Z",
  visibility: "private",
  content: "Hello",
  account: dana,
};
const search = (result) => ({ [`GET ${API}/api/v2/search`]: result });

afterEach(() => vi.unstubAllGlobals());

describe("resolve", () => {
  it("opens a status with its author, mention and visibility", async () => {
    const fetch = fakeFetch(search({ statuses: [status], accounts: [] }));
    vi.stubGlobal("fetch", fetch);
    const target = await resolve(account, "https://social.example/@dana/100");
    expect(target).toMatchObject({
      id: status.uri,
      author: dana.uri,
      mention: "@dana@social.example",
      isActor: false,
      name: "Dana",
      excerpt: "Hello",
      statusId: "100",
      accountId: "77",
      visibility: "private",
    });
    const query = fetch.calls[0].url.searchParams;
    expect(query.get("q")).toBe("https://social.example/@dana/100");
    expect(query.get("resolve")).toBe("true");
    expect(fetch.calls[0].headers.Authorization).toBe("Bearer t1");
  });

  it("opens a profile when there is no status", async () => {
    vi.stubGlobal("fetch", fakeFetch(search({ statuses: [], accounts: [dana] })));
    const target = await resolve(account, "https://social.example/users/dana");
    expect(target).toMatchObject({ isActor: true, id: dana.uri, author: dana.uri, statusId: null });
  });

  it("adds the home server's host to its own accounts", async () => {
    const mine = { ...dana, acct: "dana", uri: "https://home.example/users/dana" };
    vi.stubGlobal("fetch", fakeFetch(search({ statuses: [], accounts: [mine] })));
    const target = await resolve(account, "https://home.example/users/dana");
    expect(target.mention).toBe("@dana@home.example");
  });

  it("refuses an object from a different address than the one opened", async () => {
    vi.stubGlobal("fetch", fakeFetch(search({ statuses: [status] })));
    await expect(resolve(account, "https://other.example/@dana/100")).rejects.toThrow(
      "Your server returned something from a different address.",
    );
  });

  it("refuses an author without an HTTPS id", async () => {
    const bad = { ...status, account: { ...dana, uri: "http://social.example/users/dana" } };
    vi.stubGlobal("fetch", fakeFetch(search({ statuses: [bad] })));
    await expect(resolve(account, "https://social.example/@dana/100")).rejects.toThrow(
      "No post or profile came back.",
    );
  });

  it("explains an empty search", async () => {
    vi.stubGlobal("fetch", fakeFetch(search({ statuses: [], accounts: [] })));
    await expect(resolve(account, "https://social.example/@dana/100")).rejects.toThrow(
      "Your server can’t find it.",
    );
  });
});

const target = {
  id: status.uri,
  author: dana.uri,
  mention: "@dana@social.example",
  isActor: false,
  statusId: "100",
  accountId: "77",
  visibility: "private",
};

function server(extra = {}) {
  return fakeFetch({
    [`POST ${API}/api/v1/statuses/100/favourite`]: { id: "100" },
    [`POST ${API}/api/v1/statuses/100/unfavourite`]: { id: "100" },
    [`POST ${API}/api/v1/statuses/100/reblog`]: { id: "9" },
    [`POST ${API}/api/v1/statuses/100/unreblog`]: { id: "100" },
    [`POST ${API}/api/v1/accounts/77/follow`]: { id: "77", requested: true },
    [`POST ${API}/api/v1/accounts/77/unfollow`]: { id: "77" },
    [`POST ${API}/api/v1/statuses`]: { id: "200" },
    ...extra,
  });
}

describe("act and undo", () => {
  it.each([
    ["like", "favourite", "unfavourite"],
    ["repost", "reblog", "unreblog"],
    ["follow", null, "unfollow"],
  ])("%s can be undone", async (action, path, undoPath) => {
    const fetch = server();
    vi.stubGlobal("fetch", fetch);
    const sent = await act(account, action, target, "");
    expect(sent.undo).toBe(true);
    if (path) expect(fetch.calls[0].url.pathname).toBe(`/api/v1/statuses/100/${path}`);
    else expect(fetch.calls[0].url.pathname).toBe("/api/v1/accounts/77/follow");
    await undo(account, sent);
    expect(fetch.calls[1].url.pathname.endsWith(`/${undoPath}`)).toBe(true);
    expect(fetch.calls[1].method).toBe("POST");
  });

  it("replies in plain text with the mention, the parent's visibility and an idempotency key", async () => {
    const fetch = server();
    vi.stubGlobal("fetch", fetch);
    const sent = await act(account, "reply", target, "Hi <b>there</b>\n\nSecond");
    expect(sent.undo).toBe(false);
    const [call] = fetch.calls;
    expect(call.body).toEqual({
      status: "@dana@social.example Hi <b>there</b>\n\nSecond",
      in_reply_to_id: "100",
      visibility: "private",
    });
    expect(call.headers["Idempotency-Key"]).toMatch(/\S{20,}/);
  });

  it("does not mention an author it couldn't verify", async () => {
    const fetch = server();
    vi.stubGlobal("fetch", fetch);
    await act(account, "reply", { ...target, author: null }, "Hi");
    expect(fetch.calls[0].body.status).toBe("Hi");
  });

  it("refuses a follow without a verified author, a like on a profile and an empty reply", async () => {
    vi.stubGlobal("fetch", server());
    await expect(act(account, "follow", { ...target, author: null }, "")).rejects.toThrow(
      "no one to follow",
    );
    await expect(act(account, "like", { ...target, isActor: true }, "")).rejects.toThrow(
      "Only Follow",
    );
    await expect(act(account, "reply", target, "  ")).rejects.toThrow("Write a reply first.");
  });

  it("says a rejected action was rejected, with the server's reason", async () => {
    vi.stubGlobal(
      "fetch",
      server({ [`POST ${API}/api/v1/statuses/100/favourite`]: reply(422, { error: "Nope" }) }),
    );
    await expect(act(account, "like", target, "")).rejects.toMatchObject({
      message: "Your server rejected it.",
      detail: "HTTP 422: Nope",
    });
  });

  it("warns that a reply may have gone through when the server fails after receiving it", async () => {
    vi.stubGlobal("fetch", server({ [`POST ${API}/api/v1/statuses`]: reply(502, {}) }));
    await expect(act(account, "reply", target, "Hi")).rejects.toMatchObject({ ambiguous: true });
  });

  it("renews the token once after a 401 and sends again", async () => {
    let first = true;
    const fetch = server({
      [`POST ${API}/api/v1/statuses/100/favourite`]: () => {
        if (!first) return { id: "100" };
        first = false;
        return reply(401, { error: "bad token" });
      },
    });
    vi.stubGlobal("fetch", fetch);
    const renew = vi.fn(async () => {
      account.token = "t2";
    });
    await act(account, "like", target, "", renew);
    expect(renew).toHaveBeenCalledOnce();
    expect(fetch.calls.map((call) => call.headers.Authorization)).toEqual([
      "Bearer t1",
      "Bearer t2",
    ]);
    account.token = "t1";
  });

  it("gives up when the renewed token is refused too, and when renewing ends the session", async () => {
    vi.stubGlobal(
      "fetch",
      server({ [`POST ${API}/api/v1/statuses/100/favourite`]: () => reply(401, {}) }),
    );
    await expect(act(account, "like", target, "", async () => {})).rejects.toThrow(
      "Sign in again from the account menu.",
    );
    const ended = Object.assign(new Error("Sign in again as @me."), { sessionEnded: true });
    await expect(
      act(account, "like", target, "", async () => {
        throw ended;
      }),
    ).rejects.toMatchObject({ sessionEnded: true });
  });
});
