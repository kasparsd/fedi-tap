import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { certificate, mockServer, PORT } from "./tools/mock-server.js";

// The published page may only load its own script and stylesheet and talk to HTTPS servers. Added
// to the built page only: the dev server injects inline styles for hot reload.
const CSP = [
  "default-src 'none'",
  "img-src 'self'",
  "manifest-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src https:",
  "form-action https:",
  "base-uri 'none'",
  "object-src 'none'",
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
  preview: { port: PORT, strictPort: true, host: server.host, https: server.https },
  test: { include: ["src/**/*.test.js"] },
});
