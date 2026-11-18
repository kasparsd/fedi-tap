// Read-only requests (discovery, opening a link) can be cancelled by the person while they run.
// Sending an activity and requesting tokens never are: a request that already reached the server
// may have gone through, and a renewed token must always be saved.

const TIMEOUT = 20000;
let active = null;

/** Makes the signal the cancellable requests listen to, or null when nothing can be cancelled. */
export function setRequestSignal(signal) {
  active = signal;
}

/** A signal that ends after the timeout, or sooner when the running task is cancelled. */
export function requestSignal(timeout = TIMEOUT) {
  const expiry = AbortSignal.timeout(timeout);
  return active && AbortSignal.any ? AbortSignal.any([active, expiry]) : expiry;
}
