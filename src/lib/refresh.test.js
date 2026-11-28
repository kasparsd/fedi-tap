import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The store names its record after the page address, as soon as it is imported.
vi.hoisted(() => vi.stubGlobal("location", new URL("https://app.example/")));

const { backendFor } = await import("./backend.js");
const { isStale, REFRESH_VERSION, refreshProfile, stamp } = await import("./refresh.js");
const { STORE_KEY } = await import("./store.js");

const ORIGIN = "https://home.example";
const ACTOR = `${ORIGIN}/users/me`;
const SUBSCRIBE = "http://ostatus.org/schema/1.0/subscribe";
const LINKS = [{ rel: SUBSCRIBE, template: `${ORIGIN}/open?uri={uri}` }];

const activitypub = {
  type: "activitypub",
  handle: "me@home.example",
  actor: ACTOR,
  token: "test-token",
  token_endpoint: `${ORIGIN}/token`,
  proxy: `${ORIGIN}/proxy`,
  outbox: `${ORIGIN}/outbox`,
  colour: 3,
};
const mastodon = {
  type: "mastodon",
  handle: "me@home.example",
  actor: ACTOR,
  token: "test-token",
  token_endpoint: `${ORIGIN}/oauth/token`,
  api: ORIGIN,
};

let saved;
const account = () => JSON.parse(saved).accounts[ACTOR];
const save = (value) => {
  saved = JSON.stringify({ accounts: value ? { [ACTOR]: value } : {}, clients: {} });
};

/** Answers by path; a number is an error status. */
function serve(answers) {
  const fetch = vi.fn(async (url) => {
    const { pathname } = new URL(url);
    const answer = answers[pathname] ?? 404;
    const response =
      typeof answer === "number"
        ? new Response("{}", { status: answer })
        : new Response(JSON.stringify(answer));
    Object.defineProperty(response, "url", { value: String(url) });
    return response;
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const actor = (icon) => ({ id: ACTOR, type: "Person", ...(icon && { icon: { url: icon } }) });
const webfinger = (links = LINKS) => ({ "/.well-known/webfinger": { links } });
const PHOTO = `${ORIGIN}/photo.png`;

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (key) => (key === STORE_KEY ? saved : null),
    setItem: (_, value) => {
      saved = value;
    },
  });
  vi.stubGlobal("navigator", { locks: { request: async (_, task) => task() } });
});

afterEach(() => vi.unstubAllGlobals());

describe("isStale", () => {
  const now = 1_000_000_000;
  const at = (age, version = REFRESH_VERSION) => ({ refreshed: { at: now - age, version } });

  it("is due when never refreshed, a day old, from another version or ahead of the clock", () => {
    expect(isStale({}, now)).toBe(true);
    expect(isStale(at(24 * 3600 * 1000), now)).toBe(true);
    expect(isStale(at(0, REFRESH_VERSION - 1), now)).toBe(true);
    expect(isStale(at(-1000), now)).toBe(true);
  });

  it("is not due within a day", () => {
    expect(isStale(at(23 * 3600 * 1000), now)).toBe(false);
    expect(isStale({ refreshed: stamp() })).toBe(false);
  });
});

describe("refreshProfile", () => {
  it("fills in the photo and links, keeping the rest of the account", async () => {
    save(activitypub);
    serve({ "/users/me": actor(PHOTO), ...webfinger() });
    expect(await refreshProfile(ACTOR, backendFor)).toBe(true);
    expect(account()).toMatchObject({ ...activitypub, avatar: PHOTO });
    expect(account().intents.open.rel).toBe(SUBSCRIBE);
    expect(isStale(account())).toBe(false);
  });

  it("reads a Mastodon photo with the saved token", async () => {
    save(mastodon);
    const fetch = serve({
      "/api/v1/accounts/verify_credentials": { uri: ACTOR, avatar_static: PHOTO },
      ...webfinger(),
    });
    await refreshProfile(ACTOR, backendFor);
    expect(account().avatar).toBe(PHOTO);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer test-token");
  });

  it("clears what the server no longer has", async () => {
    save({ ...activitypub, avatar: PHOTO, intents: { open: { rel: SUBSCRIBE, template: "x" } } });
    serve({ "/users/me": actor(), ...webfinger([]) });
    await refreshProfile(ACTOR, backendFor);
    expect(account()).not.toHaveProperty("avatar");
    expect(account()).not.toHaveProperty("intents");
  });

  it("keeps saved values when a read fails, and stays due", async () => {
    const before = { ...activitypub, avatar: PHOTO, intents: { open: {} } };
    save(before);
    serve({ "/users/me": 500, "/.well-known/webfinger": 500 });
    expect(await refreshProfile(ACTOR, backendFor)).toBe(false);
    expect(account()).toEqual(before);

    serve({ "/users/me": actor(`${ORIGIN}/new.png`) });
    await refreshProfile(ACTOR, backendFor);
    expect(account()).toEqual({ ...before, avatar: `${ORIGIN}/new.png` });
    expect(isStale(account())).toBe(true);
  });

  it("refuses another account's profile", async () => {
    save(activitypub);
    serve({ "/users/me": { ...actor(PHOTO), id: `${ORIGIN}/users/other` }, ...webfinger([]) });
    await refreshProfile(ACTOR, backendFor);
    save({ ...mastodon });
    serve({
      "/api/v1/accounts/verify_credentials": { uri: `${ORIGIN}/users/other`, avatar_static: PHOTO },
      ...webfinger([]),
    });
    await refreshProfile(ACTOR, backendFor);
    expect(account()).not.toHaveProperty("avatar");
  });

  it("keeps the sign-in when the server refuses the token", async () => {
    save(mastodon);
    serve({ "/api/v1/accounts/verify_credentials": 401, ...webfinger([]) });
    await refreshProfile(ACTOR, backendFor);
    expect(account()).toEqual(mastodon);
  });

  it("doesn't bring back an account removed meanwhile", async () => {
    save(activitypub);
    serve({ "/users/me": actor(PHOTO), ...webfinger() });
    const running = refreshProfile(ACTOR, backendFor);
    save(null);
    expect(await running).toBe(false);
    expect(account()).toBeUndefined();
  });

  it("drops its answer when the account signed in again meanwhile", async () => {
    save(activitypub);
    serve({ "/users/me": actor(PHOTO), ...webfinger() });
    const running = refreshProfile(ACTOR, backendFor);
    const signedIn = { ...activitypub, refreshed: stamp() };
    save(signedIn);
    expect(await running).toBe(false);
    expect(account()).toEqual(signedIn);
  });
});
