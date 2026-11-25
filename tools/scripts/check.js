// Static checks on the built page (dist/) and its sources that the linter cannot do: the strict
// Content Security Policy must hold, nothing may be inline, and every file the page names exists.
// Run with `npm run build && npm run check`. No dependencies.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const dist = join(root, "dist");
const errors = [];

if (!existsSync(join(dist, "index.html"))) {
  console.error("error: dist/index.html is missing. Run `npm run build` first.");
  process.exit(1);
}
const html = readFileSync(join(dist, "index.html"), "utf8");

// Content Security Policy: present, and with no way to run or style anything inline.
const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1] ?? "";
const policy = csp.replaceAll("&#39;", "'");
if (!policy) errors.push("dist/index.html has no Content Security Policy");
if (!/(^|;\s*)script-src 'self'(;|$)/.test(policy)) errors.push("CSP script-src is not 'self'");
if (!/(^|;\s*)style-src 'self'(;|$)/.test(policy)) errors.push("CSP style-src is not 'self'");
if (/unsafe-|data:|blob:/.test(policy)) errors.push("CSP allows inline code, data: or blob:");
if (!/(^|;\s*)form-action 'none'(;|$)/.test(policy)) errors.push("CSP form-action is not 'none'");
if (!/(^|;\s*)require-trusted-types-for 'script'(;|$)/.test(policy)) {
  errors.push("CSP does not require Trusted Types for scripts");
}
if (/trusted-types[^;]*(\*|'allow-duplicates')/.test(policy)) {
  errors.push("CSP trusted-types allows any policy name or duplicates");
}

// Nothing inline in the built page.
if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) errors.push("dist/index.html has an inline script");
if (/<style[\s>]/i.test(html) || /\sstyle="/i.test(html)) {
  errors.push("dist/index.html has inline styles");
}
if (/\son[a-z]+="/i.test(html)) errors.push("dist/index.html has an inline event handler");

// Local files the page and the manifest point at must exist.
const files = [...html.matchAll(/\s(?:href|src)="([^"#:]+)"/g)].map((match) => match[1]);
const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
for (const icon of manifest.icons ?? []) files.push(icon.src);
for (const file of new Set(files)) {
  if (!existsSync(join(dist, file))) errors.push(`missing file in dist: ${file}`);
}

// The OAuth client identity names the page it is published at.
const client = JSON.parse(readFileSync(join(dist, "client.json"), "utf8"));
if (client.client_id !== new URL("client.json", client.client_uri).href) {
  errors.push("client.json: client_id must be client.json under client_uri");
}
if (!client.redirect_uris?.includes(client.client_uri)) {
  errors.push("client.json: redirect_uris must include client_uri");
}

// Sources: remote text may only reach the page as text, and styles may only come from stylesheets.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
for (const file of walk(join(root, "src"))) {
  const source = readFileSync(file, "utf8");
  const name = relative(root, file);
  if (/\{@html\b/.test(source)) errors.push(`${name} uses {@html}`);
  if (file.endsWith(".svelte")) {
    const markup = source.replace(/<script[\s\S]*?<\/script>/g, "");
    if (/\sstyle[:=]/.test(markup)) errors.push(`${name} sets inline styles`);
  }
  if (/\.style\b|setAttribute\(["']style["']/.test(source)) {
    errors.push(`${name} sets inline styles`);
  }
}

for (const message of errors) console.error(`error: ${message}`);
if (errors.length) process.exit(1);
console.log("check: ok");
