import { readJson } from "../http.js";
import { httpsUrl } from "../url.js";

/**
 * Asks whether a Mastodon-compatible API answers on this origin. Anything but a clear yes is a no:
 * the probe is small, time-limited and must stay on the same origin.
 */
export async function probeInstance(origin) {
  try {
    const response = await fetch(new URL("/api/v1/instance", origin), {
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || httpsUrl(response.url)?.origin !== origin) return null;
    const instance = await readJson(response, 500000);
    return typeof instance?.version === "string"
      ? { version: instance.version.slice(0, 100) }
      : null;
  } catch {
    return null;
  }
}
