/**
 * Pure monthly-dues logic (no database access), so it can be unit tested.
 *
 * Model (from the feature plan):
 * - Each customer gets one monthly_dues row per month.
 * - carried_forward = previous month's (total_due - paid_amount).
 *   A positive value is an unpaid balance. A negative value is an advance
 *   (the customer overpaid), which reduces the next month's due instead of
 *   being lost.
 * - total_due = fee_amount + carried_forward
 * - status compares total_due with paid_amount.
 */
import { addMonths, monthRange, type MonthKey } from './date';

export type DueStatus = 'unpaid' | 'partial' | 'paid';

export interface ChainDue {
  id: string;
  month: MonthKey;
  fee_amount: number;
  carried_forward: number;
  total_due: number;
  paid_amount: number;
  status: DueStatus;
}

export function statusFor(totalDue: number, paid: number): DueStatus {
  if (paid >= totalDue) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

/** What is still owed on this due (never negative). */
export function remainingOf(d: Pick<ChainDue, 'total_due' | 'paid_amount'>): number {
  return Math.max(0, d.total_due - d.paid_amount);
}

/** Advance paid beyond this due (never negative). */
export function creditOf(d: Pick<ChainDue, 'total_due' | 'paid_amount'>): number {
  return Math.max(0, d.paid_amount - d.total_due);
}

/**
 * Recompute carried_forward, total_due and status for one customer's dues.
 * `dues` must be that customer's live dues sorted by month ascending.
 * Returns only the rows whose values changed.
 */
export function recalcChain<T extends ChainDue>(dues: T[]): T[] {
  const changed: T[] = [];
  let prevBalance = 0;
  dues.forEach((d, i) => {
    const carried = i === 0 ? 0 : prevBalance;
    const total = d.fee_amount + carried;
    const status = statusFor(total, d.paid_amount);
    if (carried !== d.carried_forward || total !== d.total_due || status !== d.status) {
      changed.push({ ...d, carried_forward: carried, total_due: total, status });
    }
    prevBalance = total - d.paid_amount;
  });
  return changed;
}

/**
 * Months that need a new due row for an active customer.
 * Starts after the last existing due (or at the start month if there are
 * none) and runs up to and including the current month.
 */
export function monthsToGenerate(
  startMonth: MonthKey,
  lastDueMonth: MonthKey | null,
  currentMonth: MonthKey,
): MonthKey[] {
  const next = lastDueMonth ? addMonths(lastDueMonth, 1) : startMonth;
  const from = next > startMonth ? next : startMonth;
  return monthRange(from, currentMonth);
}

/** The fee that applies in `month`, given fee history (sorted any way). */
export function feeForMonth(
  month: MonthKey,
  currentFee: number,
  changes: { effective_month: MonthKey; old_fee: number; new_fee: number }[],
): number {
  // Fee changes after `month` tell us what the fee was before them.
  const later = changes
    .filter((c) => c.effective_month > month)
    .sort((a, b) => (a.effective_month < b.effective_month ? -1 : 1));
  if (later.length > 0) return later[0].old_fee;
  return currentFee;
}

export interface FeeStep {
  effective_month: MonthKey;
  old_fee: number;
  new_fee: number;
}

/**
 * Rebuild a customer's fee history after adding, replacing or removing a
 * change. `base` is the fee before any change; `targets` maps an effective
 * month to the fee from that month on. Steps that don't change the fee are
 * dropped, and each step's old_fee is the fee just before it, so the history
 * always reads as a consistent chain. Returns the steps (sorted) and the
 * latest fee, which is what customers.monthly_fee stores.
 */
export function rebuildFeeSteps(
  base: number,
  targets: Map<MonthKey, number>,
): { steps: FeeStep[]; latestFee: number } {
  const months = [...targets.keys()].sort();
  const steps: FeeStep[] = [];
  let prev = base;
  for (const m of months) {
    const fee = targets.get(m)!;
    if (fee === prev) continue;
    steps.push({ effective_month: m, old_fee: prev, new_fee: fee });
    prev = fee;
  }
  return { steps, latestFee: prev };
}

/** The fee before any change, from a customer's latest fee and history. */
export function baseFee(latestFee: number, changes: FeeStep[]): number {
  if (changes.length === 0) return latestFee;
  const first = [...changes].sort((a, b) => (a.effective_month < b.effective_month ? -1 : 1))[0];
  return first.old_fee;
}
