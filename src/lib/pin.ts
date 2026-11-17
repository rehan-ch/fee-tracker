/**
 * Staff PINs are stored only on this phone, as PBKDF2-HMAC-SHA256 hashes with
 * a random salt per PIN: "pbkdf2-sha256$<iterations>$<salt hex>$<hash hex>".
 *
 * What this protects: nobody can read a PIN back from the database, two
 * equal PINs look different, and no precomputed table helps. What it can't
 * do: a 4-6 digit PIN has at most a million values, so someone holding a
 * copy of the app's data could still try them all; the in-app limit on wrong
 * tries (pinThrottle) is what protects a PIN on a shared phone. See
 * SECURITY.md.
 *
 * Earlier versions stored one salted SHA-256; those PINs still work and are
 * re-saved in the new form after the next correct entry.
 */
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';

import { fromHex, pbkdf2Sha256, toHex, utf8 } from './pbkdf2';

export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin);

const SCHEME = 'pbkdf2-sha256';
/** Iterations for new hashes: about a quarter to half a second on a mid-range phone. */
export const PIN_ITERATIONS = 4000;
const MAX_ITERATIONS = 1_000_000;

/** Let the screen show its "checking" state before the hash blocks the JS thread. */
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function derive(staffId: string, pin: string, salt: Uint8Array, iterations: number): string {
  return toHex(pbkdf2Sha256(utf8(`fee-tracker:${staffId}:${pin}`), salt, iterations));
}

/** Compare without stopping at the first difference. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Hash a new PIN for storage. */
export async function hashPin(staffId: string, pin: string, iterations = PIN_ITERATIONS): Promise<string> {
  if (!isValidPin(pin)) throw new Error('Invalid PIN');
  const salt = getRandomBytes(16);
  await yieldToUi();
  return `${SCHEME}$${iterations}$${toHex(salt)}$${derive(staffId, pin, salt, iterations)}`;
}

/** The hash format of version 1.0: one salted SHA-256, kept only to check old PINs. */
function legacyHash(staffId: string, pin: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `fee-tracker:${staffId}:${pin}`);
}

export interface PinCheck {
  ok: boolean;
  /** A new hash to save when the stored one uses the old format (only when ok). */
  rehash: string | null;
}

/** Check a PIN against the stored hash. Unknown or damaged hashes never match. */
export async function verifyPin(staffId: string, pin: string, stored: string): Promise<PinCheck> {
  if (!isValidPin(pin)) return { ok: false, rehash: null };
  if (stored.startsWith(`${SCHEME}$`)) {
    const [, iterText, saltHex, hashHex] = stored.split('$');
    const iterations = Number(iterText);
    const salt = fromHex(saltHex ?? '');
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS || !salt || !hashHex) {
      return { ok: false, rehash: null };
    }
    await yieldToUi();
    const ok = sameText(derive(staffId, pin, salt, iterations), hashHex.toLowerCase());
    return { ok, rehash: ok && iterations < PIN_ITERATIONS ? await hashPin(staffId, pin) : null };
  }
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    const ok = sameText(await legacyHash(staffId, pin), stored.toLowerCase());
    return { ok, rehash: ok ? await hashPin(staffId, pin) : null };
  }
  return { ok: false, rehash: null };
}
