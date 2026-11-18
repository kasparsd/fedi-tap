import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFetch, reply } from "../../test-helpers.js";

const HOME = "https://home.example";
const PAGE = "https://page.example/app/";
const actor = `${HOME}/users/me`;
const found = {
  id: new URL(actor),
  profile: new URL(actor),
  webfinger: new URL(`${HOME}/.well-known/webfinger?resource=acct:me@home.example`),
};

let signin;
let store;
let data;

function stubBrowser() {
  data = new Map();
  vi.stubGlobal("location", new URL(PAGE));
  vi.stubGlobal("navigator", { locks: { request: (_name, run) => run() }, onLine: true });
  vi.stubGlobal("localStorage", {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  });
}

beforeAll(async () => {
  // The store reads the page address when it loads.
  stubBrowser();
  signin = await import("./signin.js");
  store = await import("../store.js");
});

beforeEach(stubBrowser);
afterEach(() => vi.unstubAllGlobals());

describe("chooseScope", () => {
  it("uses granular scopes unless the server lists too few", () => {
    expect(signin.chooseScope(undefined)).toBe(signin.GRANULAR_SCOPE);
    expect(signin.chooseScope({ scopes_supported: signin.GRANULAR_SCOPE.split(" ") })).toBe(
      signin.GRANULAR_SCOPE,
    );
    expect(signin.chooseScope({ scopes_supported: ["read", "write", "follow"] })).toBe(
      signin.BROAD_SCOPE,
    );
  });
});

describe("covers", () => {
  it("accepts a scope directly or through its parent", () => {
    expect(signin.covers(["read:accounts"], "read:accounts")).toBe(true);
    expect(signin.covers(["read"], "read:search")).toBe(true);
    expect(signin.covers(["write"], "write:statuses")).toBe(true);
    expect(signin.covers(["follow"], "write:follows")).toBe(true);
    expect(signin.covers(["read"], "write:statuses")).toBe(false);
    expect(signin.covers(["read:accounts"], "read:search")).toBe(false);
  });
});

const metadata = (extra = {}) => ({
  issuer: HOME,
  authorization_endpoint: `${HOME}/oauth/authorize`,
  token_endpoint: `${HOME}/oauth/token`,
  ...extra,
});
const registered = { client_id: "cid", client_secret: "secret" };

describe("prepare", () => {
  it("registers one app per server and reuses it", async () => {
    const fetch = fakeFetch({
      [`GET ${HOME}/.well-known/oauth-authorization-server`]: metadata({
        registration_endpoint: `${HOME}/api/v1/apps`,
      }),
      [`POST ${HOME}/api/v1/apps`]: registered,
    });
    vi.stubGlobal("fetch", fetch);
    const first = await signin.prepare(found);
    const second = await signin.prepare(found);
    expect(fetch.calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(first.client).toEqual({
      client_id: "cid",
      redirect_uri: PAGE,
      scope: signin.GRANULAR_SCOPE,
    });
    expect(second.client).toEqual(first.client);
    expect(first.endpoints).toMatchObject({ authorize: `${HOME}/oauth/authorize`, actor });
    // The secret stays in the saved data, not in what the tab remembers.
    expect(JSON.stringify(first)).not.toContain("secret");
    expect(store.readStore().clients[HOME].client_secret).toBe("secret");
  });

  it("falls back to the standard addresses without metadata", async () => {
    vi.stubGlobal("fetch", fakeFetch({ [`POST ${HOME}/api/v1/apps`]: registered }));
    const { endpoints } = await signin.prepare(found);
    expect(endpoints.authorize).toBe(`${HOME}/oauth/authorize`);
    expect(endpoints.token).toBe(`${HOME}/oauth/token`);
  });

  it("falls back to broad scopes when registration rejects the granular ones", async () => {
    const fetch = fakeFetch({
      [`POST ${HOME}/api/v1/apps`]: (call) =>
        call.body.scopes === signin.BROAD_SCOPE ? registered : reply(422, { error: "scopes" }),
    });
    vi.stubGlobal("fetch", fetch);
    const { client } = await signin.prepare(found);
    expect(client.scope).toBe(signin.BROAD_SCOPE);
    expect(
      fetch.calls.filter((call) => call.method === "POST").map((call) => call.body.scopes),
    ).toEqual([signin.GRANULAR_SCOPE, signin.BROAD_SCOPE]);
  });

  it("fails clearly when registration fails", async () => {
    vi.stubGlobal("fetch", fakeFetch({ [`POST ${HOME}/api/v1/apps`]: reply(500, {}) }));
    await expect(signin.prepare(found)).rejects.toThrow("Your server didn’t accept FediTap.");
  });

  it("refuses an issuer or endpoints from another site", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        [`GET ${HOME}/.well-known/oauth-authorization-server`]: metadata({
          issuer: "https://evil.example",
        }),
      }),
    );
    await expect(signin.prepare(found)).rejects.toThrow(
      "The OAuth issuer isn’t your account’s address.",
    );
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        [`GET ${HOME}/.well-known/oauth-authorization-server`]: metadata({
          token_endpoint: "https://evil.example/token",
        }),
      }),
    );
    await expect(signin.prepare(found)).rejects.toThrow(
      "The sign-in addresses are on a different site.",
    );
  });
});

function pending(scope = signin.GRANULAR_SCOPE) {
  return {
    endpoints: { ...found, actor, client_id: "cid", scope, webfinger: found.webfinger.href },
    origin: HOME,
    profile: found.profile,
    tokenEndpoint: new URL(`${HOME}/oauth/token`),
    code: "code1",
    code_verifier: "verifier",
  };
}

function signedIn(token, who = { uri: actor, username: "me" }) {
  return fakeFetch({
    [`POST ${HOME}/oauth/token`]: token,
    [`GET ${HOME}/api/v1/accounts/verify_credentials`]: who,
  });
}

function register() {
  data.set(
    store.STORE_KEY,
    JSON.stringify({
      accounts: {},
      clients: {
        [HOME]: { ...registered, redirect_uri: PAGE, scope: signin.GRANULAR_SCOPE },
      },
    }),
  );
}

describe("complete", () => {
  it("exchanges the code with the app's secret and returns a never-expiring account", async () => {
    register();
    const fetch = signedIn({
      access_token: "tok",
      token_type: "Bearer",
      scope: signin.GRANULAR_SCOPE,
    });
    vi.stubGlobal("fetch", fetch);
    const account = await signin.complete(pending());
    expect(account).toEqual({
      type: "mastodon",
      handle: "me@home.example",
      actor,
      api: HOME,
      token: "tok",
      token_endpoint: `${HOME}/oauth/token`,
      client_id: "cid",
    });
    expect(fetch.calls[0].body).toMatchObject({
      grant_type: "authorization_code",
      client_id: "cid",
      client_secret: "secret",
      code: "code1",
      code_verifier: "verifier",
      redirect_uri: PAGE,
    });
    expect(fetch.calls[1].headers.Authorization).toBe("Bearer tok");
  });

  it("keeps a refresh token and expiry when the server sends them", async () => {
    register();
    vi.stubGlobal(
      "fetch",
      signedIn({
        access_token: "tok",
        refresh_token: "ref",
        expires_in: 3600,
        scope: "read write follow",
      }),
    );
    const account = await signin.complete(pending(signin.BROAD_SCOPE));
    expect(account).toMatchObject({ token: "tok", refresh_token: "ref" });
    expect(account.expires).toBeGreaterThan(Date.now() / 1000);
  });

  it("accepts a broad grant for granular scopes", async () => {
    register();
    vi.stubGlobal("fetch", signedIn({ access_token: "tok", scope: "read write follow" }));
    await expect(signin.complete(pending())).resolves.toMatchObject({ token: "tok" });
  });

  it("refuses a narrower grant than was asked for", async () => {
    register();
    vi.stubGlobal("fetch", signedIn({ access_token: "tok", scope: "read:accounts read:search" }));
    await expect(signin.complete(pending())).rejects.toMatchObject({
      message: "Your server allowed less than FediTap asked.",
      detail: expect.stringContaining("write:statuses"),
    });
  });

  it("refuses a sign-in as a different account", async () => {
    register();
    vi.stubGlobal(
      "fetch",
      signedIn({ access_token: "tok" }, { uri: `${HOME}/users/other`, username: "other" }),
    );
    await expect(signin.complete(pending())).rejects.toThrow(
      "Your server signed you in as a different account.",
    );
  });

  it("refuses when the app isn't registered here", async () => {
    vi.stubGlobal("fetch", signedIn({ access_token: "tok" }));
    await expect(signin.complete(pending())).rejects.toThrow("FediTap isn’t registered");
  });

  it("refuses a response with no token", async () => {
    register();
    vi.stubGlobal("fetch", signedIn({ token_type: "Bearer" }));
    await expect(signin.complete(pending())).rejects.toThrow("Your server sent no access token.");
  });
});
