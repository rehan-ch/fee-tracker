/**
 * Checks on the cloud settings built into the app (see config.ts). Pure
 * functions, unit-tested.
 */

/** Base64url to text (ASCII is enough for a JWT payload). */
function base64UrlDecode(s: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const ch of s.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')) {
    const i = alphabet.indexOf(ch);
    if (i < 0) throw new Error('not base64');
    value = (value << 6) | i;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * True for Supabase keys that must never ship inside an app: secret keys and
 * the legacy service_role key bypass row-level security, so anyone who
 * unpacked the APK could read and change every business. Only the
 * publishable (anon) key belongs in the app.
 */
export function isSecretSupabaseKey(key: string): boolean {
  if (/^sb_secret_/i.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    return /"role"\s*:\s*"service_role"/.test(base64UrlDecode(parts[1]));
  } catch {
    return false;
  }
}

/** The server address must be https (plain http only for a local server while developing). */
export function isAllowedCloudUrl(url: string, dev: boolean): boolean {
  if (/^https:\/\/[^\s/?#@]+(\/[^\s]*)?$/i.test(url)) return true;
  return dev && /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?\/?$/i.test(url);
}
