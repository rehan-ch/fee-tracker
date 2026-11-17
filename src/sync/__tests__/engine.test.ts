/**
 * Two phones syncing through an in-memory server that follows the same
 * rules as the Supabase functions (supabase/migrations): last write wins by
 * updated_at, and a change feed ordered by server time.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  addPayment,
  createBusiness,
  createCustomer,
  customerDues,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from '../../db/repo';
import { migrateDbIfNeeded, scopeColumn, type SyncTable } from '../../db/schema';
import { createTestDatabase } from '../../db/testing/nodeSqlite';
import type { CustomerInput } from '../../db/types';
import { linkBusiness, pendingChanges, syncBusiness, type Cursor, type RemoteStore, type Row } from '../engine';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<{ randomUUID: () => string }>('crypto').randomUUID(),
}));

class FakeServer implements RemoteStore {
  tables = new Map<SyncTable, Map<string, { row: Row; ts: number }>>();
  private clock = 0;
  pushes = 0;

  private table(t: SyncTable) {
    let m = this.tables.get(t);
    if (!m) this.tables.set(t, (m = new Map()));
    return m;
  }

  async push(table: SyncTable, rows: Row[]) {
    this.pushes += rows.length;
    const t = this.table(table);
    for (const row of rows) {
      const existing = t.get(String(row.id));
      if (!existing || String(existing.row.updated_at) <= String(row.updated_at)) {
        t.set(String(row.id), { row: { ...row }, ts: ++this.clock });
      }
    }
  }

  async pull(table: SyncTable, businessId: string, since: Cursor | null, limit: number, overlap: boolean) {
    const key = (ts: number, id: string) => `${String(ts).padStart(8, '0')}|${id}`;
    const from = since ? key(Math.max(0, Number(since.ts) - (overlap ? 3 : 0)), overlap ? '' : since.id) : '';
    const rows = [...this.table(table).values()]
      .filter((e) => e.row[scopeColumn(table)] === businessId)
      .filter((e) => key(e.ts, String(e.row.id)) > from)
      .sort((a, b) => (key(a.ts, String(a.row.id)) < key(b.ts, String(b.row.id)) ? -1 : 1))
      .slice(0, limit);
    const last = rows[rows.length - 1];
    return {
      rows: rows.map((e) => ({ ...e.row, server_updated_at: String(e.ts) })),
      next: last ? { ts: String(last.ts), id: String(last.row.id) } : null,
    };
  }
}

const base: CustomerInput = {
  name: 'Ali Khan',
  phone: null,
  address: null,
  area_id: null,
  monthly_fee: 2000,
  start_date: '2026-11-01',
  status: 'active',
  notes: null,
};

let tick = 0;
/** Advance the fake clock so every write gets a later updated_at. */
function later() {
  tick += 1;
  jest.setSystemTime(new Date(2026, 10, 12, 10, 0, tick));
}

let server: FakeServer;
let a: SQLiteDatabase;
let b: SQLiteDatabase;
let bid: string;

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  later();
  server = new FakeServer();
  a = createTestDatabase();
  b = createTestDatabase();
  await migrateDbIfNeeded(a);
  await migrateDbIfNeeded(b);
  bid = await createBusiness(a, { name: 'City Cable', phone: null, language: 'en' });
});

/** Owner turns sync on with existing data; a second phone joins. */
async function connectBoth() {
  await linkBusiness(a, bid, true);
  await syncBusiness(a, server, bid);
  await linkBusiness(b, bid, false);
  await syncBusiness(b, server, bid);
}

describe('cloud sync', () => {
  it('a joining phone downloads the whole business', async () => {
    const id = await createCustomer(a, bid, base);
    await connectBoth();
    expect((await listCustomers(b, bid)).map((c) => c.name)).toEqual(['Ali Khan']);
    expect((await customerDues(b, id)).map((d) => [d.month, d.total_due])).toEqual([['2026-11', 2000]]);
    expect(await b.getFirstAsync("SELECT role FROM staff WHERE business_id = ?", bid)).toEqual({ role: 'owner' });
  });

  it('payments taken offline on two phones add up on both', async () => {
    const id = await createCustomer(a, bid, base);
    await connectBoth();
    const due = (await customerDues(a, id))[0];

    later();
    await addPayment(a, { monthly_due_id: due.id, amount: 1500, paid_on: '2026-11-05', method: 'cash', note: null });
    later();
    await addPayment(b, { monthly_due_id: due.id, amount: 500, paid_on: '2026-11-06', method: 'jazzcash', note: null });

    later();
    await syncBusiness(b, server, bid);
    later();
    await syncBusiness(a, server, bid);
    later();
    await syncBusiness(b, server, bid);

    for (const phone of [a, b]) {
      expect((await customerDues(phone, id))[0]).toMatchObject({ paid_amount: 2000, status: 'paid' });
      expect(await phone.getFirstAsync('SELECT COUNT(*) AS n FROM payments')).toEqual({ n: 2 });
    }
    expect(await pendingChanges(a, bid)).toBe(0);
    expect(await pendingChanges(b, bid)).toBe(0);

    // Settled: another round moves nothing back and forth.
    const before = server.pushes;
    await syncBusiness(a, server, bid);
    await syncBusiness(b, server, bid);
    expect(server.pushes).toBe(before);
  });

  it('the latest edit wins and deletes reach the other phone', async () => {
    const id = await createCustomer(a, bid, base);
    const other = await createCustomer(a, bid, { ...base, name: 'Bilal' });
    await connectBoth();

    later();
    await updateCustomer(a, id, { ...base, name: 'Ali (A)' });
    later();
    await updateCustomer(b, id, { ...base, name: 'Ali (B)' });
    later();
    await deleteCustomer(b, other);

    await syncBusiness(a, server, bid);
    await syncBusiness(b, server, bid);
    await syncBusiness(a, server, bid);

    for (const phone of [a, b]) {
      expect((await listCustomers(phone, bid)).map((c) => c.name)).toEqual(['Ali (B)']);
    }
  });

  it('nothing is queued for a business that is not linked', async () => {
    await createCustomer(a, bid, base);
    expect(await pendingChanges(a, bid)).toBe(0);
    await linkBusiness(a, bid, true);
    expect(await pendingChanges(a, bid)).toBeGreaterThan(0);
    await syncBusiness(a, server, bid);
    expect(await pendingChanges(a, bid)).toBe(0);
    expect(server.tables.get('customers')?.size).toBe(1);
  });
});
