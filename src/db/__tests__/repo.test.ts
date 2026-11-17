/**
 * End-to-end tests of the monthly logic against a real SQLite database,
 * using the same repository functions the screens call.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { exportBackup, importBackup, parseBackup } from '../../lib/backup';
import {
  addPayment,
  createArea,
  createBusiness,
  createCustomer,
  customerDues,
  deleteAllData,
  deleteCustomer,
  deletePayment,
  ensureAllDues,
  getBusiness,
  listCustomers,
  listDuesForMonth,
  monthSummary,
  updateCustomer,
  yearByArea,
  yearByMethod,
  yearByMonth,
} from '../repo';
import { migrateDbIfNeeded } from '../schema';
import { createTestDatabase } from '../testing/nodeSqlite';
import type { CustomerInput, MonthlyDue } from '../types';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<{ randomUUID: () => string }>('crypto').randomUUID(),
}));

/** Pretend today is the given local date. */
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

async function pay(due: MonthlyDue, amount: number, paidOn = '2026-11-05') {
  await addPayment(db, {
    monthly_due_id: due.id,
    amount,
    paid_on: paidOn,
    method: 'cash',
    note: null,
  });
}

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
  await createBusiness(db, { name: 'City Cable', phone: null, language: 'en' });
  businessId = (await getBusiness(db))!.id;
});

describe('creating customers', () => {
  it('creates a due for every month from the start month to now, carrying balances', async () => {
    const id = await createCustomer(db, businessId, base);
    const d = await dues(id);
    expect(Object.keys(d).sort()).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(d['2026-09']).toMatchObject({ fee_amount: 2000, carried_forward: 0, total_due: 2000, status: 'unpaid' });
    expect(d['2026-10']).toMatchObject({ carried_forward: 2000, total_due: 4000 });
    expect(d['2026-11']).toMatchObject({ carried_forward: 4000, total_due: 6000 });
  });

  it('creates no dues for a future start date', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2027-01-01' });
    expect(await customerDues(db, id)).toEqual([]);
  });
});

describe('payments', () => {
  it('marks paid in one tap and moves the customer to the Paid list', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    let d = await dues(id);
    await pay(d['2026-11'], 2000);
    d = await dues(id);
    expect(d['2026-11']).toMatchObject({ paid_amount: 2000, status: 'paid' });
    const list = await listDuesForMonth(db, businessId, '2026-11');
    expect(list.map((r) => [r.customer_name, r.status, r.last_paid_on])).toEqual([
      ['Ali Khan', 'paid', '2026-11-05'],
    ]);
  });

  it('records partial payments and carries the rest', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-10-01' });
    let d = await dues(id);
    await pay(d['2026-10'], 1500);
    d = await dues(id);
    expect(d['2026-10']).toMatchObject({ paid_amount: 1500, status: 'partial' });
    expect(d['2026-11']).toMatchObject({ carried_forward: 500, total_due: 2500, status: 'unpaid' });
  });

  it('a late payment for an earlier month updates later months', async () => {
    const id = await createCustomer(db, businessId, base);
    let d = await dues(id);
    await pay(d['2026-09'], 2000);
    d = await dues(id);
    expect(d['2026-09'].status).toBe('paid');
    expect(d['2026-10']).toMatchObject({ carried_forward: 0, total_due: 2000 });
    expect(d['2026-11']).toMatchObject({ carried_forward: 2000, total_due: 4000 });
  });

  it('paying the full current total clears the balance', async () => {
    const id = await createCustomer(db, businessId, base);
    let d = await dues(id);
    await pay(d['2026-11'], 6000);
    d = await dues(id);
    expect(d['2026-11'].status).toBe('paid');
    const [row] = await listCustomers(db, businessId);
    expect(row.balance).toBe(0);
  });

  it('deleting a payment restores the balance', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    let d = await dues(id);
    await pay(d['2026-11'], 2000);
    const p = await db.getFirstAsync<{ id: string }>('SELECT id FROM payments');
    await deletePayment(db, p!.id);
    d = await dues(id);
    expect(d['2026-11']).toMatchObject({ paid_amount: 0, status: 'unpaid' });
  });

  it('an overpayment becomes advance for the next month', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    let d = await dues(id);
    await pay(d['2026-11'], 4000);
    setToday(2026, 12, 2);
    await ensureAllDues(db);
    d = await dues(id);
    expect(d['2026-12']).toMatchObject({ carried_forward: -2000, total_due: 0, status: 'paid' });
  });
});

describe('new month', () => {
  it('creates the missing months when the app is opened later', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    setToday(2027, 1, 3);
    await ensureAllDues(db);
    const d = await dues(id);
    expect(Object.keys(d).sort()).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(d['2027-01']).toMatchObject({ carried_forward: 4000, total_due: 6000 });
    // Running it again changes nothing.
    await ensureAllDues(db);
    expect(Object.keys(await dues(id))).toHaveLength(3);
  });
});

describe('editing customers', () => {
  it('editing other fields never changes the fee', async () => {
    const id = await createCustomer(db, businessId, base);
    await updateCustomer(db, id, { ...base, name: 'Ali K', monthly_fee: 9999 } as CustomerInput);
    expect((await dues(id))['2026-11'].fee_amount).toBe(2000);
    expect((await listCustomers(db, businessId))[0]).toMatchObject({ name: 'Ali K', monthly_fee: 2000 });
  });

  it('inactive customers stop getting dues and restart from the reactivation month', async () => {
    const id = await createCustomer(db, businessId, base);
    await updateCustomer(db, id, { ...base, status: 'inactive' });
    let d = await dues(id);
    expect(Object.keys(d).sort()).toEqual(['2026-09', '2026-10']);
    expect((await monthSummary(db, businessId, '2026-11')).counts.unpaid).toBe(0);

    setToday(2027, 2, 10);
    await ensureAllDues(db);
    expect(Object.keys(await dues(id)).sort()).toEqual(['2026-09', '2026-10']);

    await updateCustomer(db, id, { ...base, status: 'active' });
    d = await dues(id);
    expect(Object.keys(d).sort()).toEqual(['2026-09', '2026-10', '2027-02']);
    // The old unpaid balance is still owed.
    expect(d['2027-02']).toMatchObject({ carried_forward: 4000, total_due: 6000 });
  });

  it('keeps the current month due when money was already received before deactivating', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    await pay((await dues(id))['2026-11'], 1000);
    await updateCustomer(db, id, { ...base, start_date: '2026-11-01', status: 'inactive' });
    expect((await dues(id))['2026-11']).toMatchObject({ paid_amount: 1000, status: 'partial' });
  });

  it('moving the start date earlier adds months; later removes unpaid ones', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-10-01' });
    await updateCustomer(db, id, { ...base, start_date: '2026-08-01' });
    expect(Object.keys(await dues(id)).sort()).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    await updateCustomer(db, id, { ...base, start_date: '2026-10-01' });
    const d = await dues(id);
    expect(Object.keys(d).sort()).toEqual(['2026-10', '2026-11']);
    expect(d['2026-10']).toMatchObject({ carried_forward: 0, total_due: 2000 });
  });

  it('deleting a customer removes them from lists and totals', async () => {
    const id = await createCustomer(db, businessId, base);
    await deleteCustomer(db, id);
    expect(await listCustomers(db, businessId)).toEqual([]);
    expect(await listDuesForMonth(db, businessId, '2026-11')).toEqual([]);
    expect((await monthSummary(db, businessId, '2026-11')).expected).toBe(0);
  });
});

describe('dashboard, filters and reports', () => {
  it('summarises the month', async () => {
    const a = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01' });
    const b = await createCustomer(db, businessId, { ...base, name: 'Bilal', start_date: '2026-11-01', monthly_fee: 1500 });
    await createCustomer(db, businessId, { ...base, name: 'Sana', start_date: '2026-11-01', monthly_fee: 1000 });
    await pay((await dues(a))['2026-11'], 2000);
    await pay((await dues(b))['2026-11'], 500);
    const s = await monthSummary(db, businessId, '2026-11');
    expect(s).toEqual({
      expected: 4500,
      carried: 0,
      collected: 2500,
      pending: 2000,
      counts: { unpaid: 1, partial: 1, paid: 1 },
    });
  });

  it('filters by area and by payment date', async () => {
    const areaId = await createArea(db, businessId, 'Block A');
    const a = await createCustomer(db, businessId, { ...base, start_date: '2026-11-01', area_id: areaId });
    await createCustomer(db, businessId, { ...base, name: 'Bilal', start_date: '2026-11-01' });
    await pay((await dues(a))['2026-11'], 2000, '2026-11-03');

    expect((await listDuesForMonth(db, businessId, '2026-11', { areaId })).map((r) => r.customer_name)).toEqual(['Ali Khan']);
    expect((await listDuesForMonth(db, businessId, '2026-11', { areaId: 'none' })).map((r) => r.customer_name)).toEqual(['Bilal']);
    expect(await listDuesForMonth(db, businessId, '2026-11', { paidOn: '2026-11-03' })).toHaveLength(1);
    expect(await listDuesForMonth(db, businessId, '2026-11', { paidOn: '2026-11-04' })).toHaveLength(0);
  });

  it('reports by month, method and area', async () => {
    const id = await createCustomer(db, businessId, { ...base, start_date: '2026-10-01' });
    const d = await dues(id);
    await pay(d['2026-10'], 2000);
    await addPayment(db, { monthly_due_id: d['2026-11'].id, amount: 1000, paid_on: '2026-11-02', method: 'jazzcash', note: null });
    expect(await yearByMonth(db, businessId, 2026)).toEqual([
      { month: '2026-10', billed: 2000, collected: 2000, pending: 0 },
      { month: '2026-11', billed: 2000, collected: 1000, pending: 1000 },
    ]);
    expect(await yearByMethod(db, businessId, 2026)).toEqual([
      { method: 'cash', total: 2000, count: 1 },
      { method: 'jazzcash', total: 1000, count: 1 },
    ]);
    expect(await yearByArea(db, businessId, 2026)).toEqual([
      { area_id: null, area_name: null, customers: 1, billed: 4000, collected: 3000, pending: 1000 },
    ]);
  });
});

describe('backup and restore', () => {
  it('round-trips all data through a backup file', async () => {
    const areaId = await createArea(db, businessId, 'Block A');
    const id = await createCustomer(db, businessId, { ...base, area_id: areaId });
    await pay((await dues(id))['2026-11'], 3000);
    const json = JSON.stringify(await exportBackup(db));

    await deleteAllData(db);
    expect(await getBusiness(db)).toBeNull();

    await importBackup(db, parseBackup(JSON.parse(json)));
    expect((await getBusiness(db))?.name).toBe('City Cable');
    const d = await dues(id);
    expect(d['2026-11']).toMatchObject({ paid_amount: 3000, status: 'partial', total_due: 6000 });
    expect((await listCustomers(db, businessId))[0].area_name).toBe('Block A');
  });

  it('a failed restore leaves existing data untouched', async () => {
    await createCustomer(db, businessId, base);
    const backup = await exportBackup(db);
    // A payment pointing at a due that does not exist breaks a foreign key.
    backup.data.payments.push({
      id: 'p1', monthly_due_id: 'missing', customer_id: 'missing', amount: 1, paid_on: '2026-11-01',
      method: 'cash', received_by: null, note: null, created_at: 'x', updated_at: 'x', deleted_at: null,
    });
    await expect(importBackup(db, backup)).rejects.toThrow();
    expect(await listCustomers(db, businessId)).toHaveLength(1);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup({})).toThrow();
    expect(() => parseBackup({ app: 'fee-tracker', schema_version: 1, data: {} })).toThrow();
    expect(() => parseBackup({ app: 'other', schema_version: 1, data: {} })).toThrow();
    expect(() =>
      parseBackup({ app: 'fee-tracker', schema_version: 99, data: {} }),
    ).toThrow(expect.objectContaining({ kind: 'newer' }));
  });
});
