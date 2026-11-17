/**
 * Security checks on the pure helpers: row validation for restored and
 * downloaded data, links from outside the app, PIN hashing, permissions and
 * export escaping. See SECURITY.md.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { strFromU8, unzipSync } from 'fflate';

import { isAllowedCloudUrl, isSecretSupabaseKey } from '../cloudKeys';
import { notificationTarget, safeIncomingPath } from '../deepLinks';
import { pbkdf2Sha256, sha256, toHex, utf8 } from '../pbkdf2';
import { can } from '../permissions';
import { hashPin, PIN_ITERATIONS, verifyPin } from '../pin';
import { cleanRow, isSafeId } from '../rowSchema';
import { smsUrl } from '../template';
import { buildXlsx } from '../xlsx';

/** The parts of Node's crypto module these tests compare against. */
interface MockNodeCrypto {
  createHash(alg: string): { update(data: string): { digest(enc: 'hex'): string } };
  pbkdf2Sync(password: string, salt: Uint8Array, iterations: number, len: number, alg: string): { toString(enc: 'hex'): string };
  randomBytes(n: number): Uint8Array;
}
const realCrypto = jest.requireActual<MockNodeCrypto>('crypto');
const sha256Hex = (data: string) => realCrypto.createHash('sha256').update(data).digest('hex');

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual<MockNodeCrypto>('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (n: number) => new Uint8Array(nodeCrypto.randomBytes(n)),
    digestStringAsync: async (_alg: string, data: string) => nodeCrypto.createHash('sha256').update(data).digest('hex'),
  };
});

const ts = '2026-11-01T00:00:00.000Z';
const customer = {
  id: 'c1',
  business_id: 'b1',
  area_id: null,
  name: 'Ali',
  phone: '0300-1234567',
  address: null,
  monthly_fee: 2000,
  start_date: '2026-11-01',
  status: 'active',
  notes: null,
  created_at: ts,
  updated_at: ts,
  deleted_at: null,
};

describe('row checks for restored and downloaded rows', () => {
  it('accepts a normal row and drops unknown columns', () => {
    expect(cleanRow('customers', { ...customer, server_updated_at: 'x', evil: 1 })).toEqual(customer);
    expect(cleanRow('monthly_dues', {
      id: 'c1:2026-11', business_id: 'b1', customer_id: 'c1', month: '2026-11', fee_amount: 2000,
      carried_forward: -500, total_due: 1500, paid_amount: 0, status: 'unpaid', created_at: ts, updated_at: ts,
      deleted_at: null,
    })).not.toBeNull();
  });

  it('refuses ids that could change a screen route', () => {
    for (const id of ['../staff/edit', 'a/b', 'x?id=1', '#top', '', ' c1', 'c'.repeat(101), 5]) {
      expect(isSafeId(id)).toBe(false);
      expect(cleanRow('customers', { ...customer, id })).toBeNull();
    }
    expect(cleanRow('payments', { id: 'p1', customer_id: '../cloud' })).toBeNull();
  });

  it('refuses wrong types, sizes, values and dates', () => {
    const bad: Record<string, unknown>[] = [
      { monthly_fee: '2000' },
      { monthly_fee: 1.5 },
      { monthly_fee: -1 },
      { monthly_fee: 10 ** 13 },
      { monthly_fee: Number.NaN },
      { name: 'x'.repeat(4001) },
      { name: null },
      { name: { toString: 'x' } },
      { status: 'deleted' },
      { start_date: '2026-02-30' },
      { start_date: '0001-01-01' },
      { start_date: 'soon' },
      { updated_at: '9999' },
      { deleted_at: 'yesterday' },
    ];
    for (const change of bad) expect(cleanRow('customers', { ...customer, ...change })).toBeNull();
    expect(cleanRow('businesses', { id: 'b1', language: 'xx' })).toBeNull();
    expect(cleanRow('staff', { id: 's1', role: 'admin' })).toBeNull();
    expect(cleanRow('payments', { id: 'p1', method: 'bitcoin' })).toBeNull();
    expect(cleanRow('customers', null)).toBeNull();
    expect(cleanRow('customers', [customer])).toBeNull();
  });
});

describe('links from outside the app', () => {
  it('opens only the main screens, with checked parameters', () => {
    expect(safeIncomingPath('feetracker://collection?tab=paid&month=2026-11')).toBe('/collection?tab=paid&month=2026-11');
    expect(safeIncomingPath('feetracker:///settings')).toBe('/settings');
    expect(safeIncomingPath('feetracker://collection?tab=evil&month=2026-13&x=1')).toBe('/collection');
    expect(safeIncomingPath('exp://192.168.1.5:8081/--/reports')).toBe('/reports');
    expect(safeIncomingPath('exp://192.168.1.5:8081')).toBe('/');
    expect(safeIncomingPath('feetracker://')).toBe('/');
  });

  it('sends everything else to Home', () => {
    for (const url of [
      'feetracker://staff/edit?id=s1',
      'feetracker://cloud',
      'feetracker://join',
      'feetracker://customer/c1/edit',
      'feetracker://receipt/p1',
      'feetracker://%2e%2e/cloud',
      'feetracker://collection%',
      'javascript:alert(1)',
      'https://evil.example/collection',
      '//evil.example/collection',
      42,
      null,
      `feetracker://collection?${'a'.repeat(3000)}`,
    ]) {
      expect(safeIncomingPath(url)).toBe('/');
    }
  });

  it('alert taps open only the unpaid list or reminders, rebuilt from checked parts', () => {
    expect(notificationTarget({ businessId: 'b1', url: '/collection?tab=unpaid&month=2026-11' })).toEqual({
      businessId: 'b1',
      url: '/collection?tab=unpaid&month=2026-11',
    });
    expect(notificationTarget({ businessId: 'b1', url: '/reminders?month=2026-11&evil=1' })).toEqual({
      businessId: 'b1',
      url: '/reminders?month=2026-11',
    });
    expect(notificationTarget({ businessId: '../x', url: '/collection?month=%E0%A4%A' })).toEqual({
      businessId: null,
      url: '/collection',
    });
    expect(notificationTarget({ url: '/staff/edit?id=s1' })).toBeNull();
    expect(notificationTarget({ url: 'https://evil.example' })).toBeNull();
    expect(notificationTarget('x')).toBeNull();
    expect(notificationTarget(undefined)).toBeNull();
  });
});

describe('PIN hashing', () => {
  it('PBKDF2 and SHA-256 match Node crypto', () => {
    const salt = realCrypto.randomBytes(16);
    for (const n of [1, 2, 50]) {
      expect(toHex(pbkdf2Sha256(utf8('fee-tracker:s1:1234'), salt, n))).toBe(
        realCrypto.pbkdf2Sync('fee-tracker:s1:1234', salt, n, 32, 'sha256').toString('hex'),
      );
    }
    const longKey = 'k'.repeat(100);
    expect(toHex(pbkdf2Sha256(utf8(longKey), salt, 3))).toBe(
      realCrypto.pbkdf2Sync(longKey, salt, 3, 32, 'sha256').toString('hex'),
    );
    expect(toHex(sha256(utf8('اردو'.repeat(40))))).toBe(sha256Hex('اردو'.repeat(40)));
  });

  it('stores a salted, slow hash that only the right PIN (and staff member) matches', async () => {
    const a = await hashPin('s1', '4321');
    const b = await hashPin('s1', '4321');
    expect(a).toMatch(new RegExp(`^pbkdf2-sha256\\$${PIN_ITERATIONS}\\$[0-9a-f]{32}\\$[0-9a-f]{64}$`));
    expect(a).not.toBe(b); // random salt per PIN
    expect(a).not.toContain('4321');
    expect(await verifyPin('s1', '4321', a)).toEqual({ ok: true, rehash: null });
    expect((await verifyPin('s1', '1234', a)).ok).toBe(false);
    expect((await verifyPin('s2', '4321', a)).ok).toBe(false);
    expect((await verifyPin('s1', '43210', a)).ok).toBe(false);
  });

  it('still accepts PINs saved by version 1.0 and upgrades them', async () => {
    const legacy = sha256Hex('fee-tracker:s1:2580');
    const check = await verifyPin('s1', '2580', legacy);
    expect(check.ok).toBe(true);
    expect(check.rehash).toMatch(/^pbkdf2-sha256\$/);
    expect((await verifyPin('s1', '2580', check.rehash as string)).ok).toBe(true);
    expect(await verifyPin('s1', '0000', legacy)).toEqual({ ok: false, rehash: null });
  });

  it('never matches a damaged or unknown hash', async () => {
    for (const stored of ['', 'x', 'pbkdf2-sha256$0$00$00', 'pbkdf2-sha256$99999999$00$00', 'pbkdf2-sha256$10$zz$00', 'plain:4321']) {
      expect((await verifyPin('s1', '4321', stored)).ok).toBe(false);
    }
    await expect(hashPin('s1', '12')).rejects.toThrow();
  });
});

describe('roles', () => {
  it('only the owner restores a backup (it replaces staff and removes PINs)', () => {
    expect(can('owner', 'backup.restore')).toBe(true);
    expect(can('manager', 'backup.restore')).toBe(false);
    expect(can('collector', 'backup.restore')).toBe(false);
    expect(can('manager', 'backup')).toBe(true);
    expect(can('collector', 'backup')).toBe(false);
  });
});

describe('outgoing links and exports', () => {
  it('SMS links carry only digits and one leading +', () => {
    expect(smsUrl('+92 300 1234567', 'Hi')).toBe('sms:+923001234567?body=Hi');
    expect(smsUrl('0300+123+4567', 'Hi')).toBe('sms:03001234567?body=Hi');
    // Text in the phone field can't add parameters: only its digits survive.
    expect(smsUrl('0300 1234567?body=x&to=9', 'a&b')).toBe('sms:030012345679?body=a%26b');
    expect(smsUrl('12345', 'Hi')).toBeNull();
    expect(smsUrl('1'.repeat(16), 'Hi')).toBeNull();
  });

  it('Excel cells keep formulas as text and drop characters XML forbids', () => {
    const file = unzipSync(buildXlsx([{ name: 'S\u0001heet', rows: [['=HYPERLINK("http://x")', 'a\u0000b\u0007c\uD800d']] }]));
    const sheet = strFromU8(file['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('=HYPERLINK(&quot;http://x&quot;)');
    expect(sheet).toContain('abcd');
    expect(strFromU8(file['xl/workbook.xml'])).toContain('name="Sheet"');
  });
});

describe('cloud settings built into the app', () => {
  const base64url = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${base64url(JSON.stringify(payload))}.sig`;

  it('refuses secret and service_role keys', () => {
    expect(isSecretSupabaseKey('sb_secret_abc123')).toBe(true);
    expect(isSecretSupabaseKey(jwt({ iss: 'supabase', role: 'service_role' }))).toBe(true);
    expect(isSecretSupabaseKey(jwt({ iss: 'supabase', role: 'anon' }))).toBe(false);
    expect(isSecretSupabaseKey('sb_publishable_abc123')).toBe(false);
  });

  it('needs an https server (http only for a local one in development)', () => {
    expect(isAllowedCloudUrl('https://abcd.supabase.co', false)).toBe(true);
    expect(isAllowedCloudUrl('http://abcd.supabase.co', false)).toBe(false);
    expect(isAllowedCloudUrl('http://127.0.0.1:54321', false)).toBe(false);
    expect(isAllowedCloudUrl('http://127.0.0.1:54321', true)).toBe(true);
    expect(isAllowedCloudUrl('https://user@evil.example', false)).toBe(false);
    expect(isAllowedCloudUrl('', true)).toBe(false);
  });
});
