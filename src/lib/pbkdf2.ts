/**
 * PBKDF2-HMAC-SHA256 (RFC 8018) in plain JavaScript, used to store staff
 * PINs as slow, salted hashes. expo-crypto has SHA-256 but no PBKDF2, and a
 * native call per iteration would be far slower. Checked against Node's
 * crypto in src/lib/__tests__/pin.test.ts.
 */

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const IV = Uint32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/** One SHA-256 block: `out` = compress(`state`, w[0..15]). `w` is used as scratch (64 words). */
function compress(state: Uint32Array, w: Uint32Array, out: Uint32Array): void {
  for (let i = 16; i < 64; i++) {
    const x = w[i - 15];
    const y = w[i - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
  }
  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const t2 = (S0 + maj) | 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) | 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) | 0;
  }
  out[0] = state[0] + a;
  out[1] = state[1] + b;
  out[2] = state[2] + c;
  out[3] = state[3] + d;
  out[4] = state[4] + e;
  out[5] = state[5] + f;
  out[6] = state[6] + g;
  out[7] = state[7] + h;
}

/** Hash `data` after `prefixBytes` bytes already absorbed into `state` (a multiple of 64). */
function finish(state: Uint32Array, data: Uint8Array, prefixBytes: number): Uint32Array {
  const total = prefixBytes + data.length;
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const bits = total * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(padded.length - 4, bits >>> 0);
  const w = new Uint32Array(64);
  let h = Uint32Array.from(state);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    const next = new Uint32Array(8);
    compress(h, w, next);
    h = next;
  }
  return h;
}

function wordsToBytes(words: Uint32Array): Uint8Array {
  const out = new Uint8Array(words.length * 4);
  const view = new DataView(out.buffer);
  words.forEach((v, i) => view.setUint32(i * 4, v));
  return out;
}

export function sha256(data: Uint8Array): Uint8Array {
  return wordsToBytes(finish(IV, data, 0));
}

/** UTF-8 bytes of a string (no TextEncoder needed). */
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function fromHex(hex: string): Uint8Array | null {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** PBKDF2-HMAC-SHA256 with a 32-byte result (one block). */
export function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('iterations');
  // HMAC key block: keys longer than a block are hashed first.
  const key = new Uint8Array(64);
  key.set(password.length > 64 ? sha256(password) : password);
  const w = new Uint32Array(64);
  const keyView = new DataView(key.buffer);
  const inner = new Uint32Array(8);
  const outer = new Uint32Array(8);
  for (let i = 0; i < 16; i++) w[i] = keyView.getUint32(i * 4) ^ 0x36363636;
  compress(IV, w, inner);
  for (let i = 0; i < 16; i++) w[i] = keyView.getUint32(i * 4) ^ 0x5c5c5c5c;
  compress(IV, w, outer);

  // U1 = HMAC(password, salt || INT(1))
  const first = new Uint8Array(salt.length + 4);
  first.set(salt);
  first[salt.length + 3] = 1;
  const u = new Uint32Array(8);
  const t = new Uint32Array(8);
  u.set(finish(inner, first, 64));
  u.set(finish(outer, wordsToBytes(u), 64));
  const result = Uint32Array.from(u);

  // Later rounds hash exactly 32 bytes after a 64-byte key block: one padded block each.
  for (let n = 1; n < iterations; n++) {
    w.set(u);
    w[8] = 0x80000000;
    w.fill(0, 9, 15);
    w[15] = (64 + 32) * 8;
    compress(inner, w, t);
    w.set(t);
    w[8] = 0x80000000;
    w.fill(0, 9, 15);
    w[15] = (64 + 32) * 8;
    compress(outer, w, u);
    for (let i = 0; i < 8; i++) result[i] ^= u[i];
  }
  return wordsToBytes(result);
}
