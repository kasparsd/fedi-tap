// A stand-in for `fetch` in unit tests: routes are "METHOD https://host/path" (no query) mapped to
// a body, a Response or a function of the call. Every call is recorded in `fetch.calls`.

export function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function fakeFetch(routes) {
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(input instanceof URL ? input.href : input);
    const call = {
      method: init.method ?? "GET",
      url,
      headers: init.headers ?? {},
      body: init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : init.body,
    };
    calls.push(call);
    const route = routes[`${call.method} ${url.origin}${url.pathname}`];
    const out = typeof route === "function" ? await route(call) : route;
    const response =
      out instanceof Response ? out : reply(out === undefined ? 404 : 200, out ?? {});
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  };
  fetch.calls = calls;
  return fetch;
}
