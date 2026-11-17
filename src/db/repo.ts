/**
 * All database reads and writes. Writes go through `writeTx`, which runs one
 * write at a time inside a transaction and then tells screens to refresh.
 */
import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { addMonths, currentMonthKey, monthOfDay, nowIso, type DayKey, type MonthKey } from '../lib/date';
import {
  baseFee,
  feeForMonth,
  monthsToGenerate,
  rebuildFeeSteps,
  recalcChain,
  statusFor,
} from '../lib/dues';
import { notifyDataChanged } from './events';
import { dueIdFor, REPAIR_SQL } from './schema';
import type {
  Area,
  Business,
  Customer,
  CustomerInput,
  CustomerListRow,
  DueListRow,
  FeeChange,
  Language,
  MonthlyDue,
  MonthSummary,
  Payment,
  PaymentInput,
  PaymentMethod,
  ReminderChannel,
  Staff,
  StaffRole,
} from './types';

// ---------------------------------------------------------------------------
// Write serialization
// ---------------------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve();

/** Run `fn` when no other write is running (no transaction of its own). */
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Run `fn` inside a transaction, one writer at a time. expo-sqlite's
 * withTransactionAsync is not exclusive, so without this queue two writes
 * started together could interleave inside one transaction.
 */
export async function writeTx<T>(db: SQLiteDatabase, fn: () => Promise<T>): Promise<T> {
  const value = await exclusive(async () => {
    let result: T | undefined;
    await db.withTransactionAsync(async () => {
      result = await fn();
    });
    return result as T;
  });
  notifyDataChanged();
  return value;
}

// ---------------------------------------------------------------------------
// Business and settings
// ---------------------------------------------------------------------------

export const META_ACTIVE_BUSINESS = 'active_business';

export function listBusinesses(db: SQLiteDatabase): Promise<Business[]> {
  return db.getAllAsync<Business>(
    'SELECT * FROM businesses WHERE deleted_at IS NULL ORDER BY created_at',
  );
}

export function getBusinessById(db: SQLiteDatabase, id: string): Promise<Business | null> {
  return db.getFirstAsync<Business>(
    'SELECT * FROM businesses WHERE id = ? AND deleted_at IS NULL',
    id,
  );
}

/** The business the app is showing: the one picked last, else the first. */
export async function getActiveBusiness(db: SQLiteDatabase): Promise<Business | null> {
  const id = await getMeta(db, META_ACTIVE_BUSINESS);
  const picked = id ? await getBusinessById(db, id) : null;
  return (
    picked ??
    db.getFirstAsync<Business>(
      'SELECT * FROM businesses WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
    )
  );
}

/** Kept for the single-business screens and tests. */
export const getBusiness = getActiveBusiness;

export function setActiveBusiness(db: SQLiteDatabase, id: string): Promise<void> {
  return setMeta(db, META_ACTIVE_BUSINESS, id);
}

async function insertOwnerStaff(db: SQLiteDatabase, businessId: string, phone: string | null) {
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO staff (id, business_id, name, phone, role, created_at, updated_at)
     VALUES (?, ?, '', ?, 'owner', ?, ?)`,
    randomUUID(),
    businessId,
    phone,
    now,
    now,
  );
}

/** Create a business (with its owner staff row) and switch to it. */
export async function createBusiness(
  db: SQLiteDatabase,
  input: { name: string; phone: string | null; language: Language },
): Promise<string> {
  const id = randomUUID();
  const now = nowIso();
  await writeTx(db, async () => {
    await db.runAsync(
      `INSERT INTO businesses (id, name, phone, currency, language, created_at, updated_at)
       VALUES (?, ?, ?, 'PKR', ?, ?, ?)`,
      id,
      input.name,
      input.phone,
      input.language,
      now,
      now,
    );
    await insertOwnerStaff(db, id, input.phone);
    await upsertMeta(db, META_ACTIVE_BUSINESS, id);
  });
  return id;
}

export type BusinessPatch = Partial<
  Pick<Business, 'name' | 'phone' | 'language' | 'reminder_template' | 'payment_info' | 'payment_link'>
>;

export async function updateBusiness(db: SQLiteDatabase, id: string, patch: BusinessPatch): Promise<void> {
  const current = await db.getFirstAsync<Business>('SELECT * FROM businesses WHERE id = ?', id);
  if (!current) return;
  const next = { ...current, ...patch };
  await writeTx(db, async () => {
    await db.runAsync(
      `UPDATE businesses SET name = ?, phone = ?, language = ?, reminder_template = ?,
         payment_info = ?, payment_link = ?, updated_at = ?
       WHERE id = ?`,
      next.name,
      next.phone,
      next.language,
      next.reminder_template,
      next.payment_info,
      next.payment_link,
      nowIso(),
      id,
    );
  });
}

/**
 * Personal details cleared when a row is deleted, per table. Deleted rows stay
 * as tombstones (cloud sync needs them to remove the row on other phones), but
 * without names, phone numbers, addresses or notes.
 */
const SCRUB_ON_DELETE: Record<string, string> = {
  customers: "name = '', phone = NULL, address = NULL, notes = NULL",
  payments: 'note = NULL',
  fee_changes: 'note = NULL',
  staff: 'phone = NULL, invite_code = NULL',
  areas: '',
  monthly_dues: '',
  reminders_log: '',
};
const scrub = (table: string) => (SCRUB_ON_DELETE[table] ? `, ${SCRUB_ON_DELETE[table]}` : '');

/** Delete a business and everything in it (tombstones without personal details). */
export async function deleteBusiness(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await writeTx(db, async () => {
    for (const table of [
      'reminders_log',
      'fee_changes',
      'payments',
      'monthly_dues',
      'customers',
      'staff',
      'areas',
    ]) {
      await db.runAsync(
        `UPDATE ${table} SET deleted_at = ?, updated_at = ?${scrub(table)} WHERE business_id = ? AND deleted_at IS NULL`,
        now,
        now,
        id,
      );
    }
    // Rows deleted earlier may still hold details from before this version.
    await db.runAsync(
      `UPDATE customers SET updated_at = ?${scrub('customers')}
       WHERE business_id = ? AND (name <> '' OR phone IS NOT NULL OR address IS NOT NULL OR notes IS NOT NULL)`,
      now,
      id,
    );
    await db.runAsync(
      `UPDATE businesses SET deleted_at = ?, updated_at = ?, name = '', phone = NULL, reminder_template = NULL,
         payment_info = NULL, payment_link = NULL
       WHERE id = ?`,
      now,
      now,
      id,
    );
    await db.runAsync(
      'DELETE FROM staff_pins WHERE staff_id IN (SELECT s.id FROM staff s WHERE s.business_id = ?)',
      id,
    );
    await db.runAsync(
      "DELETE FROM app_meta WHERE key IN ('current_staff:' || ?, 'alerts:' || ?)",
      id,
      id,
    );
    if ((await getMeta(db, META_ACTIVE_BUSINESS)) === id) {
      await db.runAsync('DELETE FROM app_meta WHERE key = ?', META_ACTIVE_BUSINESS);
    }
  });
}

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM app_meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

/** Write a setting inside an existing transaction. */
export async function upsertMeta(db: SQLiteDatabase, key: string, value: string | null): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string | null): Promise<void> {
  await writeTx(db, () => upsertMeta(db, key, value));
}

/**
 * Write (or with null, remove) a bookkeeping setting without refreshing the
 * screens, e.g. wrong-PIN counts.
 */
export async function setMetaQuietly(db: SQLiteDatabase, key: string, value: string | null): Promise<void> {
  await exclusive(async () => {
    if (value === null) await db.runAsync('DELETE FROM app_meta WHERE key = ?', key);
    else await upsertMeta(db, key, value);
  });
}

export const META_LAST_BACKUP = 'last_backup_at';

// ---------------------------------------------------------------------------
// Staff (premium)
// ---------------------------------------------------------------------------

export type StaffRow = Staff & { has_pin: number };

export function listStaff(db: SQLiteDatabase, businessId: string): Promise<StaffRow[]> {
  return db.getAllAsync<StaffRow>(
    `SELECT s.*, EXISTS (SELECT 1 FROM staff_pins p WHERE p.staff_id = s.id) AS has_pin
     FROM staff s
     WHERE s.business_id = ? AND s.deleted_at IS NULL
     ORDER BY s.role = 'owner' DESC, s.name COLLATE NOCASE`,
    businessId,
  );
}

export function getStaff(db: SQLiteDatabase, id: string): Promise<Staff | null> {
  return db.getFirstAsync<Staff>('SELECT * FROM staff WHERE id = ? AND deleted_at IS NULL', id);
}

export function ownerStaff(db: SQLiteDatabase, businessId: string): Promise<Staff | null> {
  return db.getFirstAsync<Staff>(
    `SELECT * FROM staff WHERE business_id = ? AND role = 'owner' AND deleted_at IS NULL
     ORDER BY created_at LIMIT 1`,
    businessId,
  );
}

export interface StaffInput {
  name: string;
  phone: string | null;
  role: StaffRole;
}

export async function createStaff(db: SQLiteDatabase, businessId: string, input: StaffInput): Promise<string> {
  const id = randomUUID();
  const now = nowIso();
  await writeTx(db, async () => {
    await db.runAsync(
      `INSERT INTO staff (id, business_id, name, phone, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      businessId,
      input.name,
      input.phone,
      input.role,
      now,
      now,
    );
  });
  return id;
}

export async function updateStaff(db: SQLiteDatabase, id: string, input: StaffInput): Promise<void> {
  await writeTx(db, async () => {
    await db.runAsync(
      'UPDATE staff SET name = ?, phone = ?, role = ?, updated_at = ? WHERE id = ?',
      input.name,
      input.phone,
      input.role,
      nowIso(),
      id,
    );
  });
}

/** Remove a staff member. The owner can't be removed; their payments keep the name. */
export async function deleteStaff(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await writeTx(db, async () => {
    // The name stays (payments show who received them); the phone number goes.
    await db.runAsync(
      `UPDATE staff SET deleted_at = ?, updated_at = ?, invite_code = NULL, phone = NULL
       WHERE id = ? AND role <> 'owner'`,
      now,
      now,
      id,
    );
    await db.runAsync('DELETE FROM staff_pins WHERE staff_id = ?', id);
  });
}

export async function setStaffPin(db: SQLiteDatabase, staffId: string, pinHash: string | null): Promise<void> {
  await writeTx(db, async () => {
    if (pinHash) {
      await db.runAsync(
        `INSERT INTO staff_pins (staff_id, pin_hash) VALUES (?, ?)
         ON CONFLICT(staff_id) DO UPDATE SET pin_hash = excluded.pin_hash`,
        staffId,
        pinHash,
      );
    } else {
      await db.runAsync('DELETE FROM staff_pins WHERE staff_id = ?', staffId);
    }
  });
}

export async function getStaffPinHash(db: SQLiteDatabase, staffId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ pin_hash: string }>(
    'SELECT pin_hash FROM staff_pins WHERE staff_id = ?',
    staffId,
  );
  return row?.pin_hash ?? null;
}

export async function setStaffInvite(db: SQLiteDatabase, staffId: string, code: string | null): Promise<void> {
  await writeTx(db, async () => {
    await db.runAsync(
      'UPDATE staff SET invite_code = ?, updated_at = ? WHERE id = ?',
      code,
      nowIso(),
      staffId,
    );
  });
}

export const currentStaffKey = (businessId: string) => `current_staff:${businessId}`;
/** Set on a staff member's own phone that joined a cloud business: the app is locked to them. */
export const cloudStaffKey = (businessId: string) => `cloud_staff:${businessId}`;

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

export type AreaWithCount = Area & { customer_count: number };

export function listAreas(db: SQLiteDatabase, businessId: string): Promise<AreaWithCount[]> {
  return db.getAllAsync<AreaWithCount>(
    `SELECT a.*,
       (SELECT COUNT(*) FROM customers c WHERE c.area_id = a.id AND c.deleted_at IS NULL) AS customer_count
     FROM areas a
     WHERE a.business_id = ? AND a.deleted_at IS NULL
     ORDER BY a.name COLLATE NOCASE`,
    businessId,
  );
}

export async function createArea(db: SQLiteDatabase, businessId: string, name: string): Promise<string> {
  const id = randomUUID();
  const now = nowIso();
  await writeTx(db, async () => {
    await db.runAsync(
      'INSERT INTO areas (id, business_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      id,
      businessId,
      name,
      now,
      now,
    );
  });
  return id;
}

export async function renameArea(db: SQLiteDatabase, id: string, name: string): Promise<void> {
  await writeTx(db, async () => {
    await db.runAsync('UPDATE areas SET name = ?, updated_at = ? WHERE id = ?', name, nowIso(), id);
  });
}

export async function deleteArea(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await writeTx(db, async () => {
    await db.runAsync(
      'UPDATE customers SET area_id = NULL, updated_at = ? WHERE area_id = ?',
      now,
      id,
    );
    await db.runAsync('UPDATE areas SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
  });
}

// ---------------------------------------------------------------------------
// Monthly dues (internal helpers, must run inside writeTx)
// ---------------------------------------------------------------------------

async function insertDue(db: SQLiteDatabase, customer: Customer, month: MonthKey, fee: number): Promise<void> {
  const now = nowIso();
  // A due removed earlier (customer was inactive) comes back as the same row.
  await db.runAsync(
    `INSERT INTO monthly_dues
       (id, business_id, customer_id, month, fee_amount, carried_forward, total_due, paid_amount, status,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       deleted_at = NULL, fee_amount = excluded.fee_amount, carried_forward = 0,
       total_due = excluded.total_due, paid_amount = 0, status = excluded.status,
       updated_at = excluded.updated_at`,
    dueIdFor(customer.id, month),
    customer.business_id,
    customer.id,
    month,
    fee,
    fee,
    statusFor(fee, 0),
    now,
    now,
  );
}

function liveFeeChanges(db: SQLiteDatabase, customerId: string): Promise<FeeChange[]> {
  return db.getAllAsync<FeeChange>(
    'SELECT * FROM fee_changes WHERE customer_id = ? AND deleted_at IS NULL',
    customerId,
  );
}

/** Create the missing dues for `months` (skipping ones that already exist). */
async function insertDuesForMonths(
  db: SQLiteDatabase,
  customer: Customer,
  months: MonthKey[],
): Promise<void> {
  if (months.length === 0) return;
  const changes = await liveFeeChanges(db, customer.id);
  const existing = new Set(
    (
      await db.getAllAsync<{ month: string }>(
        'SELECT month FROM monthly_dues WHERE customer_id = ? AND deleted_at IS NULL',
        customer.id,
      )
    ).map((r) => r.month),
  );
  for (const m of months) {
    if (existing.has(m)) continue;
    await insertDue(db, customer, m, feeForMonth(m, customer.monthly_fee, changes));
  }
}

/** Fill months after the last due up to the current month (active customers only). */
async function fillDuesToCurrent(
  db: SQLiteDatabase,
  customer: Customer,
  lastMonth: MonthKey | null,
  current: MonthKey,
): Promise<boolean> {
  if (customer.status !== 'active' || customer.deleted_at) return false;
  const months = monthsToGenerate(monthOfDay(customer.start_date), lastMonth, current);
  await insertDuesForMonths(db, customer, months);
  return months.length > 0;
}

async function lastDueMonth(db: SQLiteDatabase, customerId: string): Promise<MonthKey | null> {
  const row = await db.getFirstAsync<{ month: string | null }>(
    'SELECT MAX(month) AS month FROM monthly_dues WHERE customer_id = ? AND deleted_at IS NULL',
    customerId,
  );
  return row?.month ?? null;
}

/** Recompute paid_amount for one due from its payments. */
async function refreshDuePaid(db: SQLiteDatabase, dueId: string): Promise<void> {
  const sum = `(SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE monthly_due_id = monthly_dues.id AND deleted_at IS NULL)`;
  await db.runAsync(
    `UPDATE monthly_dues SET paid_amount = ${sum}, updated_at = ?
     WHERE id = ? AND paid_amount <> ${sum}`,
    nowIso(),
    dueId,
  );
}

/**
 * Recompute everything derived for a customer: paid_amount from payments,
 * then the carry-forward chain. Only rows whose values change are written.
 * Used after downloading changes from the cloud.
 */
export async function reconcileCustomer(db: SQLiteDatabase, customerId: string): Promise<void> {
  const sum = `(SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE monthly_due_id = monthly_dues.id AND deleted_at IS NULL)`;
  await db.runAsync(
    `UPDATE monthly_dues SET paid_amount = ${sum}, updated_at = ?
     WHERE customer_id = ? AND deleted_at IS NULL AND paid_amount <> ${sum}`,
    nowIso(),
    customerId,
  );
  await recalcCustomer(db, customerId);
}

/** Recompute carried_forward, total_due and status across a customer's months. */
async function recalcCustomer(db: SQLiteDatabase, customerId: string): Promise<void> {
  const dues = await db.getAllAsync<MonthlyDue>(
    'SELECT * FROM monthly_dues WHERE customer_id = ? AND deleted_at IS NULL ORDER BY month',
    customerId,
  );
  const now = nowIso();
  for (const d of recalcChain(dues)) {
    await db.runAsync(
      'UPDATE monthly_dues SET carried_forward = ?, total_due = ?, status = ?, updated_at = ? WHERE id = ?',
      d.carried_forward,
      d.total_due,
      d.status,
      now,
      d.id,
    );
  }
}

/** Soft-delete dues in [from, to] for a customer that have no payments. */
async function dropUnpaidDues(
  db: SQLiteDatabase,
  customerId: string,
  where: 'before' | 'fromMonth',
  month: MonthKey,
): Promise<void> {
  const now = nowIso();
  const cmp = where === 'before' ? '<' : '>=';
  await db.runAsync(
    `UPDATE monthly_dues SET deleted_at = ?, updated_at = ?
     WHERE customer_id = ? AND deleted_at IS NULL AND month ${cmp} ?
       AND NOT EXISTS (SELECT 1 FROM payments p
                       WHERE p.monthly_due_id = monthly_dues.id AND p.deleted_at IS NULL)`,
    now,
    now,
    customerId,
    month,
  );
}

/**
 * Step 1 of the monthly logic: make sure every active customer has a due for
 * every month from their start month to now. Runs when the app opens or
 * comes back to the foreground. Works fully offline.
 */
export async function ensureAllDues(db: SQLiteDatabase): Promise<void> {
  const current = currentMonthKey();
  const rows = await db.getAllAsync<Customer & { last_month: string | null }>(
    `SELECT c.*,
       (SELECT MAX(d.month) FROM monthly_dues d
        WHERE d.customer_id = c.id AND d.deleted_at IS NULL) AS last_month
     FROM customers c
     WHERE c.status = 'active' AND c.deleted_at IS NULL`,
  );
  const needs = rows.filter(
    (c) => monthsToGenerate(monthOfDay(c.start_date), c.last_month, current).length > 0,
  );
  if (needs.length === 0) return;
  await writeTx(db, async () => {
    for (const c of needs) {
      // Re-read inside the transaction in case another write changed it.
      const last = await lastDueMonth(db, c.id);
      if (await fillDuesToCurrent(db, c, last, current)) {
        await recalcCustomer(db, c.id);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** customers.monthly_fee is the latest fee; this is the fee for the current month. */
const CURRENT_FEE = `COALESCE((SELECT f.old_fee FROM fee_changes f
   WHERE f.customer_id = c.id AND f.deleted_at IS NULL AND f.effective_month > ?
   ORDER BY f.effective_month LIMIT 1), c.monthly_fee) AS current_fee`;

export type CustomerDetail = Customer & { area_name: string | null; current_fee: number };

export function getCustomer(db: SQLiteDatabase, id: string): Promise<CustomerDetail | null> {
  return db.getFirstAsync<CustomerDetail>(
    `SELECT c.*, a.name AS area_name, ${CURRENT_FEE}
     FROM customers c LEFT JOIN areas a ON a.id = c.area_id AND a.deleted_at IS NULL
     WHERE c.id = ? AND c.deleted_at IS NULL`,
    currentMonthKey(),
    id,
  );
}

export function listCustomers(db: SQLiteDatabase, businessId: string): Promise<CustomerListRow[]> {
  return db.getAllAsync<CustomerListRow>(
    `SELECT c.*, a.name AS area_name, ${CURRENT_FEE},
       (SELECT d.total_due - d.paid_amount FROM monthly_dues d
        WHERE d.customer_id = c.id AND d.deleted_at IS NULL
        ORDER BY d.month DESC LIMIT 1) AS balance
     FROM customers c
     LEFT JOIN areas a ON a.id = c.area_id AND a.deleted_at IS NULL
     WHERE c.business_id = ? AND c.deleted_at IS NULL
     ORDER BY c.name COLLATE NOCASE`,
    currentMonthKey(),
    businessId,
  );
}

export async function countCustomers(db: SQLiteDatabase, businessId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM customers WHERE business_id = ? AND deleted_at IS NULL',
    businessId,
  );
  return row?.n ?? 0;
}

export async function createCustomer(
  db: SQLiteDatabase,
  businessId: string,
  input: CustomerInput,
): Promise<string> {
  const id = randomUUID();
  const now = nowIso();
  await writeTx(db, async () => {
    await db.runAsync(
      `INSERT INTO customers
         (id, business_id, area_id, name, phone, address, monthly_fee, start_date, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      businessId,
      input.area_id,
      input.name,
      input.phone,
      input.address,
      input.monthly_fee,
      input.start_date,
      input.status,
      input.notes,
      now,
      now,
    );
    const customer = await db.getFirstAsync<Customer>('SELECT * FROM customers WHERE id = ?', id);
    if (customer) {
      await fillDuesToCurrent(db, customer, null, currentMonthKey());
      await recalcCustomer(db, id);
    }
  });
  return id;
}

/** Customer fields editable on the edit screen. The fee changes through changeFee. */
export type CustomerEdit = Omit<CustomerInput, 'monthly_fee'>;

export async function updateCustomer(
  db: SQLiteDatabase,
  id: string,
  input: CustomerEdit,
): Promise<void> {
  const current = currentMonthKey();
  await writeTx(db, async () => {
    const old = await db.getFirstAsync<Customer>(
      'SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL',
      id,
    );
    if (!old) throw new Error('Customer not found');

    await db.runAsync(
      `UPDATE customers SET area_id = ?, name = ?, phone = ?, address = ?,
         start_date = ?, status = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      input.area_id,
      input.name,
      input.phone,
      input.address,
      input.start_date,
      input.status,
      input.notes,
      nowIso(),
      id,
    );

    const updated = (await db.getFirstAsync<Customer>('SELECT * FROM customers WHERE id = ?', id))!;
    const oldStart = monthOfDay(old.start_date);
    const newStart = monthOfDay(input.start_date);

    // Start date moved later: drop earlier months that have no payments.
    if (newStart > oldStart) {
      await dropUnpaidDues(db, id, 'before', newStart);
    }

    if (old.status === 'active' && input.status === 'inactive') {
      // Stopped the service: no due for this month unless money was already recorded.
      await dropUnpaidDues(db, id, 'fromMonth', current);
    } else if (input.status === 'active') {
      if (old.status === 'inactive') {
        // Restarted: charge from this month, not for the months they were inactive.
        if (current >= newStart) await insertDuesForMonths(db, updated, [current]);
      } else if (newStart < oldStart) {
        // Start date moved earlier: add the earlier months.
        const first = await db.getFirstAsync<{ month: string | null }>(
          'SELECT MIN(month) AS month FROM monthly_dues WHERE customer_id = ? AND deleted_at IS NULL',
          id,
        );
        const until = first?.month ?? current;
        const months = monthsToGenerate(newStart, null, until < current ? until : current);
        await insertDuesForMonths(db, updated, months);
      }
      await fillDuesToCurrent(db, updated, await lastDueMonth(db, id), current);
    }

    await recalcCustomer(db, id);
  });
}

// ---------------------------------------------------------------------------
// Fee changes (fee history)
// ---------------------------------------------------------------------------

export function feeHistory(db: SQLiteDatabase, customerId: string): Promise<FeeChange[]> {
  return db.getAllAsync<FeeChange>(
    `SELECT * FROM fee_changes WHERE customer_id = ? AND deleted_at IS NULL
     ORDER BY effective_month DESC`,
    customerId,
  );
}

/** Save a rebuilt fee history and re-price the customer's dues. Inside writeTx. */
async function writeFeeHistory(
  db: SQLiteDatabase,
  customer: Customer,
  base: number,
  targets: Map<MonthKey, number>,
  notes: Map<MonthKey, string | null>,
): Promise<void> {
  const now = nowIso();
  const existing = await liveFeeChanges(db, customer.id);
  const { steps, latestFee } = rebuildFeeSteps(base, targets);
  const keep = new Set<string>();
  for (const step of steps) {
    const ex = existing.find((c) => c.effective_month === step.effective_month && !keep.has(c.id));
    const note = notes.has(step.effective_month)
      ? (notes.get(step.effective_month) ?? null)
      : (ex?.note ?? null);
    if (ex) {
      keep.add(ex.id);
      if (ex.old_fee !== step.old_fee || ex.new_fee !== step.new_fee || (ex.note ?? null) !== note) {
        await db.runAsync(
          'UPDATE fee_changes SET old_fee = ?, new_fee = ?, note = ?, updated_at = ? WHERE id = ?',
          step.old_fee,
          step.new_fee,
          note,
          now,
          ex.id,
        );
      }
    } else {
      await db.runAsync(
        `INSERT INTO fee_changes
           (id, business_id, customer_id, old_fee, new_fee, effective_month, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        customer.business_id,
        customer.id,
        step.old_fee,
        step.new_fee,
        step.effective_month,
        note,
        now,
        now,
      );
    }
  }
  for (const ex of existing) {
    if (!keep.has(ex.id)) {
      await db.runAsync(
        'UPDATE fee_changes SET deleted_at = ?, updated_at = ? WHERE id = ?',
        now,
        now,
        ex.id,
      );
    }
  }
  if (customer.monthly_fee !== latestFee) {
    await db.runAsync(
      'UPDATE customers SET monthly_fee = ?, updated_at = ? WHERE id = ?',
      latestFee,
      now,
      customer.id,
    );
  }
  const dues = await db.getAllAsync<MonthlyDue>(
    'SELECT * FROM monthly_dues WHERE customer_id = ? AND deleted_at IS NULL',
    customer.id,
  );
  for (const d of dues) {
    const fee = feeForMonth(d.month, latestFee, steps);
    if (fee !== d.fee_amount) {
      await db.runAsync(
        'UPDATE monthly_dues SET fee_amount = ?, updated_at = ? WHERE id = ?',
        fee,
        now,
        d.id,
      );
    }
  }
  await recalcCustomer(db, customer.id);
}

/**
 * Change a customer's fee from `month` onwards (past, current or future).
 * Earlier months keep their fee; months already billed from `month` on are
 * re-priced, and a later scheduled change still applies after this one.
 */
export async function changeFee(
  db: SQLiteDatabase,
  customerId: string,
  month: MonthKey,
  newFee: number,
  note: string | null = null,
): Promise<void> {
  await writeTx(db, async () => {
    const customer = await db.getFirstAsync<Customer>(
      'SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL',
      customerId,
    );
    if (!customer) throw new Error('Customer not found');
    const existing = await liveFeeChanges(db, customerId);
    const base = baseFee(customer.monthly_fee, existing);
    const targets = new Map(existing.map((c) => [c.effective_month, c.new_fee]));
    targets.set(month, newFee);
    await writeFeeHistory(db, customer, base, targets, new Map([[month, note]]));
  });
}

/** Undo one fee change; the months it covered go back to the fee before it. */
export async function deleteFeeChange(db: SQLiteDatabase, changeId: string): Promise<void> {
  await writeTx(db, async () => {
    const change = await db.getFirstAsync<FeeChange>('SELECT * FROM fee_changes WHERE id = ?', changeId);
    if (!change) return;
    const customer = await db.getFirstAsync<Customer>(
      'SELECT * FROM customers WHERE id = ?',
      change.customer_id,
    );
    if (!customer) return;
    const existing = await liveFeeChanges(db, customer.id);
    const base = baseFee(customer.monthly_fee, existing);
    const targets = new Map(
      existing.filter((c) => c.id !== changeId).map((c) => [c.effective_month, c.new_fee]),
    );
    await writeFeeHistory(db, customer, base, targets, new Map());
  });
}

/** The fee that applies this month (customers.monthly_fee may be a scheduled future fee). */
export async function feeThisMonth(db: SQLiteDatabase, customer: Customer): Promise<number> {
  return feeForMonth(currentMonthKey(), customer.monthly_fee, await liveFeeChanges(db, customer.id));
}

/**
 * Delete a customer and their dues, payments, fee history and reminders. The
 * rows stay as tombstones for cloud sync, but the customer's name, phone,
 * address and notes (and payment and fee notes) are cleared, as the privacy
 * policy promises when a customer asks to be removed.
 */
export async function deleteCustomer(db: SQLiteDatabase, id: string): Promise<void> {
  const now = nowIso();
  await writeTx(db, async () => {
    for (const table of ['reminders_log', 'payments', 'monthly_dues', 'fee_changes']) {
      await db.runAsync(
        `UPDATE ${table} SET deleted_at = ?, updated_at = ?${scrub(table)} WHERE customer_id = ? AND deleted_at IS NULL`,
        now,
        now,
        id,
      );
    }
    // Payments deleted one by one earlier may still have a note.
    await db.runAsync(
      'UPDATE payments SET note = NULL, updated_at = ? WHERE customer_id = ? AND note IS NOT NULL',
      now,
      id,
    );
    await db.runAsync(
      `UPDATE customers SET deleted_at = ?, updated_at = ?${scrub('customers')} WHERE id = ?`,
      now,
      now,
      id,
    );
  });
}

// ---------------------------------------------------------------------------
// Dues: reads
// ---------------------------------------------------------------------------

const LAST_REMINDED = `(SELECT MAX(r.sent_at) FROM reminders_log r
   WHERE r.monthly_due_id = d.id AND r.deleted_at IS NULL) AS last_reminded_at`;

export function listDuesForMonth(
  db: SQLiteDatabase,
  businessId: string,
  month: MonthKey,
  opts: { areaId?: string | null; paidOn?: DayKey | null } = {},
): Promise<DueListRow[]> {
  const params: (string | number)[] = [businessId, month];
  let filters = '';
  if (opts.areaId === 'none') {
    filters += ' AND c.area_id IS NULL';
  } else if (opts.areaId) {
    filters += ' AND c.area_id = ?';
    params.push(opts.areaId);
  }
  if (opts.paidOn) {
    filters += ` AND EXISTS (SELECT 1 FROM payments p
                  WHERE p.monthly_due_id = d.id AND p.deleted_at IS NULL AND p.paid_on = ?)`;
    params.push(opts.paidOn);
  }
  return db.getAllAsync<DueListRow>(
    `SELECT d.*, c.name AS customer_name, c.phone AS customer_phone, c.notes AS customer_notes,
       a.name AS area_name,
       (SELECT MAX(p.paid_on) FROM payments p
        WHERE p.monthly_due_id = d.id AND p.deleted_at IS NULL) AS last_paid_on,
       ${LAST_REMINDED}
     FROM monthly_dues d
     JOIN customers c ON c.id = d.customer_id AND c.deleted_at IS NULL
     LEFT JOIN areas a ON a.id = c.area_id AND a.deleted_at IS NULL
     WHERE c.business_id = ? AND d.month = ? AND d.deleted_at IS NULL${filters}
     ORDER BY c.name COLLATE NOCASE`,
    ...params,
  );
}

export async function monthSummary(
  db: SQLiteDatabase,
  businessId: string,
  month: MonthKey,
): Promise<MonthSummary> {
  const row = await db.getFirstAsync<{
    expected: number | null;
    carried: number | null;
    collected: number | null;
    pending: number | null;
    unpaid: number | null;
    partial: number | null;
    paid: number | null;
  }>(
    `SELECT
       SUM(MAX(d.total_due, 0)) AS expected,
       SUM(MAX(d.carried_forward, 0)) AS carried,
       SUM(d.paid_amount) AS collected,
       SUM(MAX(d.total_due - d.paid_amount, 0)) AS pending,
       SUM(d.status = 'unpaid') AS unpaid,
       SUM(d.status = 'partial') AS partial,
       SUM(d.status = 'paid') AS paid
     FROM monthly_dues d
     JOIN customers c ON c.id = d.customer_id AND c.deleted_at IS NULL
     WHERE c.business_id = ? AND d.month = ? AND d.deleted_at IS NULL`,
    businessId,
    month,
  );
  return {
    expected: row?.expected ?? 0,
    carried: row?.carried ?? 0,
    collected: row?.collected ?? 0,
    pending: row?.pending ?? 0,
    counts: {
      unpaid: row?.unpaid ?? 0,
      partial: row?.partial ?? 0,
      paid: row?.paid ?? 0,
    },
  };
}

export function getDue(db: SQLiteDatabase, id: string): Promise<DueListRow | null> {
  return db.getFirstAsync<DueListRow>(
    `SELECT d.*, c.name AS customer_name, c.phone AS customer_phone, c.notes AS customer_notes,
       a.name AS area_name, NULL AS last_paid_on, ${LAST_REMINDED}
     FROM monthly_dues d
     JOIN customers c ON c.id = d.customer_id
     LEFT JOIN areas a ON a.id = c.area_id AND a.deleted_at IS NULL
     WHERE d.id = ? AND d.deleted_at IS NULL`,
    id,
  );
}

export function customerDues(db: SQLiteDatabase, customerId: string): Promise<MonthlyDue[]> {
  return db.getAllAsync<MonthlyDue>(
    'SELECT * FROM monthly_dues WHERE customer_id = ? AND deleted_at IS NULL ORDER BY month DESC',
    customerId,
  );
}

export type PaymentRow = Payment & {
  month: MonthKey;
  received_by_name: string | null;
  received_by_role: StaffRole | null;
};

const PAYMENT_ROW = `SELECT p.*, d.month, s.name AS received_by_name, s.role AS received_by_role
  FROM payments p
  JOIN monthly_dues d ON d.id = p.monthly_due_id
  LEFT JOIN staff s ON s.id = p.received_by`;

export function customerPayments(db: SQLiteDatabase, customerId: string): Promise<PaymentRow[]> {
  return db.getAllAsync<PaymentRow>(
    `${PAYMENT_ROW}
     WHERE p.customer_id = ? AND p.deleted_at IS NULL
     ORDER BY p.paid_on DESC, p.created_at DESC`,
    customerId,
  );
}

/** One payment with what a receipt needs. */
export type ReceiptData = PaymentRow & {
  customer_name: string;
  customer_phone: string | null;
  total_due: number;
  paid_amount: number;
};

export function getReceipt(db: SQLiteDatabase, paymentId: string): Promise<ReceiptData | null> {
  return db.getFirstAsync<ReceiptData>(
    `SELECT p.*, d.month, s.name AS received_by_name, s.role AS received_by_role,
       c.name AS customer_name, c.phone AS customer_phone, d.total_due, d.paid_amount
     FROM payments p
     JOIN monthly_dues d ON d.id = p.monthly_due_id
     JOIN customers c ON c.id = p.customer_id
     LEFT JOIN staff s ON s.id = p.received_by
     WHERE p.id = ? AND p.deleted_at IS NULL`,
    paymentId,
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function addPayment(db: SQLiteDatabase, input: PaymentInput): Promise<string> {
  const now = nowIso();
  const id = randomUUID();
  await writeTx(db, async () => {
    const due = await db.getFirstAsync<MonthlyDue>(
      'SELECT * FROM monthly_dues WHERE id = ? AND deleted_at IS NULL',
      input.monthly_due_id,
    );
    if (!due) throw new Error('Due not found');
    await db.runAsync(
      `INSERT INTO payments
         (id, business_id, monthly_due_id, customer_id, amount, paid_on, method, received_by, note,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      due.business_id,
      due.id,
      due.customer_id,
      input.amount,
      input.paid_on,
      input.method,
      input.received_by ?? null,
      input.note,
      now,
      now,
    );
    await refreshDuePaid(db, due.id);
    await recalcCustomer(db, due.customer_id);
  });
  return id;
}

export async function deletePayment(db: SQLiteDatabase, paymentId: string): Promise<void> {
  const now = nowIso();
  await writeTx(db, async () => {
    const p = await db.getFirstAsync<Payment>('SELECT * FROM payments WHERE id = ?', paymentId);
    if (!p) return;
    await db.runAsync(
      'UPDATE payments SET deleted_at = ?, updated_at = ?, note = NULL WHERE id = ?',
      now,
      now,
      paymentId,
    );
    await refreshDuePaid(db, p.monthly_due_id);
    await recalcCustomer(db, p.customer_id);
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface MonthReportRow {
  month: MonthKey;
  billed: number;
  collected: number;
  pending: number;
}

/**
 * Reports cover the dues of one month ("2026-11") or one year (2026), as a
 * LIKE pattern on monthly_dues.month.
 */
export type Period = MonthKey | number;
export const periodPattern = (p: Period) => (typeof p === 'number' ? `${p}-%` : p);

export async function reportYears(db: SQLiteDatabase, businessId: string): Promise<number[]> {
  const rows = await db.getAllAsync<{ y: string }>(
    `SELECT DISTINCT substr(d.month, 1, 4) AS y
     FROM monthly_dues d JOIN customers c ON c.id = d.customer_id AND c.deleted_at IS NULL
     WHERE c.business_id = ? AND d.deleted_at IS NULL ORDER BY y DESC`,
    businessId,
  );
  return rows.map((r) => Number(r.y));
}

export function yearByMonth(db: SQLiteDatabase, businessId: string, year: number): Promise<MonthReportRow[]> {
  return db.getAllAsync<MonthReportRow>(
    `SELECT d.month,
       SUM(d.fee_amount) AS billed,
       SUM(d.paid_amount) AS collected,
       SUM(MAX(d.total_due - d.paid_amount, 0)) AS pending
     FROM monthly_dues d
     JOIN customers c ON c.id = d.customer_id AND c.deleted_at IS NULL
     WHERE c.business_id = ? AND d.deleted_at IS NULL AND d.month LIKE ?
     GROUP BY d.month ORDER BY d.month`,
    businessId,
    `${year}-%`,
  );
}

export interface MethodReportRow {
  method: PaymentMethod;
  total: number;
  count: number;
}

export function reportByMethod(db: SQLiteDatabase, businessId: string, period: Period): Promise<MethodReportRow[]> {
  return db.getAllAsync<MethodReportRow>(
    `SELECT p.method, SUM(p.amount) AS total, COUNT(*) AS count
     FROM payments p
     JOIN monthly_dues d ON d.id = p.monthly_due_id AND d.deleted_at IS NULL
     JOIN customers c ON c.id = p.customer_id AND c.deleted_at IS NULL
     WHERE c.business_id = ? AND p.deleted_at IS NULL AND d.month LIKE ?
     GROUP BY p.method ORDER BY total DESC`,
    businessId,
    periodPattern(period),
  );
}

export interface AreaReportRow {
  area_id: string | null;
  area_name: string | null;
  customers: number;
  billed: number;
  collected: number;
  pending: number;
}

export function reportByArea(db: SQLiteDatabase, businessId: string, period: Period): Promise<AreaReportRow[]> {
  return db.getAllAsync<AreaReportRow>(
    `SELECT a.id AS area_id, a.name AS area_name, COUNT(DISTINCT c.id) AS customers,
       SUM(d.fee_amount) AS billed, SUM(d.paid_amount) AS collected,
       SUM(CASE WHEN d.month = (SELECT MAX(d2.month) FROM monthly_dues d2
                                WHERE d2.customer_id = d.customer_id AND d2.deleted_at IS NULL
                                  AND d2.month LIKE ?)
                THEN MAX(d.total_due - d.paid_amount, 0) ELSE 0 END) AS pending
     FROM monthly_dues d
     JOIN customers c ON c.id = d.customer_id AND c.deleted_at IS NULL
     LEFT JOIN areas a ON a.id = c.area_id AND a.deleted_at IS NULL
     WHERE c.business_id = ? AND d.deleted_at IS NULL AND d.month LIKE ?
     GROUP BY a.id ORDER BY a.name IS NULL, a.name COLLATE NOCASE`,
    periodPattern(period),
    businessId,
    periodPattern(period),
  );
}

export interface CollectorReportRow {
  staff_id: string | null;
  staff_name: string | null;
  role: StaffRole | null;
  total: number;
  count: number;
}

/** Who collected how much (premium staff feature). */
export function reportByCollector(
  db: SQLiteDatabase,
  businessId: string,
  period: Period,
): Promise<CollectorReportRow[]> {
  return db.getAllAsync<CollectorReportRow>(
    `SELECT s.id AS staff_id, s.name AS staff_name, s.role, SUM(p.amount) AS total, COUNT(*) AS count
     FROM payments p
     JOIN monthly_dues d ON d.id = p.monthly_due_id AND d.deleted_at IS NULL
     JOIN customers c ON c.id = p.customer_id AND c.deleted_at IS NULL
     LEFT JOIN staff s ON s.id = p.received_by
     WHERE c.business_id = ? AND p.deleted_at IS NULL AND d.month LIKE ?
     GROUP BY s.id ORDER BY total DESC`,
    businessId,
    periodPattern(period),
  );
}

/** Kept for existing callers: by method / by area for a whole year. */
export const yearByMethod = (db: SQLiteDatabase, businessId: string, year: number) =>
  reportByMethod(db, businessId, year);
export const yearByArea = (db: SQLiteDatabase, businessId: string, year: number) =>
  reportByArea(db, businessId, year);

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export async function logReminder(
  db: SQLiteDatabase,
  input: {
    business_id: string;
    customer_id: string;
    monthly_due_id: string | null;
    channel: ReminderChannel;
    sent_by: string | null;
  },
): Promise<void> {
  const now = nowIso();
  await writeTx(db, async () => {
    await db.runAsync(
      `INSERT INTO reminders_log
         (id, business_id, customer_id, monthly_due_id, channel, sent_at, sent_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      input.business_id,
      input.customer_id,
      input.monthly_due_id,
      input.channel,
      now,
      input.sent_by,
      now,
      now,
    );
  });
}

/**
 * Rough count for next month's alert: active customers who will owe
 * something then (their fee plus what they owe now is above zero).
 */
export async function projectedUnpaidNextMonth(db: SQLiteDatabase, businessId: string): Promise<number> {
  const next = addMonths(currentMonthKey(), 1);
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM customers c
     WHERE c.business_id = ? AND c.status = 'active' AND c.deleted_at IS NULL
       AND substr(c.start_date, 1, 7) <= ?
       AND c.monthly_fee + COALESCE((SELECT d.total_due - d.paid_amount FROM monthly_dues d
             WHERE d.customer_id = c.id AND d.deleted_at IS NULL
             ORDER BY d.month DESC LIMIT 1), 0) > 0`,
    businessId,
    next,
  );
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Wipe
// ---------------------------------------------------------------------------

/**
 * Erase everything stored in the database. secure_delete (set when the
 * database opens) overwrites the freed space, and the checkpoint empties the
 * write-ahead log, so the old rows can't be recovered from the file.
 */
export async function deleteAllData(db: SQLiteDatabase): Promise<void> {
  await writeTx(db, async () => {
    await db.execAsync('PRAGMA defer_foreign_keys = ON');
    for (const table of [
      'reminders_log',
      'fee_changes',
      'payments',
      'monthly_dues',
      'customers',
      'staff',
      'staff_pins',
      'areas',
      'businesses',
      'sync_outbox',
      'sync_links',
      'sync_applying',
      'app_meta',
    ]) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  });
  await exclusive(() => db.execAsync('PRAGMA wal_checkpoint(TRUNCATE)'));
}

/** Re-run the data repairs (after restoring a backup from an older version). */
export async function repairData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(REPAIR_SQL);
}
