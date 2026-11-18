/**
 * Payment proof screenshots: linked to one payment, never written into
 * backups, and removed with the payment, the customer or all data.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { exportBackup } from '../../lib/backup';
import {
  addPayment,
  clearPaymentProof,
  createBusiness,
  createCustomer,
  customerDues,
  customerPayments,
  deleteAllData,
  deleteCustomer,
  deletePayment,
  getBusiness,
  listProofFiles,
  setPaymentProof,
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
  address: null,
  area_id: null,
  monthly_fee: 2000,
  start_date: '2026-09-15',
  status: 'active',
  notes: null,
};

/** A customer with one November payment; returns the payment id. */
async function paidCustomer(name: string): Promise<string> {
  const customerId = await createCustomer(db, businessId, { ...base, name });
  const due = (await customerDues(db, customerId)).find((d) => d.month === '2026-11')!;
  return addPayment(db, { monthly_due_id: due.id, amount: 2000, paid_on: '2026-11-05', method: 'jazzcash', note: null });
}

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  jest.setSystemTime(new Date(2026, 10, 12, 10, 0, 0));
  db = createTestDatabase();
  await migrateDbIfNeeded(db);
  await createBusiness(db, { name: 'City Cable', phone: null, language: 'en' });
  businessId = (await getBusiness(db))!.id;
});

describe('payment proofs', () => {
  it('links one file to a payment, replaces it, and drops it with the payment', async () => {
    const paymentId = await paidCustomer('Ali Khan');
    expect(await setPaymentProof(db, paymentId, 'a.jpg')).toBeNull();
    const [row] = await customerPayments(db, await rowCustomer(paymentId));
    expect(row.proof_file).toBe('a.jpg');

    expect(await setPaymentProof(db, paymentId, 'b.png')).toBe('a.jpg');
    expect(await listProofFiles(db)).toEqual(['b.png']);

    expect(await clearPaymentProof(db, paymentId)).toBe('b.png');
    expect(await clearPaymentProof(db, paymentId)).toBeNull();
    expect(await listProofFiles(db)).toEqual([]);

    await setPaymentProof(db, paymentId, 'c.jpg');
    await deletePayment(db, paymentId);
    expect(await listProofFiles(db)).toEqual([]);
    await expect(setPaymentProof(db, paymentId, 'd.jpg')).rejects.toThrow();
  });

  it('never writes proofs into a backup', async () => {
    const paymentId = await paidCustomer('Ali Khan');
    await setPaymentProof(db, paymentId, 'secret-screenshot.jpg');
    const backup = await exportBackup(db);
    expect(Object.keys(backup.data)).not.toContain('payment_proofs');
    expect(JSON.stringify(backup)).not.toContain('secret-screenshot');
  });

  it('removes proofs with the customer and with all data', async () => {
    const first = await paidCustomer('Ali Khan');
    await setPaymentProof(db, first, 'first.jpg');
    await deleteCustomer(db, await rowCustomer(first));
    expect(await listProofFiles(db)).toEqual([]);

    const second = await paidCustomer('Bilal');
    await setPaymentProof(db, second, 'second.jpg');
    expect(await listProofFiles(db)).toEqual(['second.jpg']);
    await deleteAllData(db);
    expect(await listProofFiles(db)).toEqual([]);
  });
});

/** The customer a payment belongs to. */
async function rowCustomer(paymentId: string): Promise<string> {
  const row = await db.getFirstAsync<{ customer_id: string }>('SELECT customer_id FROM payments WHERE id = ?', paymentId);
  return row!.customer_id;
}
