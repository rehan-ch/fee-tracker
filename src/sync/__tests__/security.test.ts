/**
 * The sync engine must not trust what it downloads: rows are checked, only
 * the business being synced can change, and rows can't attach themselves to
 * another business on this phone.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createBusiness, createCustomer, customerDues, getCustomer } from '../../db/repo';
import { migrateDbIfNeeded, type SyncTable } from '../../db/schema';
import { createTestDatabase } from '../../db/testing/nodeSqlite';
import { linkBusiness, syncBusiness, type RemoteStore, type Row } from '../engine';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<{ randomUUID: () => string }>('crypto').randomUUID(),
}));

/** A server that answers every pull with the rows given for that table (once). */
class CraftedServer implements RemoteStore {
  constructor(private rows: Partial<Record<SyncTable, Row[]>>) {}
  async push() {}
  async pull(table: SyncTable) {
    const rows = this.rows[table] ?? [];
    this.rows[table] = [];
    const last = rows[rows.length - 1];
    return { rows, next: last ? { ts: '2026-11-12T10:00:00Z', id: String(last.id) } : null };
  }
}

const ts = '2026-11-12T09:00:00.000Z';
const later = '2026-11-12T11:00:00.000Z';
const stamps = { created_at: ts, updated_at: later, deleted_at: null };
const businessRow = (id: string, name: string): Row => ({
  id, name, phone: null, currency: 'PKR', language: 'en', reminder_template: null, payment_info: null,
  payment_link: null, ...stamps,
});
const customer = (id: string, businessId: string, name: string): Row => ({
  id, business_id: businessId, area_id: null, name, phone: null, address: null, monthly_fee: 1000,
  start_date: '2026-11-01', status: 'active', notes: null, ...stamps,
});

let db: SQLiteDatabase;
let mine: string;
let cloud: string;
let localCustomer: string;

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  jest.setSystemTime(new Date(2026, 10, 12, 10, 0, 0));
});
afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  db = createTestDatabase();
  await migrateDbIfNeeded(db);
  // The phone's own (offline) business, and a cloud business it joined.
  mine = await createBusiness(db, { name: 'My Shop', phone: null, language: 'en' });
  localCustomer = await createCustomer(db, mine, {
    name: 'Private Customer', phone: null, address: null, area_id: null, monthly_fee: 3000,
    start_date: '2026-11-01', status: 'active', notes: null,
  });
  cloud = 'cloud-biz';
  await linkBusiness(db, cloud, false);
});

describe('downloaded rows', () => {
  it('only change the business being synced', async () => {
    const server = new CraftedServer({
      businesses: [
        businessRow(cloud, 'Cloud Co'),
        // Same id as this phone's own business: must not be overwritten.
        businessRow(mine, 'Hijacked'),
      ],
      customers: [
        customer('c-cloud', cloud, 'Cloud Customer'),
        // A row claiming another business, and one reusing a local id.
        customer('c-other', mine, 'Injected'),
        { ...customer(localCustomer, cloud, 'Moved'), updated_at: '2099-01-01T00:00:00.000Z' },
      ],
    });
    const result = await syncBusiness(db, server, cloud);
    expect(result.rejected).toBe(2);
    expect((await db.getFirstAsync<{ name: string }>('SELECT name FROM businesses WHERE id = ?', mine))?.name).toBe('My Shop');
    expect(await getCustomer(db, 'c-other')).toBeNull();
    const kept = await getCustomer(db, localCustomer);
    expect(kept).toMatchObject({ name: 'Private Customer', business_id: mine });
    expect((await getCustomer(db, 'c-cloud'))?.business_id).toBe(cloud);
  });

  it('skip bad rows and keep the good ones (sync does not get stuck)', async () => {
    const server = new CraftedServer({
      businesses: [businessRow(cloud, 'Cloud Co'), { ...businessRow(cloud, 'Bad'), language: 'xx' }],
      customers: [
        customer('c-good', cloud, 'Good'),
        customer('../staff/edit', cloud, 'Path id'),
        { ...customer('c-big', cloud, 'x'.repeat(5000)) },
        { ...customer('c-type', cloud, 'Type'), monthly_fee: 'free' },
        { ...customer('c-date', cloud, 'Date'), start_date: '0001-01-01' },
      ],
    });
    const result = await syncBusiness(db, server, cloud);
    expect(result.rejected).toBe(5);
    expect(await db.getAllAsync("SELECT id FROM customers WHERE business_id = ?", cloud)).toEqual([{ id: 'c-good' }]);
  });

  it('can not attach payments to another business on this phone', async () => {
    const due = (await customerDues(db, localCustomer))[0];
    const server = new CraftedServer({
      payments: [
        {
          id: 'p-evil', business_id: cloud, monthly_due_id: due.id, customer_id: localCustomer, amount: 3000,
          paid_on: '2026-11-05', method: 'cash', received_by: null, note: null, ...stamps,
        },
      ],
    });
    const result = await syncBusiness(db, server, cloud);
    expect(result.rejected).toBe(1);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS n FROM payments')).toEqual({ n: 0 });
    expect((await customerDues(db, localCustomer))[0]).toMatchObject({ paid_amount: 0, status: 'unpaid' });
  });
});
