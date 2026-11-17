/**
 * Version-2 and premium data features: fee history, several businesses,
 * staff, reminder log, the v1 -> v2 migration and v1 backups.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { importBackup, parseBackup } from '../../lib/backup';
import {
  addPayment,
  changeFee,
  createBusiness,
  createCustomer,
  createStaff,
  customerDues,
  customerPayments,
  deleteBusiness,
  deleteFeeChange,
  deleteStaff,
  ensureAllDues,
  feeHistory,
  getActiveBusiness,
  getCustomer,
  listBusinesses,
  listCustomers,
  listDuesForMonth,
  listStaff,
  logReminder,
  monthSummary,
  ownerStaff,
  projectedUnpaidNextMonth,
  reportByArea,
  reportByCollector,
  reportByMethod,
  setActiveBusiness,
  setStaffPin,
  updateCustomer,
} from '../repo';
import { dueIdFor, migrateDbIfNeeded, MIGRATIONS } from '../schema';
import { createTestDatabase } from '../testing/nodeSqlite';
import type { CustomerInput, MonthlyDue } from '../types';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<{ randomUUID: () => string }>('crypto').randomUUID(),
}));

function setToday(y: number, m: number, d: number) {
  jest.setSystemTime(new Date(y, m - 1, d, 10, 0, 0));
}

let db: SQLiteDatabase;
let businessId: string;

const base: CustomerInput = {
  name: 'Ali Khan',
  phone: '0300-1234567',
  address: null,
  area_id: null,
  monthly_fee: 2000,
  start_date: '2026-09-15',
  status: 'active',
  notes: null,
};

async function dues(customerId: string): Promise<Record<string, MonthlyDue>> {
  const rows = await customerDues(db, customerId);
  return Object.fromEntries(rows.map((r) => [r.month, r]));
}

const pay = (due: MonthlyDue, amount: number, receivedBy: string | null = null) =>
  addPayment(db, {
    monthly_due_id: due.id,
    amount,
    paid_on: '2026-11-05',
    method: 'cash',
    note: null,
    received_by: receivedBy,
  });

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  setToday(2026, 11, 12);
  db = createTestDatabase();
  await migrateDbIfNeeded(db);
  businessId = await createBusiness(db, { name: 'City Cable', phone: '0300-1112223', language: 'en' });
});

describe('fee changes', () => {
  it('changes the fee from the current month and records history', async () => {
    const id = await createCustomer(db, businessId, base);
    await changeFee(db, id, '2026-11', 2500, 'New package');
    const d = await dues(id);
    expect(d['2026-10'].fee_amount).toBe(2000);
    expect(d['2026-11']).toMatchObject({ fee_amount: 2500, total_due: 6500 });
    expect(await feeHistory(db, id)).toEqual([
      expect.objectContaining({ old_fee: 2000, new_fee: 2500, effective_month: '2026-11', note: 'New package' }),
    ]);
    expect((await getCustomer(db, id))?.monthly_fee).toBe(2500);
  });

  it('a change back to the old fee in the same month removes the change', async () => {
    const id = await createCustomer(db, businessId, base);
    await changeFee(db, id, '2026-11', 2500);
    await changeFee(db, id, '2026-11', 3000);
    expect((await feeHistory(db, id)).map((c) => [c.old_fee, c.new_fee])).toEqual([[2000, 3000]]);
    await changeFee(db, id, '2026-11', 2000);
    expect(await feeHistory(db, id)).toEqual([]);
    expect((await dues(id))['2026-11'].fee_amount).toBe(2000);
  });

  it('a change from a past month re-prices months already billed', async () => {
    const id = await createCustomer(db, businessId, base);
    await pay((await dues(id))['2026-10'], 4000); // Sep + Oct fully paid
    await changeFee(db, id, '2026-10', 2500);
    const d = await dues(id);
    expect(d['2026-09'].fee_amount).toBe(2000);
    expect(d['2026-10']).toMatchObject({ fee_amount: 2500, total_due: 4500, status: 'partial' });
    expect(d['2026-11']).toMatchObject({ carried_forward: 500, total_due: 3000 });
  });

  it('a future change is scheduled: this month keeps the current fee', async () => {
    const id = await createCustomer(db, businessId, base);
    await changeFee(db, id, '2027-01', 3000);
    expect((await dues(id))['2026-11'].fee_amount).toBe(2000);
    const c = await getCustomer(db, id);
    expect(c).toMatchObject({ monthly_fee: 3000, current_fee: 2000 });
    expect((await listCustomers(db, businessId))[0].current_fee).toBe(2000);

    setToday(2027, 1, 2);
    await ensureAllDues(db);
    const d = await dues(id);
    expect(d['2026-12'].fee_amount).toBe(2000);
    expect(d['2027-01'].fee_amount).toBe(3000);
  });

  it('keeps the history a consistent chain when changes are added in between or removed', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-01-01' });
    await changeFee(db, id, '2026-06', 3000);
    await changeFee(db, id, '2026-03', 2500);
    const chain = async () =>
      (await feeHistory(db, id)).map((c) => `${c.effective_month}:${c.old_fee}>${c.new_fee}`);
    expect(await chain()).toEqual(['2026-06:2500>3000', '2026-03:2000>2500']);

    const march = (await feeHistory(db, id)).find((c) => c.effective_month === '2026-03')!;
    await deleteFeeChange(db, march.id);
    expect(await chain()).toEqual(['2026-06:2000>3000']);
    const d = await dues(id);
    expect([d['2026-03'].fee_amount, d['2026-06'].fee_amount, d['2026-11'].fee_amount]).toEqual([
      2000, 3000, 3000,
    ]);
  });
});

describe('several businesses', () => {
  it('keeps each business separate and remembers the active one', async () => {
    await createCustomer(db, businessId, base);
    const second = await createBusiness(db, { name: 'Bright Tuition', phone: null, language: 'ur' });
    expect((await getActiveBusiness(db))?.id).toBe(second);
    await createCustomer(db, second, { ...base, name: 'Sana', monthly_fee: 1000, start_date: '2026-11-01' });

    expect((await listCustomers(db, businessId)).map((c) => c.name)).toEqual(['Ali Khan']);
    expect((await listCustomers(db, second)).map((c) => c.name)).toEqual(['Sana']);
    expect((await listDuesForMonth(db, second, '2026-11')).map((r) => r.customer_name)).toEqual(['Sana']);
    expect((await monthSummary(db, second, '2026-11')).expected).toBe(1000);
    expect((await monthSummary(db, businessId, '2026-11')).expected).toBe(6000);

    await setActiveBusiness(db, businessId);
    expect((await getActiveBusiness(db))?.id).toBe(businessId);

    await deleteBusiness(db, businessId);
    expect((await listBusinesses(db)).map((b) => b.id)).toEqual([second]);
    expect((await getActiveBusiness(db))?.id).toBe(second);
    expect(await listCustomers(db, businessId)).toEqual([]);
  });
});

describe('staff', () => {
  it('creates an owner, records who collected each payment, and reports by collector', async () => {
    const owner = await ownerStaff(db, businessId);
    expect(owner).toMatchObject({ role: 'owner', phone: '0300-1112223' });
    const collector = await createStaff(db, businessId, { name: 'Imran', phone: null, role: 'collector' });
    await setStaffPin(db, collector, 'hash');
    expect((await listStaff(db, businessId)).map((s) => [s.role, s.has_pin])).toEqual([
      ['owner', 0],
      ['collector', 1],
    ]);

    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    const d = await dues(id);
    await pay(d['2026-11'], 500, owner!.id);
    await pay(d['2026-11'], 1000, collector);
    expect((await customerPayments(db, id)).map((p) => p.received_by_name)).toEqual(
      expect.arrayContaining(['', 'Imran']),
    );
    expect(await reportByCollector(db, businessId, '2026-11')).toEqual([
      { staff_id: collector, staff_name: 'Imran', role: 'collector', total: 1000, count: 1 },
      { staff_id: owner!.id, staff_name: '', role: 'owner', total: 500, count: 1 },
    ]);
    expect(await reportByMethod(db, businessId, '2026-11')).toEqual([
      { method: 'cash', total: 1500, count: 2 },
    ]);

    await deleteStaff(db, collector);
    await deleteStaff(db, owner!.id); // the owner can't be removed
    expect((await listStaff(db, businessId)).map((s) => s.role)).toEqual(['owner']);
  });
});

describe('reminders and alerts', () => {
  it('shows when each unpaid customer was last reminded', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    const due = (await dues(id))['2026-11'];
    await logReminder(db, {
      business_id: businessId,
      customer_id: id,
      monthly_due_id: due.id,
      channel: 'whatsapp',
      sent_by: null,
    });
    const [row] = await listDuesForMonth(db, businessId, '2026-11');
    expect(row.last_reminded_at).toBe(new Date(2026, 10, 12, 10).toISOString());
  });

  it('counts who will owe next month', async () => {
    const a = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    await createCustomer(db, businessId, { ...base, name: 'Future', start_date: '2027-03-01' });
    await createCustomer(db, businessId, { ...base, name: 'Free', monthly_fee: 0, start_date: '2026-11-01' });
    await pay((await dues(a))['2026-11'], 4000); // paid ahead for December
    expect(await projectedUnpaidNextMonth(db, businessId)).toBe(0);
    await createCustomer(db, businessId, { ...base, name: 'Bilal', start_date: '2026-11-01' });
    expect(await projectedUnpaidNextMonth(db, businessId)).toBe(1);
  });

  it('reports pending by area as what is still owed at the end of the period', async () => {
    const id = await createCustomer(db, businessId, base); // Sep..Nov unpaid: 6000 owed
    await pay((await dues(id))['2026-09'], 2000);
    expect(await reportByArea(db, businessId, 2026)).toEqual([
      { area_id: null, area_name: null, customers: 1, billed: 6000, collected: 2000, pending: 4000 },
    ]);
  });
});

describe('derived due ids', () => {
  it('a reactivated month reuses the same due row', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    expect((await dues(id))['2026-11'].id).toBe(dueIdFor(id, '2026-11'));
    await updateCustomer(db, id, { ...base, start_date: '2026-11-01', status: 'inactive' });
    expect(await dues(id)).toEqual({});
    await updateCustomer(db, id, { ...base, start_date: '2026-11-01', status: 'active' });
    expect((await dues(id))['2026-11']).toMatchObject({ id: dueIdFor(id, '2026-11'), total_due: 2000 });
  });
});

describe('upgrading from version 1', () => {
  it('migrates v1 data: business ids, derived due ids and an owner', async () => {
    const old = createTestDatabase();
    await old.execAsync(MIGRATIONS[0]);
    await old.execAsync('PRAGMA user_version = 1');
    const ts = "'2026-10-01T00:00:00.000Z'";
    await old.execAsync(`
      INSERT INTO businesses (id, name, phone, created_at, updated_at) VALUES ('b1', 'Old Co', '0300', ${ts}, ${ts});
      INSERT INTO customers (id, business_id, name, monthly_fee, start_date, created_at, updated_at)
        VALUES ('c1', 'b1', 'Ali', 2000, '2026-10-01', ${ts}, ${ts});
      INSERT INTO monthly_dues (id, customer_id, month, fee_amount, total_due, paid_amount, status, created_at, updated_at)
        VALUES ('random-1', 'c1', '2026-10', 2000, 2000, 2000, 'paid', ${ts}, ${ts});
      INSERT INTO payments (id, monthly_due_id, customer_id, amount, paid_on, method, created_at, updated_at)
        VALUES ('p1', 'random-1', 'c1', 2000, '2026-10-02', 'cash', ${ts}, ${ts});
    `);
    await migrateDbIfNeeded(old);

    const due = await old.getFirstAsync<MonthlyDue>('SELECT * FROM monthly_dues');
    expect(due).toMatchObject({ id: 'c1:2026-10', business_id: 'b1' });
    expect(await old.getFirstAsync('SELECT monthly_due_id, business_id FROM payments')).toEqual({
      monthly_due_id: 'c1:2026-10',
      business_id: 'b1',
    });
    expect(await old.getFirstAsync("SELECT role, phone FROM staff WHERE business_id = 'b1'")).toEqual({
      role: 'owner',
      phone: '0300',
    });
  });

  it('restores a version-1 backup file', async () => {
    const ts = '2026-10-01T00:00:00.000Z';
    const t = { created_at: ts, updated_at: ts, deleted_at: null };
    const v1 = {
      app: 'fee-tracker',
      schema_version: 1,
      exported_at: ts,
      data: {
        businesses: [{ id: 'b1', name: 'Old Co', phone: null, currency: 'PKR', language: 'en', reminder_template: null, ...t }],
        areas: [],
        customers: [{ id: 'c1', business_id: 'b1', area_id: null, name: 'Ali', phone: null, address: null,
          monthly_fee: 2000, start_date: '2026-10-01', status: 'active', notes: null, ...t }],
        monthly_dues: [{ id: 'x', customer_id: 'c1', month: '2026-10', fee_amount: 2000, carried_forward: 0,
          total_due: 2000, paid_amount: 500, status: 'partial', ...t }],
        payments: [{ id: 'p1', monthly_due_id: 'x', customer_id: 'c1', amount: 500, paid_on: '2026-10-03',
          method: 'cash', received_by: null, note: null, ...t }],
        fee_changes: [],
      },
    };
    await importBackup(db, parseBackup(v1));
    expect((await getActiveBusiness(db))?.name).toBe('Old Co');
    expect(await db.getFirstAsync('SELECT monthly_due_id FROM payments')).toEqual({ monthly_due_id: 'c1:2026-10' });
    expect((await listStaff(db, 'b1')).map((s) => s.role)).toEqual(['owner']);
  });
});

describe('sync change tracking', () => {
  it('records local writes only for businesses linked to the cloud', async () => {
    await createCustomer(db, businessId, base);
    expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);

    await db.runAsync('INSERT INTO sync_links (business_id) VALUES (?)', businessId);
    const id = await createCustomer(db, businessId, { ...base, name: 'Bilal' });
    const tables = await db.getAllAsync<{ tbl: string }>('SELECT DISTINCT tbl FROM sync_outbox ORDER BY tbl');
    expect(tables.map((r) => r.tbl)).toEqual(['customers', 'monthly_dues']);

    // Writes made while applying downloaded changes are not recorded.
    await db.runAsync('DELETE FROM sync_outbox');
    await db.runAsync('INSERT INTO sync_applying (flag) VALUES (1)');
    await db.runAsync("UPDATE customers SET name = 'B' WHERE id = ?", id);
    expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
  });
});
