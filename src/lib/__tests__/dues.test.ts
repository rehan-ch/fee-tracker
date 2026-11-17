import { describe, expect, it } from '@jest/globals';

import { addMonths, isDayKey, monthRange } from '../date';
import { feeForMonth, monthsToGenerate, recalcChain, remainingOf, statusFor, type ChainDue } from '../dues';
import { formatAmount, formatMoney, parseAmount } from '../money';
import { isValidPhone, matchesSearch } from '../phone';

const due = (month: string, fee: number, paid: number): ChainDue => ({
  id: month,
  month,
  fee_amount: fee,
  carried_forward: 0,
  total_due: fee,
  paid_amount: paid,
  status: 'unpaid',
});

/** Apply recalcChain's changes back onto the list. */
function settle(dues: ChainDue[]): ChainDue[] {
  const changed = new Map(recalcChain(dues).map((d) => [d.id, d]));
  return dues.map((d) => changed.get(d.id) ?? d);
}

describe('date helpers', () => {
  it('adds months across year boundaries', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-03', -15)).toBe('2024-12');
  });

  it('builds inclusive month ranges', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthRange('2026-11', '2026-10')).toEqual([]);
  });

  it('validates day keys', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-2-3')).toBe(false);
  });
});

describe('money helpers', () => {
  it('formats with thousands separators', () => {
    expect(formatAmount(1500)).toBe('1,500');
    expect(formatAmount(1234567)).toBe('1,234,567');
    expect(formatAmount(-2000)).toBe('-2,000');
    expect(formatMoney(2000)).toBe('Rs 2,000');
  });

  it('parses whole-rupee input', () => {
    expect(parseAmount('1,500')).toBe(1500);
    expect(parseAmount(' 2000 ')).toBe(2000);
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('12.5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('phone helpers', () => {
  it('accepts common Pakistani formats', () => {
    expect(isValidPhone('0300-1234567')).toBe(true);
    expect(isValidPhone('+92 300 1234567')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
    expect(isValidPhone('call me')).toBe(false);
  });

  it('matches by name or digits', () => {
    expect(matchesSearch('ali', 'Ali Khan', null)).toBe(true);
    expect(matchesSearch('1234567', 'Ali', '0300-1234567')).toBe(true);
    expect(matchesSearch('0300 123', 'Ali', '0300-1234567')).toBe(true);
    expect(matchesSearch('999', 'Ali', '0300-1234567')).toBe(false);
    expect(matchesSearch('  ', 'Ali', null)).toBe(true);
  });
});

describe('statusFor', () => {
  it('compares paid with total due', () => {
    expect(statusFor(2000, 0)).toBe('unpaid');
    expect(statusFor(2000, 1500)).toBe('partial');
    expect(statusFor(2000, 2000)).toBe('paid');
    expect(statusFor(2000, 2500)).toBe('paid');
    // Fully covered by an earlier advance.
    expect(statusFor(-500, 0)).toBe('paid');
  });
});

describe('recalcChain', () => {
  it('carries unpaid balances forward', () => {
    const [sep, oct, nov] = settle([due('2026-09', 2000, 0), due('2026-10', 2000, 0), due('2026-11', 2000, 0)]);
    expect(sep).toMatchObject({ carried_forward: 0, total_due: 2000, status: 'unpaid' });
    expect(oct).toMatchObject({ carried_forward: 2000, total_due: 4000, status: 'unpaid' });
    expect(nov).toMatchObject({ carried_forward: 4000, total_due: 6000, status: 'unpaid' });
  });

  it('handles partial payments (1,500 of 2,000)', () => {
    const [a, b] = settle([due('2026-10', 2000, 1500), due('2026-11', 2000, 0)]);
    expect(a.status).toBe('partial');
    expect(remainingOf(a)).toBe(500);
    expect(b).toMatchObject({ carried_forward: 500, total_due: 2500 });
  });

  it('keeps an overpayment as advance for the next month', () => {
    const [a, b, c] = settle([due('2026-10', 2000, 4000), due('2026-11', 2000, 0), due('2026-12', 2000, 0)]);
    expect(a.status).toBe('paid');
    expect(b).toMatchObject({ carried_forward: -2000, total_due: 0, status: 'paid' });
    expect(c).toMatchObject({ carried_forward: 0, total_due: 2000, status: 'unpaid' });
  });

  it('returns only changed rows', () => {
    const settled = settle([due('2026-10', 2000, 0), due('2026-11', 2000, 0)]);
    expect(recalcChain(settled)).toEqual([]);
  });
});

describe('monthsToGenerate', () => {
  it('starts at the start month when there are no dues', () => {
    expect(monthsToGenerate('2026-09', null, '2026-11')).toEqual(['2026-09', '2026-10', '2026-11']);
  });
  it('continues after the last due', () => {
    expect(monthsToGenerate('2026-01', '2026-10', '2026-11')).toEqual(['2026-11']);
    expect(monthsToGenerate('2026-01', '2026-11', '2026-11')).toEqual([]);
  });
  it('generates nothing for a future start date', () => {
    expect(monthsToGenerate('2027-01', null, '2026-11')).toEqual([]);
  });
});

describe('feeForMonth', () => {
  const changes = [
    { effective_month: '2026-03', old_fee: 1500, new_fee: 2000 },
    { effective_month: '2026-08', old_fee: 2000, new_fee: 2500 },
  ];
  it('uses the fee that applied in that month', () => {
    expect(feeForMonth('2026-01', 2500, changes)).toBe(1500);
    expect(feeForMonth('2026-03', 2500, changes)).toBe(2000);
    expect(feeForMonth('2026-07', 2500, changes)).toBe(2000);
    expect(feeForMonth('2026-08', 2500, changes)).toBe(2500);
    expect(feeForMonth('2026-12', 2500, [])).toBe(2500);
  });
});
