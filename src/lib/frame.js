/**
 * True when another page has framed this one. Like, Repost and Follow are one tap with a stored token,
 * so a hidden frame could trick a tap into one. Static hosting can't send `frame-ancestors` (a meta
 * policy ignores it), so the page refuses to draw its controls inside a frame instead.
 */
export function framed() {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}
