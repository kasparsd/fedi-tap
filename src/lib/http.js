import { MAX_RESPONSE } from "./constants.js";
import { tooLarge } from "./problem.js";
import { httpsUrl } from "./url.js";

/** Reads a JSON body without trusting its size: refuses anything over the limit before parsing. */
export async function readJson(response, limit = MAX_RESPONSE) {
  if (Number(response.headers.get("Content-Length")) > limit) throw tooLarge();
  let text = "";
  const reader = response.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        reader.cancel().catch(() => {});
        throw tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } else {
    text = await response.text();
    if (text.length > limit) throw tooLarge();
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** GET JSON from a server that must answer on the same origin, even after redirects. */
export async function getJson(url, accept = "application/json") {
  const response = await fetch(url, {
    headers: { Accept: accept },
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (httpsUrl(response.url)?.origin !== url.origin) {
    throw new Error("Discovery redirected to a different server.");
  }
  return response.json();
}
