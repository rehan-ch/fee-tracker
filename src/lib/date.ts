/**
 * Date helpers. Months are stored as "YYYY-MM" strings and days as "YYYY-MM-DD"
 * strings in the user's local time, so they sort correctly as text and never
 * shift because of timezones.
 */

export type MonthKey = string; // "YYYY-MM"
export type DayKey = string; // "YYYY-MM-DD"

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toMonthKey(d: Date): MonthKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function currentMonthKey(): MonthKey {
  return toMonthKey(new Date());
}

/** "2026-03-15" -> local Date at midnight. */
export function dayKeyToDate(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function monthOfDay(key: DayKey): MonthKey {
  return key.slice(0, 7);
}

export function isMonthKey(v: unknown): v is MonthKey {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function isDayKey(v: unknown): v is DayKey {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = dayKeyToDate(v);
  return toDayKey(d) === v;
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Inclusive list of months from `from` to `to`. Empty if from > to. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  let cur = from;
  // Guard against runaway loops on bad input (100 years is plenty).
  for (let i = 0; cur <= to && i < 1200; i++) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export function yearOf(key: MonthKey | DayKey): number {
  return Number(key.slice(0, 4));
}

export function monthIndex(key: MonthKey | DayKey): number {
  return Number(key.slice(5, 7)) - 1;
}

export function nowIso(): string {
  return new Date().toISOString();
}
