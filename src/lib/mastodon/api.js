import { readJson } from "../http.js";
import { corsProblem, Problem, refused } from "../problem.js";
import { requestSignal } from "../signal.js";

async function send(account, path, { method = "GET", form, headers } = {}) {
  try {
    return await fetch(new URL(path, account.api), {
      method,
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      headers: { Authorization: `Bearer ${account.token}`, Accept: "application/json", ...headers },
      body: form ? new URLSearchParams(form) : undefined,
      // Reads (opening a link) can be cancelled; writes never are, as they may already have gone through.
      signal: method === "GET" ? requestSignal() : AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw corsProblem("Couldn’t reach your server.", error.message);
  }
}

/**
 * Calls the account's server with its bearer token. A 401 renews the token once (when `renew` is
 * given) and tries again; a second 401 means the server refuses this sign-in.
 */
export async function call(account, path, options, renew) {
  let response = await send(account, path, options);
  if (response.status === 401 && renew) {
    await renew();
    response = await send(account, path, options);
  }
  if (response.status === 401) throw refused();
  return response;
}

/** A Problem for a response that wasn't a success, with the server's own reason when it gave one. */
export async function rejected(response) {
  const body = await readJson(response, 20000).catch(() => null);
  const reason = typeof body?.error === "string" ? `: ${body.error.slice(0, 200)}` : "";
  return new Problem(null, "Your server rejected it.", {
    steps: "Try again in a moment.",
    detail: `HTTP ${response.status}${reason}`,
  });
}
