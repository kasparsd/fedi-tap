// How the saved accounts are arranged and told apart: which one is current, the order of the others
// in the header, and each one's colour, initials and photo.

import { httpsUrl } from "./url.js";

/** The number of avatar fills in app.css (.c0 to .c7), handed out in order. */
export const COLOURS = 8;
/** Up to this many other accounts are circles in the header. Beyond it, two circles and "+N". */
const MOST_CIRCLES = 3;

/** The account in use: the selected one, else the first saved. */
export function currentId(store) {
  return Object.hasOwn(store.accounts, store.selectedActorId ?? "")
    ? store.selectedActorId
    : (Object.keys(store.accounts)[0] ?? null);
}

/** The other accounts in header order: as saved, then any the saved order doesn't know yet. */
export function otherIds(store) {
  const current = currentId(store);
  const saved = Array.isArray(store.others) ? store.others : [];
  const known = [...new Set([...saved, ...Object.keys(store.accounts)])];
  return known.filter((id) => id !== current && Object.hasOwn(store.accounts, id));
}

/** Which of the others are circles in the header, and which wait behind "+N". */
export function headerSplit(others) {
  const count = others.length > MOST_CIRCLES ? MOST_CIRCLES - 1 : others.length;
  return { shown: others.slice(0, count), hidden: others.slice(count) };
}

/**
 * Makes an account current. The previous one takes its place among the circles, so switching back is
 * the same spot. When the chosen one was behind "+N", the previous one takes the first circle and
 * that circle's account goes behind "+N".
 */
export function selectAccount(store, id) {
  const previous = currentId(store);
  const others = otherIds(store);
  const from = others.indexOf(id);
  if (previous !== id && from >= 0) {
    if (from < headerSplit(others).shown.length) {
      others[from] = previous;
    } else {
      [others[0], others[from]] = [previous, others[0]];
    }
  }
  store.others = others;
  store.selectedActorId = id;
}

/** The least-used colour among the saved accounts, the earliest one when several are. */
export function freeColour(accounts) {
  const used = Array(COLOURS).fill(0);
  for (const { colour } of Object.values(accounts)) {
    if (colour in used) used[colour] += 1;
  }
  return used.indexOf(Math.min(...used));
}

/** `user@host` to its two parts. */
export function handleParts(handle) {
  const at = handle.lastIndexOf("@");
  return { user: handle.slice(0, at), host: handle.slice(at + 1) };
}

const segmenter = new Intl.Segmenter();
/** The letters and digits of a text, as whole characters. */
const characters = (text) =>
  Array.from(segmenter.segment(text), (part) => part.segment).filter((part) =>
    /[\p{L}\p{N}]/u.test(part),
  );
// Uppercase only when it stays the same length ("ß" would become "SS").
const capital = (part) => (part.toUpperCase().length === part.length ? part.toUpperCase() : part);

/**
 * The letters for each handle's circle: the first letter of the username. Handles that would look
 * alike get a second one, from the host first and then from the username.
 */
export function initials(handles) {
  const options = handles.map((handle) => {
    const { user, host } = handleParts(handle);
    const [u1 = "?", u2 = ""] = characters(user);
    const [h1 = "", h2 = ""] = characters(host);
    const first = capital(u1);
    return [first, first + capital(h1), first + u2, first + capital(h2)];
  });
  const level = handles.map(() => 0);
  for (let step = 1; step < 4; step++) {
    const labels = options.map((option, index) => option[level[index]]);
    labels.forEach((label, index) => {
      if (labels.indexOf(label) !== labels.lastIndexOf(label)) level[index] = step;
    });
  }
  return options.map((option, index) => option[level[index]]);
}

/**
 * The HTTPS address of a profile image: a string, an ActivityStreams Image or Link, or a list of
 * those. Mastodon's "missing.png" placeholder counts as no photo.
 */
export function photoUrl(value) {
  const first = Array.isArray(value) ? value[0] : value;
  const link = first?.url ?? first?.href ?? first;
  const inner = Array.isArray(link) ? link[0] : link;
  const url = httpsUrl(inner?.href ?? inner);
  return url && !url.pathname.endsWith("/missing.png") ? url.href : undefined;
}
