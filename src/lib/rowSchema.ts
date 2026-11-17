/**
 * Checks for rows that come from outside this phone: a restored backup file
 * or rows downloaded by cloud sync. Each synced table lists its columns and
 * what they may hold. A row passes only if its id is safe and every known
 * column has the right type, size and format; unknown columns are dropped.
 *
 * The same limits are enforced on the server (supabase/migrations), so a
 * row the server accepted also passes here. Pure functions (no React
 * Native imports) so they are unit-tested.
 */
import type { SyncTable } from '../db/schema';
import { isDayKey, isMonthKey } from './date';

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

/** Longest text value accepted (the app's own fields allow at most 700 characters). */
export const MAX_TEXT = 4000;
/** Largest amount accepted: far above any real fee, well inside exact integer range. */
export const MAX_AMOUNT = 1_000_000_000_000;

/**
 * Row ids: letters, digits, ":", "_" and "-". Ids are used in screen routes
 * (e.g. /customer/<id>), so "/", "?" or "#" could otherwise open a different screen.
 */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/;
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

export const isSafeId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);
export const isIsoTimestamp = (v: unknown): v is string => typeof v === 'string' && TS_RE.test(v);

/** Years outside this range are typing mistakes or crafted data (each month adds a due). */
const yearOk = (v: string) => {
  const y = Number(v.slice(0, 4));
  return y >= 1970 && y <= 2199;
};

type Spec =
  | { kind: 'id'; nullable?: boolean }
  | { kind: 'text'; nullable?: boolean; max?: number; values?: readonly string[] }
  | { kind: 'int'; min?: number }
  | { kind: 'ts'; nullable?: boolean }
  | { kind: 'day' }
  | { kind: 'month' };

const id: Spec = { kind: 'id' };
const optId: Spec = { kind: 'id', nullable: true };
const text: Spec = { kind: 'text' };
const optText: Spec = { kind: 'text', nullable: true };
const amount: Spec = { kind: 'int', min: 0 };
const signed: Spec = { kind: 'int' };
const oneOf = (...values: string[]): Spec => ({ kind: 'text', values });
const stamps = {
  created_at: { kind: 'ts' },
  updated_at: { kind: 'ts' },
  deleted_at: { kind: 'ts', nullable: true },
} as const satisfies Record<string, Spec>;

const SCHEMA: Record<SyncTable, Record<string, Spec>> = {
  businesses: {
    id,
    name: text,
    phone: optText,
    currency: { kind: 'text', max: 8 },
    language: oneOf('en', 'ur'),
    reminder_template: optText,
    payment_info: optText,
    payment_link: optText,
    ...stamps,
  },
  areas: { id, business_id: id, name: text, ...stamps },
  staff: {
    id,
    business_id: id,
    name: text,
    phone: optText,
    role: oneOf('owner', 'manager', 'collector'),
    user_id: { kind: 'text', nullable: true, max: 100 },
    invite_code: { kind: 'text', nullable: true, max: 32 },
    ...stamps,
  },
  customers: {
    id,
    business_id: id,
    area_id: optId,
    name: text,
    phone: optText,
    address: optText,
    monthly_fee: amount,
    start_date: { kind: 'day' },
    status: oneOf('active', 'inactive'),
    notes: optText,
    ...stamps,
  },
  monthly_dues: {
    id,
    // Version-1 backups have no business_id yet (filled in after restore).
    business_id: optId,
    customer_id: id,
    month: { kind: 'month' },
    fee_amount: amount,
    carried_forward: signed,
    total_due: signed,
    paid_amount: amount,
    status: oneOf('unpaid', 'partial', 'paid'),
    ...stamps,
  },
  payments: {
    id,
    business_id: optId,
    monthly_due_id: id,
    customer_id: id,
    amount,
    paid_on: { kind: 'day' },
    method: oneOf('cash', 'jazzcash', 'easypaisa', 'bank'),
    received_by: optId,
    note: optText,
    ...stamps,
  },
  fee_changes: {
    id,
    business_id: optId,
    customer_id: id,
    old_fee: amount,
    new_fee: amount,
    effective_month: { kind: 'month' },
    note: optText,
    ...stamps,
  },
  reminders_log: {
    id,
    business_id: id,
    customer_id: id,
    monthly_due_id: optId,
    channel: oneOf('whatsapp', 'sms'),
    sent_at: { kind: 'ts' },
    sent_by: optId,
    ...stamps,
  },
};

function cellOk(spec: Spec, v: unknown): boolean {
  if (v === null) return 'nullable' in spec && spec.nullable === true;
  switch (spec.kind) {
    case 'id':
      return isSafeId(v);
    case 'text':
      return (
        typeof v === 'string' &&
        v.length <= (spec.max ?? MAX_TEXT) &&
        (!spec.values || spec.values.includes(v))
      );
    case 'int':
      return typeof v === 'number' && Number.isSafeInteger(v) && Math.abs(v) <= MAX_AMOUNT && v >= (spec.min ?? -MAX_AMOUNT);
    case 'ts':
      return isIsoTimestamp(v);
    case 'day':
      return isDayKey(v) && yearOk(v);
    case 'month':
      return isMonthKey(v) && yearOk(v);
  }
}

/** Columns this app knows for a table. */
export function knownColumns(table: SyncTable): string[] {
  return Object.keys(SCHEMA[table]);
}

/**
 * The row with only known columns, or null when the id or any known value is
 * invalid. Missing columns are left out (the database default or NOT NULL
 * rule then applies).
 */
export function cleanRow(table: SyncTable, row: unknown): Row | null {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return null;
  const input = row as Record<string, unknown>;
  if (!isSafeId(input.id)) return null;
  const spec = SCHEMA[table];
  const out: Row = {};
  for (const [col, s] of Object.entries(spec)) {
    if (!Object.prototype.hasOwnProperty.call(input, col)) continue;
    const v = input[col];
    if (!cellOk(s, v)) return null;
    out[col] = v as Cell;
  }
  return out;
}
