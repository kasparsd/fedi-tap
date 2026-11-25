import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { certificate, mockServer, PORT } from "./tools/mock-server.js";

// The published page may only load its own script and stylesheet and talk to HTTPS servers. It submits
// no form (sign-in leaves through a script redirect). Added to the built page only: the dev server
// injects inline styles for hot reload.
const CSP = [
  "default-src 'none'",
  "img-src 'self'",
  "manifest-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src https:",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  // Nothing may reach an HTML sink as a plain string. Svelte makes its templates through its own
  // policy; text.js has one for the fallback that parses server HTML into an inert document.
  "require-trusted-types-for 'script'",
  "trusted-types svelte-trusted-html feditap-plain-text",
].join("; ");

function contentSecurityPolicy() {
  return {
    name: "feditap-csp",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
          injectTo: "head-prepend",
        },
      ],
    },
  };
}

const server = {
  port: PORT,
  strictPort: true,
  host: process.env.HOST ?? "localhost",
  https: certificate(),
  // The mock answers its own CORS (any origin), so the published page can use it (see PAGE in tools/mock-server.js).
  cors: false,
  watch: process.env.POLL ? { usePolling: true } : undefined,
};

export default defineConfig({
  // Relative URLs, so the page works under any path (GitHub Pages serves it at /fedi-tap/).
  base: "./",
  plugins: [svelte(), mockServer(), contentSecurityPolicy()],
  build: {
    // No data: URIs (img-src is 'self') and no inline polyfill.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  server,
  preview: { port: PORT, strictPort: true, host: server.host, https: server.https, cors: false },
  test: { include: ["src/**/*.test.js"] },
});
