import { createHash, X509Certificate } from "node:crypto";
import { defineConfig } from "@playwright/test";
import { certificate } from "./tools/mock-server.js";

// End-to-end tests drive the real page in Chromium against the mock ActivityPub, Mastodon and OAuth
// server (tools/mock-server.js). Each project has its own server, because the mock's response delay
// decides what a test can see:
//
//   normal  400 ms per request: the loading states are visible
//   fast    no delay: quick responses must show nothing extra
//   slow    6.5 s per request: the slow notice and Cancel
//   built   the production build under its Content Security Policy
//
// The page needs HTTPS, so the servers use the development certificate (mkcert, or a self-signed
// one). Chromium trusts only that one certificate, by its public key, and checks everything else.
const BASE_PORT = Number(process.env.E2E_PORT ?? 8461);
const { cert } = certificate();
const spki = createHash("sha256")
  .update(new X509Certificate(cert).publicKey.export({ type: "spki", format: "der" }))
  .digest("base64");

const servers = {
  normal: { port: BASE_PORT, delay: 400, command: "npm run dev" },
  fast: { port: BASE_PORT + 1, delay: 0, command: "npm run dev" },
  slow: { port: BASE_PORT + 2, delay: 6500, command: "npm run dev" },
  built: { port: BASE_PORT + 3, delay: 0, command: "npm run build && npm run preview" },
};

export default defineConfig({
  testDir: "e2e",
  // The mock keeps its state (tokens, received activities) per server, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 30000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  outputDir: "test-results",
  use: {
    viewport: { width: 390, height: 800 },
    launchOptions: { args: [`--ignore-certificate-errors-spki-list=${spki}`] },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: Object.entries(servers).map(([name, { port }]) => ({
    name,
    testDir: `e2e/${name}`,
    use: { baseURL: `https://localhost:${port}` },
    ...(name === "slow" ? { timeout: 90000 } : {}),
  })),
  webServer: Object.values(servers).map(({ port, delay, command }) => ({
    command,
    url: `https://localhost:${port}/client.json`,
    env: { PORT: String(port), DELAY_MS: String(delay) },
    reuseExistingServer: !process.env.CI,
    ignoreHTTPSErrors: true,
    timeout: 120000,
  })),
});
