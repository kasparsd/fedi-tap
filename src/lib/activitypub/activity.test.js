import { describe, expect, it } from "vitest";
import { AS_PROFILE, PUBLIC } from "../constants.js";
import { audienceOf, makeActivity, mentionOf, replyHtml } from "./activity.js";

const author = "https://social.example/users/dana";
const post = {
  id: "https://social.example/notes/1",
  author,
  isActor: false,
  mention: "@dana@social.example",
  visibility: "public",
};
const account = { followers: "https://home.example/users/me/followers" };

describe("replyHtml", () => {
  it("escapes markup and turns newlines into breaks and paragraphs", () => {
    expect(replyHtml("a <b>&\nc\n\nd")).toBe("<p>a &lt;b&gt;&amp;<br>c</p><p>d</p>");
  });

  it("puts the mention at the start of the first paragraph only", () => {
    expect(replyHtml("hi\n\nthere", "@dana@social.example")).toBe(
      "<p>@dana@social.example hi</p><p>there</p>",
    );
  });

  it("drops empty input", () => {
    expect(replyHtml(" \n\n ")).toBe("");
  });
});

describe("mentionOf", () => {
  it("keeps a handle that already starts with @", () => {
    expect(mentionOf("@dana@social.example", author)).toBe("@dana@social.example");
  });

  it("builds one from the author's address", () => {
    expect(mentionOf("social.example", "https://social.example/@dana")).toBe(
      "@dana@social.example",
    );
  });
});

describe("makeActivity", () => {
  it("likes a post, addressed to its author", () => {
    expect(makeActivity("like", post, account)).toEqual({
      "@context": AS_PROFILE,
      type: "Like",
      object: post.id,
      to: [author],
      cc: [PUBLIC],
    });
  });

  it("reposts to the public and the followers", () => {
    const activity = makeActivity("repost", post, account);
    expect(activity.type).toBe("Announce");
    expect(activity.to).toEqual([PUBLIC]);
    expect(activity.cc).toEqual([account.followers]);
  });

  it("replies publicly and mentions the author", () => {
    const activity = makeActivity("reply", post, account, "Hello");
    expect(activity.type).toBe("Create");
    expect(activity.object.inReplyTo).toBe(post.id);
    expect(activity.object.content).toBe("<p>@dana@social.example Hello</p>");
    expect(activity.object.tag).toEqual([
      { type: "Mention", href: author, name: "@dana@social.example" },
    ]);
  });

  it("keeps a reply no more visible than the post it answers", () => {
    const reply = (visibility) =>
      makeActivity("reply", { ...post, visibility }, account, "Hi").object;
    expect(reply("public")).toMatchObject({ to: [PUBLIC], cc: [author] });
    expect(reply("unlisted")).toMatchObject({ to: [account.followers], cc: [PUBLIC, author] });
    expect(reply("private")).toMatchObject({ to: [account.followers], cc: [author] });
    expect(reply("direct")).toMatchObject({ to: [author], cc: [] });
    for (const unknown of [null, undefined]) {
      expect(() =>
        makeActivity("reply", { ...post, visibility: unknown }, account, "Hi"),
      ).toThrow();
    }
    expect(() =>
      makeActivity("reply", { ...post, visibility: "direct", author: null }, account, "Hi"),
    ).toThrow();
    expect(() => makeActivity("reply", { ...post, visibility: "private" }, {}, "Hi")).toThrow();
  });

  it("refuses an empty reply, a follow without a verified author and a like on a profile", () => {
    expect(() => makeActivity("reply", post, account, "")).toThrow("Write a reply first.");
    expect(() => makeActivity("follow", { ...post, author: null }, account)).toThrow();
    expect(() => makeActivity("like", { ...post, isActor: true }, account)).toThrow();
  });

  it("follows the verified author", () => {
    expect(makeActivity("follow", post, account)).toMatchObject({ type: "Follow", object: author });
  });
});

describe("audienceOf", () => {
  const followers = "https://social.example/users/dana/followers";
  it("reads the audience from to and cc", () => {
    expect(audienceOf({ to: [PUBLIC], cc: [followers] }, followers)).toBe("public");
    expect(audienceOf({ to: "as:Public" }, followers)).toBe("public");
    expect(audienceOf({ to: [followers], cc: [PUBLIC] }, followers)).toBe("unlisted");
    expect(audienceOf({ to: [followers] }, followers)).toBe("private");
    expect(audienceOf({ to: [author], cc: [] }, followers)).toBe("direct");
    expect(audienceOf({ to: [followers] }, undefined)).toBe("direct");
  });

  it("is unknown when the post names no recipients", () => {
    expect(audienceOf({}, followers)).toBeNull();
    expect(audienceOf({ to: [], cc: [] }, followers)).toBeNull();
  });
});
