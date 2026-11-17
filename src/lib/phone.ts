export function digitsOf(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

/** Accepts local or international formats such as 0300-1234567 or +92 300 1234567. */
export function isValidPhone(s: string): boolean {
  const trimmed = s.trim();
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return false;
  const n = digitsOf(trimmed).length;
  return n >= 7 && n <= 15;
}

/** Case-insensitive name match, or digits-only phone match. */
export function matchesSearch(query: string, name: string, phone: string | null): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (name.toLowerCase().includes(q)) return true;
  const qd = digitsOf(q);
  return qd.length > 0 && digitsOf(phone).includes(qd);
}

/**
 * International number without "+" for WhatsApp links (wa.me/<number>).
 * Local Pakistani numbers like 0300-1234567 become 923001234567; numbers
 * written with +, 00 or a country code are kept. Returns null if the result
 * can't be a real number.
 */
export function toInternational(phone: string | null | undefined, countryCode = '92'): string | null {
  const raw = (phone ?? '').trim();
  let d = digitsOf(raw);
  if (!d) return null;
  if (raw.startsWith('+')) {
    // already international
  } else if (d.startsWith('00')) {
    d = d.slice(2);
  } else if (d.startsWith('0')) {
    d = countryCode + d.slice(1);
  } else if (countryCode === '92' && d.length === 10 && d.startsWith('3')) {
    // 3001234567: a Pakistani mobile number without the leading 0
    d = countryCode + d;
  }
  return d.length >= 8 && d.length <= 15 ? d : null;
}
