import { MAX_HTML } from "./constants.js";

// Elements whose contents are never prose: dropped whole, so script and style code never shows up as text.
const NON_PROSE = "script,style,template,noscript,iframe,object,embed,svg,math,head,title";
// Control characters, and the invisible bidirectional and zero-width marks that make text read in a
// different order or hide inside it. Joiners (U+200C, U+200D) stay: emoji and several scripts need them.
const INVISIBLE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing control characters is the point
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/gu;

/**
 * Text cleaned for display and cut to at most `limit` characters (code points, so an emoji is never
 * split), ending in "…" when something was cut. Whitespace is collapsed, invisible and control
 * characters are removed, and the cut prefers a word boundary.
 */
export function cleanText(text, limit) {
  const clean = String(text ?? "")
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/[ \t\f\r\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/gu, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  const chars = Array.from(clean);
  if (chars.length <= limit) return clean;
  const room = Math.max(limit - 1, 0);
  const cut = chars.slice(0, room);
  // Back up to the last space when that costs under a fifth of the text.
  const space = cut.findLastIndex((char) => char === " " || char === "\n");
  const kept = space > room * 0.8 ? cut.slice(0, space) : cut;
  return `${kept.join("").trimEnd()}…`;
}

// Parses markup into an inert document. Document.parseHTML() needs no Trusted Types policy; where it is
// missing, DOMParser takes the markup through one policy that this module alone holds (the page's
// CSP lets that name be created once and lists no other), and whose result only ever goes into the
// inert document below, never into the page.
let policy;
function parseInert(markup) {
  if (typeof Document.parseHTML === "function") return Document.parseHTML(markup);
  if (globalThis.trustedTypes) {
    policy ??= trustedTypes.createPolicy("feditap-plain-text", { createHTML: (value) => value });
    return new DOMParser().parseFromString(policy.createHTML(markup), "text/html");
  }
  return new DOMParser().parseFromString(markup, "text/html");
}

/**
 * Server HTML as plain text, capped at `limit` characters. Remote markup only ever reaches the page
 * as text: it is parsed in an inert document (nothing runs or loads), every tag is dropped along
 * with the contents of script, style and similar elements, and the result is cleaned by `cleanText`.
 * The page shows it as a text node, never as HTML.
 */
export function plainText(html, limit) {
  if (typeof html !== "string") return "";
  const markup = html.slice(0, MAX_HTML).replace(/<\/p>|<br\s*\/?>/gi, "\n");
  const doc = parseInert(markup);
  for (const element of doc.querySelectorAll(NON_PROSE)) element.remove();
  return cleanText(doc.body.textContent, limit);
}

/** A date for display ("Nov 17, 2026"), or "" when the value isn't a date. */
export function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en", { dateStyle: "medium" });
}
