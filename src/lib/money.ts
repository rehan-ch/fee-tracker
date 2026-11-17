/** Amounts are whole rupees stored as integers. */

export function formatAmount(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(Math.round(n)));
  // 1234567 -> 1,234,567
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped;
}

export function formatMoney(n: number, currency = 'PKR'): string {
  const symbol = currency === 'PKR' ? 'Rs' : currency;
  return `${symbol} ${formatAmount(n)}`;
}

/**
 * Parse user input like "1,500" or " 2000 " into a whole number.
 * Returns null for empty, negative, fractional or non-numeric input.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}
