/**
 * Axis helpers for the report charts (docs/DESIGN.md 8.3): a clean top value
 * whose half is also clean, and tick labels in full under 10,000 and compact
 * (Latin "K" / "M") above it.
 */
import { formatAmount } from '../../lib/money';

/** Multipliers (x10) whose value and half both read as round numbers. */
const STEPS = [10, 12, 15, 20, 30, 40, 50, 60, 80, 100];

/** Smallest "nice" even number at or above `v` (at least 10). */
export function niceMax(v: number): number {
  if (!(v > 10)) return 10;
  const p = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1);
  for (const s of STEPS) {
    const top = s * p;
    if (top >= v && top % 2 === 0) return top;
  }
  return 100 * p;
}

function trim(x: number): string {
  return String(Math.round(x * 10) / 10);
}

/** Tick label: "5,000" when the axis tops out at 10,000 or less, else "50K" / "1.2M". */
export function tickLabel(n: number, axisTop: number): string {
  if (axisTop <= 10000) return formatAmount(n);
  if (n >= 1e6) return `${trim(n / 1e6)}M`;
  if (n >= 1e3) return `${trim(n / 1e3)}K`;
  return formatAmount(n);
}
