/**
 * Security checks on the database code: what a backup file contains and
 * accepts, and that deleting really removes personal details.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { exportBackup, importBackup, parseBackup, type BackupFile } from '../../lib/backup';
import {
  addPayment,
  createBusiness,
  createCustomer,
  createStaff,
  customerDues,
  deleteAllData,
  deleteBusiness,
  deleteCustomer,
  deletePayment,
  deleteStaff,
  listCustomers,
  setStaffInvite,
  setStaffPin,
} from '../repo';
import { migrateDbIfNeeded } from '../schema';
import { createTestDatabase } from '../testing/nodeSqlite';
import type { CustomerInput } from '../types';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<{ randomUUID: () => string }>('crypto').randomUUID(),
}));

let db: SQLiteDatabase;
let businessId: string;

const base: CustomerInput = {
  name: 'Ali Khan',
  phone: '0300-1234567',
  address: 'House 5, Street 2',
  area_id: null,
  monthly_fee: 2000,
  start_date: '2026-11-01',
  status: 'active',
  notes: 'Gate code 1234',
};

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
  businessId = await createBusiness(db, { name: 'City Cable', phone: '0300-7654321', language: 'en' });
});

const count = async (sql: string, ...params: string[]) =>
  (await db.getFirstAsync<{ n: number }>(sql, ...params))?.n ?? 0;

describe('backups', () => {
  it('never contain or restore invite codes', async () => {
    const staffId = await createStaff(db, businessId, { name: 'Imran', phone: null, role: 'collector' });
    await setStaffInvite(db, staffId, 'ABCD2345');
    const backup = await exportBackup(db);
    expect(JSON.stringify(backup)).not.toContain('ABCD2345');

    const crafted = JSON.parse(JSON.stringify(backup)) as BackupFile;
    crafted.data.staff = crafted.data.staff.map((s) => ({ ...s, invite_code: 'EVIL2345' }));
    await importBackup(db, parseBackup(crafted));
    expect(await count("SELECT COUNT(*) AS n FROM staff WHERE invite_code IS NOT NULL")).toBe(0);
  });

  it('a file with one bad row is refused and changes nothing', async () => {
    await createCustomer(db, businessId, base);
    const good = await exportBackup(db);
    const variants: ((b: BackupFile) => void)[] = [
      (b) => (b.data.customers[0].id = '../staff/edit'),
      (b) => (b.data.customers[0].name = 'x'.repeat(5000)),
      (b) => (b.data.customers[0].monthly_fee = '2000'),
      (b) => (b.data.customers[0].start_date = '0001-01-01'),
      (b) => (b.data.businesses[0].language = 'xx'),
      (b) => (b.data.monthly_dues[0].paid_amount = -5),
      (b) => ((b.data.customers as unknown[]).push('not a row')),
    ];
    for (const change of variants) {
      const bad = JSON.parse(JSON.stringify(good)) as BackupFile;
      change(bad);
      expect(() => parseBackup(bad)).toThrow();
      // Even if a caller skipped parseBackup, the import itself refuses it.
      await expect(importBackup(db, bad)).rejects.toThrow();
      expect((await listCustomers(db, businessId)).map((c) => c.name)).toEqual(['Ali Khan']);
    }
  });

  it('restoring removes PINs set on this phone (so only the owner may restore)', async () => {
    const staffId = await createStaff(db, businessId, { name: 'Imran', phone: null, role: 'collector' });
    const backup = await exportBackup(db);
    await setStaffPin(db, staffId, 'pbkdf2-sha256$1$00$00');
    await importBackup(db, parseBackup(JSON.parse(JSON.stringify(backup))));
    expect(await count('SELECT COUNT(*) AS n FROM staff_pins')).toBe(0);
  });
});

describe('deleting removes personal details', () => {
  it('a deleted customer keeps no name, phone, address or notes', async () => {
    const id = await createCustomer(db, businessId, base);
    const due = (await customerDues(db, id))[0];
    const paymentId = await addPayment(db, {
      monthly_due_id: due.id, amount: 500, paid_on: '2026-11-05', method: 'cash', note: 'paid by brother Bilal',
    });
    await deleteCustomer(db, id);
    expect(await db.getFirstAsync('SELECT name, phone, address, notes FROM customers WHERE id = ?', id)).toEqual({
      name: '', phone: null, address: null, notes: null,
    });
    expect(await db.getFirstAsync('SELECT note, deleted_at IS NOT NULL AS gone FROM payments WHERE id = ?', paymentId))
      .toEqual({ note: null, gone: 1 });
  });

  it('a deleted payment loses its note; a removed staff member their phone', async () => {
    const id = await createCustomer(db, businessId, base);
    const due = (await customerDues(db, id))[0];
    const paymentId = await addPayment(db, {
      monthly_due_id: due.id, amount: 500, paid_on: '2026-11-05', method: 'cash', note: 'private note',
    });
    await deletePayment(db, paymentId);
    expect(await db.getFirstAsync('SELECT note FROM payments WHERE id = ?', paymentId)).toEqual({ note: null });

    const staffId = await createStaff(db, businessId, { name: 'Imran', phone: '0311-2223334', role: 'collector' });
    await setStaffInvite(db, staffId, 'ABCD2345');
    await deleteStaff(db, staffId);
    expect(await db.getFirstAsync('SELECT name, phone, invite_code FROM staff WHERE id = ?', staffId)).toEqual({
      name: 'Imran', phone: null, invite_code: null,
    });
  });

  it('a deleted business keeps no customer or business details, PINs or settings', async () => {
    const other = await createBusiness(db, { name: 'Second', phone: null, language: 'en' });
    await createCustomer(db, businessId, base);
    const staffId = await createStaff(db, businessId, { name: 'Imran', phone: '0311-2223334', role: 'collector' });
    await setStaffPin(db, staffId, 'pbkdf2-sha256$1$00$00');
    await db.runAsync("INSERT INTO app_meta (key, value) VALUES ('alerts:' || ?, '{}')", businessId);
    await deleteBusiness(db, businessId);
    expect(await count("SELECT COUNT(*) AS n FROM customers WHERE name <> '' OR phone IS NOT NULL OR address IS NOT NULL OR notes IS NOT NULL")).toBe(0);
    expect(await db.getFirstAsync('SELECT name, phone FROM businesses WHERE id = ?', businessId)).toEqual({ name: '', phone: null });
    expect(await count('SELECT COUNT(*) AS n FROM staff WHERE phone IS NOT NULL AND business_id = ?', businessId)).toBe(0);
    expect(await count('SELECT COUNT(*) AS n FROM staff_pins')).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM app_meta WHERE key = 'alerts:' || ?", businessId)).toBe(0);
    expect(await db.getFirstAsync('SELECT name FROM businesses WHERE id = ?', other)).toEqual({ name: 'Second' });
  });

  it('delete all data leaves every table empty', async () => {
    const id = await createCustomer(db, businessId, base);
    const due = (await customerDues(db, id))[0];
    await addPayment(db, { monthly_due_id: due.id, amount: 500, paid_on: '2026-11-05', method: 'cash', note: null });
    await db.runAsync('INSERT INTO sync_links (business_id) VALUES (?)', businessId);
    await deleteAllData(db);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const { name } of tables) expect([name, await count(`SELECT COUNT(*) AS n FROM ${name}`)]).toEqual([name, 0]);
  });
});
