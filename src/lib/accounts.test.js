import { describe, expect, it } from "vitest";
import {
  currentId,
  freeColour,
  handleParts,
  headerSplit,
  initials,
  otherIds,
  photoUrl,
  selectAccount,
} from "./accounts.js";

const storeOf = (ids, extra = {}) => ({
  accounts: Object.fromEntries(ids.map((id) => [id, {}])),
  selectedActorId: ids[0] ?? null,
  ...extra,
});

describe("current account and order", () => {
  it("falls back to the first account", () => {
    expect(currentId(storeOf(["a", "b"], { selectedActorId: "gone" }))).toBe("a");
    expect(currentId(storeOf([]))).toBe(null);
  });

  it("keeps the saved order, drops removed accounts and appends new ones", () => {
    const store = storeOf(["a", "b", "c", "d"], { others: ["c", "gone", "b"] });
    expect(otherIds(store)).toEqual(["c", "b", "d"]);
  });

  it("shows three others, or two when there are more", () => {
    expect(headerSplit(["b", "c", "d"])).toEqual({ shown: ["b", "c", "d"], hidden: [] });
    expect(headerSplit(["b", "c", "d", "e"])).toEqual({ shown: ["b", "c"], hidden: ["d", "e"] });
  });

  it("puts the previous account where the chosen circle was", () => {
    const store = storeOf(["a", "b", "c", "d"]);
    selectAccount(store, "c");
    expect(store.selectedActorId).toBe("c");
    expect(otherIds(store)).toEqual(["b", "a", "d"]);
    selectAccount(store, "a");
    expect(otherIds(store)).toEqual(["b", "c", "d"]);
  });

  it("brings the previous account forward when the chosen one was hidden", () => {
    const store = storeOf(["a", "b", "c", "d", "e"]);
    selectAccount(store, "e");
    expect(otherIds(store)).toEqual(["a", "c", "d", "b"]);
  });

  it("changes nothing when the current account is chosen again", () => {
    const store = storeOf(["a", "b"]);
    selectAccount(store, "a");
    expect(otherIds(store)).toEqual(["b"]);
  });
});

describe("freeColour", () => {
  it("hands out the least-used colour, the earliest first", () => {
    expect(freeColour({})).toBe(0);
    expect(freeColour({ a: { colour: 0 }, b: { colour: 2 } })).toBe(1);
    const all = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((colour) => [colour, { colour }]));
    expect(freeColour(all)).toBe(0);
  });
});

describe("initials", () => {
  it("is one letter when that tells accounts apart", () => {
    expect(initials(["anna@social.example", "blog@anna.example"])).toEqual(["A", "B"]);
  });

  it("adds a host letter, then more of the host or name, when accounts would look alike", () => {
    expect(initials(["anna@social.example", "anna@mastodon.example"])).toEqual(["AS", "AM"]);
    const same = initials(["anna@social.example", "anna@sample.example", "alex@social.example"]);
    expect(new Set(same).size).toBe(3);
  });

  it("takes whole characters, skips punctuation and doesn't lengthen on uppercase", () => {
    expect(initials(["_bot@a.example"])).toEqual(["B"]);
    expect(initials(["ßeta@a.example"])).toEqual(["ß"]);
    expect(initials(["क्षमा@a.example"])[0]).toBe(
      [...new Intl.Segmenter().segment("क्षमा")][0].segment,
    );
    expect(initials(["___@a.example"])).toEqual(["?"]);
  });
});

describe("handleParts", () => {
  it("splits at the last @", () => {
    expect(handleParts("anna@social.example")).toEqual({ user: "anna", host: "social.example" });
  });
});

describe("photoUrl", () => {
  const url = "https://media.example/a.png";

  it("reads a string, an image object, a link and a list", () => {
    expect(photoUrl(url)).toBe(url);
    expect(photoUrl({ type: "Image", url })).toBe(url);
    expect(photoUrl({ type: "Image", url: { type: "Link", href: url } })).toBe(url);
    expect(photoUrl([{ url: [url] }])).toBe(url);
  });

  it("ignores anything that isn't an HTTPS photo", () => {
    expect(photoUrl(undefined)).toBeUndefined();
    expect(photoUrl({ type: "Image" })).toBeUndefined();
    expect(photoUrl("http://media.example/a.png")).toBeUndefined();
    expect(photoUrl("data:image/png;base64,AAAA")).toBeUndefined();
    expect(photoUrl("https://home.example/avatars/original/missing.png")).toBeUndefined();
  });
});
