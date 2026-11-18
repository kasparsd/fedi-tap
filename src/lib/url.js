/** A parsed URL only when it is plain HTTPS without credentials. */
export function httpsUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

/** An HTTPS URL that lives on the account's own origin and has no fragment. */
export function homeEndpoint(value, origin) {
  const url = httpsUrl(value);
  return url && url.origin === origin && !url.hash ? url : null;
}

/** `@user@host` (or `acct:user@host`) to its handle and HTTPS origin. */
export function parseHandle(value) {
  if (typeof value !== "string") return null;
  const match = /^(?:acct:)?@?([^@\s/?#]+)@([^@\s/?#:\\]+)$/u.exec(value);
  if (!match) return null;
  const domain = httpsUrl(`https://${match[2]}`);
  if (!domain) return null;
  return { handle: `${match[1]}@${domain.hostname}`, origin: domain.origin };
}
