import { describe, expect, it } from '@jest/globals';
import { strFromU8, unzipSync } from 'fflate';

import { DEFAULT_ALERTS, parseAlerts, upcomingAlerts } from '../alerts';
import { baseFee, feeForMonth, rebuildFeeSteps } from '../dues';
import { esc } from '../html';
import { can } from '../permissions';
import { toInternational } from '../phone';
import { receiptNumber } from '../receipt';
import { fillTemplate, isValidLink, paymentBlock, smsUrl, whatsappUrl, DEFAULT_TEMPLATES } from '../template';
import { buildXlsx, colName } from '../xlsx';

describe('phone numbers for WhatsApp', () => {
  it('turns Pakistani local numbers into international ones', () => {
    expect(toInternational('0300-1234567')).toBe('923001234567');
    expect(toInternational('+92 300 1234567')).toBe('923001234567');
    expect(toInternational('0092 300 1234567')).toBe('923001234567');
    expect(toInternational('3001234567')).toBe('923001234567');
    expect(toInternational('+44 7700 900123')).toBe('447700900123');
    expect(toInternational('123')).toBeNull();
    expect(toInternational(null)).toBeNull();
  });
});

describe('reminder messages', () => {
  const values = {
    name: 'Ali',
    amount: 'Rs 2,000',
    month: 'November 2026',
    business: 'City Cable',
    phone: '0300',
    payment: '',
  };

  it('fills placeholders and drops the empty payment line', () => {
    expect(fillTemplate(DEFAULT_TEMPLATES.en, values)).toBe(
      'Assalam-o-Alaikum Ali,\nThis is a reminder that your November 2026 fee of Rs 2,000 for City Cable is due. ' +
        'Please pay at your earliest convenience.\n\nThank you!',
    );
    const withPay = fillTemplate('{name}: {amount}\n{payment}', {
      ...values,
      payment: paymentBlock('JazzCash 0300', 'https://pay.example/x', 'Pay online'),
    });
    expect(withPay).toBe('Ali: Rs 2,000\nJazzCash 0300\nPay online: https://pay.example/x');
  });

  it('builds WhatsApp and SMS links', () => {
    expect(whatsappUrl('0300-1234567', 'Hi & bye', '92')).toBe('https://wa.me/923001234567?text=Hi%20%26%20bye');
    expect(whatsappUrl('', 'x', '92')).toBeNull();
    expect(smsUrl('0300-1234567', 'Hi')).toBe('sms:03001234567?body=Hi');
    expect(isValidLink('https://jazzcash.com.pk/pay/123')).toBe(true);
    expect(isValidLink('javascript:alert(1)')).toBe(false);
  });
});

describe('fee history chain', () => {
  it('drops no-op steps and links old fees', () => {
    const { steps, latestFee } = rebuildFeeSteps(
      1000,
      new Map([
        ['2026-06', 1500],
        ['2026-03', 1000],
        ['2026-09', 2000],
      ]),
    );
    expect(steps).toEqual([
      { effective_month: '2026-06', old_fee: 1000, new_fee: 1500 },
      { effective_month: '2026-09', old_fee: 1500, new_fee: 2000 },
    ]);
    expect(latestFee).toBe(2000);
    expect(baseFee(2000, steps)).toBe(1000);
    expect(feeForMonth('2026-07', latestFee, steps)).toBe(1500);
  });
});

describe('Excel export', () => {
  it('writes a valid workbook with text, numbers and escaped characters', () => {
    expect([colName(0), colName(25), colName(26), colName(701)]).toEqual(['A', 'Z', 'AA', 'ZZ']);
    const bytes = buildXlsx([
      { name: 'By month', rows: [['Month', 'Collected'], ['Nov <2026>', 1500], ['Total', null]] },
      { name: 'By month', rows: [['x']] },
    ]);
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<c r="B2"><v>1500</v></c>');
    expect(sheet).toContain('Nov &lt;2026&gt;');
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr">');
    // Duplicate sheet names are made unique.
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="By month 2"');
  });
});

describe('owner alerts', () => {
  it('lists upcoming alerts this month and next, skipping past ones', () => {
    const s = {
      summary: { enabled: true, day: 10, hour: 10, minute: 0 },
      reminders: { enabled: true, days: [5, 31], hour: 9, minute: 30 },
    };
    const now = new Date(2026, 10, 12, 8, 0); // 12 Nov 2026
    const list = upcomingAlerts(s, now, 1, true).map((a) => `${a.kind}@${a.date.getMonth() + 1}/${a.date.getDate()}`);
    // 31 Nov doesn't exist: it falls on the 30th.
    expect(list).toEqual(['reminders@11/30', 'reminders@12/5', 'summary@12/10', 'reminders@12/31']);
    expect(upcomingAlerts(s, now, 1, false).every((a) => a.kind === 'summary')).toBe(true);
    expect(parseAlerts('not json')).toEqual(DEFAULT_ALERTS);
    expect(parseAlerts(JSON.stringify({ summary: { enabled: true } })).summary).toMatchObject({ enabled: true, day: 10 });
  });
});

describe('roles', () => {
  it('limits collectors and managers', () => {
    expect(can('owner', 'staff.manage')).toBe(true);
    expect(can('manager', 'customers.edit')).toBe(true);
    expect(can('manager', 'staff.manage')).toBe(false);
    expect(can('collector', 'payments.add')).toBe(true);
    expect(can('collector', 'customers.edit')).toBe(false);
    expect(can('collector', 'payments.delete')).toBe(false);
  });
});

describe('receipts', () => {
  it('numbers and escapes', () => {
    expect(receiptNumber('3f2a9c1b-1111-2222')).toBe('R-3F2A9C1B');
    expect(esc(`<b>"Ali's"</b> & co`)).toBe('&lt;b&gt;&quot;Ali&#39;s&quot;&lt;/b&gt; &amp; co');
  });
});
