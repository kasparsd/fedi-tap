import { describe, expect, it } from "vitest";
import { readJson } from "./http.js";

const respond = (body, headers = {}) => new Response(body, { headers });

describe("readJson", () => {
  it("parses a small body", async () => {
    expect(await readJson(respond('{"a":1}'))).toEqual({ a: 1 });
  });

  it("returns null for a body that is not JSON", async () => {
    expect(await readJson(respond("nope"))).toBeNull();
  });

  it("refuses a body over the limit, by header or by size", async () => {
    await expect(readJson(respond("{}", { "Content-Length": "999" }), 10)).rejects.toMatchObject({
      title: "Response too large",
    });
    await expect(
      readJson(respond(JSON.stringify({ a: "x".repeat(50) })), 10),
    ).rejects.toMatchObject({
      title: "Response too large",
    });
  });
});
