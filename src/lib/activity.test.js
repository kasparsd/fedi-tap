import { describe, expect, it } from "vitest";
import { activityKey, makeActivity, mentionOf, replyHtml } from "./activity.js";
import { AS_PROFILE, PUBLIC } from "./constants.js";

const author = "https://social.example/users/dana";
const post = {
  id: "https://social.example/notes/1",
  author,
  isActor: false,
  mention: "@dana@social.example",
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

  it("refuses an empty reply, a follow without a verified author and a like on a profile", () => {
    expect(() => makeActivity("reply", post, account, "")).toThrow("Write a reply first.");
    expect(() => makeActivity("follow", { ...post, author: null }, account)).toThrow();
    expect(() => makeActivity("like", { ...post, isActor: true }, account)).toThrow();
  });

  it("follows the verified author", () => {
    expect(makeActivity("follow", post, account)).toMatchObject({ type: "Follow", object: author });
  });
});

describe("activityKey", () => {
  it("keys a follow by the author and other actions by the post", () => {
    expect(activityKey("me", post, "follow")).toBe(`me ${author} follow`);
    expect(activityKey("me", post, "like")).toBe(`me ${post.id} like`);
  });
});
