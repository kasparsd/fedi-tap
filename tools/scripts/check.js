// Static checks the linter cannot do: the page, its script and its stylesheet must agree.
// Run with `npm run check`. No dependencies.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const read = (file) => readFileSync(join(root, file), "utf8");
const html = read("index.html");
const js = read("app.js");
const css = read("style.css");
const errors = [];
const warnings = [];

// Ids the markup defines, and every place the code or styles refer to one.
const defined = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
const fromJs = [...js.matchAll(/\$\("([^"]+)"\)|getElementById\("([^"]+)"\)/g)].map(
  (match) => match[1] ?? match[2],
);
const fromCss = [...css.matchAll(/#([A-Za-z][\w-]*)/g)].map((match) => match[1]);
const fromMarkup = [
  ...[
    ...html.matchAll(
      /\s(?:for|aria-controls|aria-labelledby|aria-describedby|commandfor)="([^"]+)"/g,
    ),
  ].flatMap((match) => match[1].split(/\s+/)),
  ...[...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]),
];

for (const id of fromJs) {
  if (!defined.has(id)) errors.push(`app.js uses #${id}, which index.html does not define`);
}
for (const id of fromMarkup) {
  if (!defined.has(id)) errors.push(`index.html refers to #${id}, which it does not define`);
}
for (const id of new Set(fromCss)) {
  // Hex colours look like ids; only report names that are not valid colours.
  if (!defined.has(id) && !/^[0-9a-f]{3,8}$/i.test(id)) {
    warnings.push(`style.css selects #${id}, which index.html does not define`);
  }
}
// Ids can also be built at run time ("sheet-" + kind), so a quoted id or a "-suffix" counts as used.
const used = new Set([...fromJs, ...fromCss, ...fromMarkup]);
for (const id of defined) {
  const suffix = id.includes("-") ? id.slice(id.lastIndexOf("-")) : null;
  const dynamic = js.includes(`"${id}"`) || (suffix && js.includes(suffix));
  if (!used.has(id) && !dynamic) {
    warnings.push(`index.html defines #${id}, which nothing refers to`);
  }
}

// Content Security Policy: the script hash must match the file, and nothing inline may exist.
const hash = `sha256-${createHash("sha256")
  .update(readFileSync(join(root, "app.js")))
  .digest("base64")}`;
const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1] ?? "";
if (!csp.includes(`script-src '${hash}'`)) errors.push("CSP script hash does not match app.js");
if (!html.includes(`integrity="${hash}"`)) errors.push("script integrity does not match app.js");
if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(html)) errors.push("index.html has an inline script");
if (/\sstyle="/i.test(html) || /<style[\s>]/i.test(html))
  errors.push("index.html has inline styles");
if (/\son[a-z]+="/i.test(html)) errors.push("index.html has an inline event handler");
if (/\.style\b|setAttribute\(["']style["']/.test(js)) errors.push("app.js sets inline styles");

// Local files the page and manifest point at must exist.
const files = [...html.matchAll(/\s(?:href|src)="([^"#:]+)"/g)].map((match) => match[1]);
const manifest = JSON.parse(read("manifest.webmanifest"));
for (const icon of manifest.icons ?? []) files.push(icon.src);
for (const file of new Set(files)) {
  if (!existsSync(join(root, file))) errors.push(`missing file: ${file}`);
}

for (const message of warnings) console.warn(`warning: ${message}`);
for (const message of errors) console.error(`error: ${message}`);
if (errors.length) process.exit(1);
console.log(`check: ok (${defined.size} ids, ${warnings.length} warnings)`);
