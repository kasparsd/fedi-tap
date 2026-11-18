import { MAX_HTML } from "./constants.js";

/** Server HTML as plain text, capped. Remote markup only ever reaches the page as text. */
export function plainText(html, limit) {
  if (typeof html !== "string") return "";
  const markup = html.slice(0, MAX_HTML).replace(/<\/p>|<br\s*\/?>/gi, "\n");
  const text = new DOMParser().parseFromString(markup, "text/html").body.textContent;
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, limit);
}

/** A date for display ("Nov 17, 2026"), or "" when the value isn't a date. */
export function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en", { dateStyle: "medium" });
}
