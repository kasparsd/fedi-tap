import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findActor,
  findIntents,
  intentLink,
  isActorLink,
  oauthEndpoints,
  repostable,
  serverActions,
} from "./discovery.js";

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

describe("intents on the home server", () => {
  const ORIGIN = "https://home.example";
  const FEP = "https://w3id.org/fep/3b86/";
  const REPLY = `${ORIGIN}/api/interactions?uri={inReplyTo}&intent=create`;
  const FOLLOW = `${ORIGIN}/api/interactions?uri={object}&intent=follow`;
  const SUBSCRIBE = "http://ostatus.org/schema/1.0/subscribe";

  function serve(links, status = 200) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const response = new Response(JSON.stringify({ links }), { status });
        Object.defineProperty(response, "url", { value: String(url) });
        return response;
      }),
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it("asks the account's own server about the handle and keeps each advertised intent", async () => {
    serve([
      { rel: `${FEP}Create`, template: REPLY },
      { rel: `${FEP}Follow`, template: FOLLOW },
      { rel: `${FEP}Like`, template: `${ORIGIN}/like?uri={object}` },
      { rel: `${FEP}Announce`, template: `${ORIGIN}/boost?uri={object}` },
      { rel: `${FEP}Object`, template: `${ORIGIN}/open?uri={object}` },
    ]);
    const found = await findIntents("me@home.example", ORIGIN);
    expect(Object.keys(found)).toEqual(["reply", "like", "repost", "follow", "open"]);
    expect(found.reply).toEqual({ rel: `${FEP}Create`, template: REPLY });
    expect(String(fetch.mock.calls[0][0])).toBe(
      `${ORIGIN}/.well-known/webfinger?resource=acct%3Ame%40home.example`,
    );
  });

  it("uses the subscribe link to open an address when there is no Object link", async () => {
    serve([{ rel: SUBSCRIBE, template: `${ORIGIN}/interactions?uri={uri}` }]);
    const found = await findIntents("me@home.example", ORIGIN);
    expect(Object.keys(found)).toEqual(["open"]);
    expect(
      intentLink(
        { actor: `${ORIGIN}/users/me`, intents: found },
        "open",
        "https://remote.example/1",
      ),
    ).toBe(`${ORIGIN}/interactions?uri=https%3A%2F%2Fremote.example%2F1`);
  });

  it("prefers the Object link over the subscribe link", async () => {
    serve([
      { rel: SUBSCRIBE, template: `${ORIGIN}/old?uri={uri}` },
      { rel: `${FEP}Object`, template: `${ORIGIN}/new?uri={object}` },
    ]);
    expect((await findIntents("me@home.example", ORIGIN)).open.template).toBe(
      `${ORIGIN}/new?uri={object}`,
    );
  });

  it("finds nothing when the server has no usable template, or no answer", async () => {
    serve([{ rel: `${FEP}Create`, template: `${ORIGIN}/share?text={content}` }]);
    expect(await findIntents("me@home.example", ORIGIN)).toEqual({});
    serve([{ rel: `${FEP}Follow`, template: REPLY }]);
    expect(await findIntents("me@home.example", ORIGIN)).toEqual({});
  });

  it("says when the server couldn't be asked", async () => {
    serve([], 404);
    expect(await findIntents("me@home.example", ORIGIN)).toBeNull();
  });

  it("refuses templates on another site or with extra placeholders", async () => {
    for (const template of [
      "https://other.example/reply?uri={inReplyTo}",
      "http://home.example/reply?uri={inReplyTo}",
      `${ORIGIN}/reply?uri={inReplyTo}&text={content}`,
      `${ORIGIN}/reply?a={inReplyTo}&b={inReplyTo}`,
      `${ORIGIN}/reply#{inReplyTo}`,
    ]) {
      serve([{ rel: `${FEP}Create`, template }]);
      expect(await findIntents("me@home.example", ORIGIN)).toEqual({});
    }
  });

  it("builds the link with the address encoded", () => {
    const account = {
      actor: `${ORIGIN}/users/me`,
      intents: { reply: { rel: `${FEP}Create`, template: REPLY } },
    };
    expect(intentLink(account, "reply", "https://remote.example/@them/1?a=b&c=d")).toBe(
      `${ORIGIN}/api/interactions?uri=https%3A%2F%2Fremote.example%2F%40them%2F1%3Fa%3Db%26c%3Dd&intent=create`,
    );
  });

  it("builds no link without a sound template or address", () => {
    const actor = `${ORIGIN}/users/me`;
    const other = { rel: `${FEP}Create`, template: "https://other.example/?u={inReplyTo}" };
    expect(intentLink({ actor }, "reply", "https://remote.example/1")).toBeNull();
    expect(
      intentLink({ actor, intents: { reply: other } }, "reply", "https://remote.example/1"),
    ).toBeNull();
    expect(
      intentLink(
        { actor, intents: { reply: { rel: `${FEP}Create`, template: REPLY } } },
        "reply",
        "javascript:alert(1)",
      ),
    ).toBeNull();
    expect(
      intentLink(
        { actor, intents: { reply: { rel: `${FEP}Create`, template: REPLY } } },
        "like",
        "https://remote.example/1",
      ),
    ).toBeNull();
  });
});

describe("reposting", () => {
  const ORIGIN = "https://home.example";
  const FEP = "https://w3id.org/fep/3b86/";
  const account = {
    actor: `${ORIGIN}/users/me`,
    intents: {
      like: { rel: `${FEP}Like`, template: `${ORIGIN}/like?uri={object}` },
      repost: { rel: `${FEP}Announce`, template: `${ORIGIN}/boost?uri={object}` },
    },
  };
  const post = (visibility) => ({ id: "https://remote.example/1", visibility });

  it("is allowed only for a post everyone can see", () => {
    expect(repostable(post("public"))).toBe(true);
    expect(repostable(post("unlisted"))).toBe(true);
    expect(repostable(post("private"))).toBe(false);
    expect(repostable(post("direct"))).toBe(false);
    expect(repostable(post(null))).toBe(false);
    expect(repostable({ id: "https://remote.example/users/a", isActor: true })).toBe(false);
  });

  it("leaves the server's Repost link out for a post that can't be reposted", () => {
    const intents = (visibility) => serverActions(account, post(visibility)).map((a) => a.intent);
    expect(intents("public")).toEqual(["like", "repost"]);
    expect(intents("private")).toEqual(["like"]);
    expect(intents("direct")).toEqual(["like"]);
  });
});

describe("oauthEndpoints", () => {
  const ORIGIN = "https://home.example";
  const named = { authorize: `${ORIGIN}/ap/authorize`, token: `${ORIGIN}/ap/token` };
  const matching = {
    issuer: `${ORIGIN}/ap`,
    authorization_endpoint: named.authorize,
    token_endpoint: named.token,
    authorization_response_iss_parameter_supported: true,
  };
  const foreign = {
    issuer: "https://other.example",
    authorization_endpoint: `${ORIGIN}/mcp/authorize`,
    token_endpoint: `${ORIGIN}/mcp/token`,
    authorization_response_iss_parameter_supported: true,
  };

  function serve(metadata) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const response = new Response(JSON.stringify(metadata ?? {}), {
          status: metadata ? 200 : 404,
        });
        Object.defineProperty(response, "url", { value: String(url) });
        return response;
      }),
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it("takes the issuer from metadata that describes the actor's endpoints", async () => {
    serve(matching);
    const { endpoints } = await oauthEndpoints(ORIGIN, { named });
    expect(endpoints).toEqual({ ...named, issuer: matching.issuer, requireIssuer: true });
  });

  it("ignores metadata of another authorization server, issuer and all", async () => {
    for (const metadata of [foreign, { ...matching, token_endpoint: foreign.token_endpoint }]) {
      serve(metadata);
      expect(await oauthEndpoints(ORIGIN, { named })).toEqual({
        endpoints: { ...named, issuer: ORIGIN, requireIssuer: false },
        metadata: null,
      });
    }
  });

  it("uses the actor's endpoints without metadata", async () => {
    serve(null);
    const { endpoints } = await oauthEndpoints(ORIGIN, { named });
    expect(endpoints).toMatchObject(named);
  });

  it("uses metadata when the actor doesn't name both, else the fallback", async () => {
    serve(foreign);
    await expect(oauthEndpoints(ORIGIN, { named: {} })).rejects.toThrow();
    serve({ ...foreign, issuer: ORIGIN });
    const { endpoints } = await oauthEndpoints(ORIGIN, { fallback: named });
    expect(endpoints.token).toBe(foreign.token_endpoint);
    serve(null);
    expect((await oauthEndpoints(ORIGIN, { fallback: named })).endpoints).toMatchObject(named);
  });
});
