/**
 * URL checks for the settings screens (docs/DESIGN.md 14.3). Only URLs that
 * pass these checks are handed to Linking.openURL. Pure functions (no React
 * Native imports) so they are unit-tested.
 */

/** Host name: labels of letters, digits and hyphens, with a dotted TLD. */
const HTTPS_URL =
  /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#][^\s]*)?$/i;

/** Conservative email address: no spaces, quotes, angle brackets or extra "@". */
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

// Control and bidi-override characters never belong in a link we open.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

/**
 * Returns the URL when it is an absolute `https:` link to a real host name
 * (no credentials, no whitespace or control characters); otherwise null.
 */
export function safeHttpsUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (url.length === 0 || url.length > 2048 || UNSAFE_CHARS.test(url)) return null;
  if (!HTTPS_URL.test(url)) return null;
  // "https://user:pass@host" style links can disguise the real host.
  const authority = url.slice('https://'.length).split(/[/?#]/)[0];
  if (authority.includes('@')) return null;
  return url;
}

/** True for a plain email address we are willing to put in a mailto: link. */
export function isSafeEmail(raw: string | null | undefined): boolean {
  return typeof raw === 'string' && raw.length <= 254 && EMAIL.test(raw);
}

/**
 * `mailto:` link for a validated address, with each part percent-encoded.
 * Returns null for anything that isn't a plain email address.
 */
export function mailtoUrl(raw: string | null | undefined): string | null {
  if (!isSafeEmail(raw)) return null;
  const email = raw as string;
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `mailto:${encodeURIComponent(local)}@${encodeURIComponent(domain)}`;
}
