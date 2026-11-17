/**
 * Monthly and yearly collection reports, exported as PDF (expo-print) or
 * Excel (.xlsx), then shared through the Android share sheet.
 */
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  listDuesForMonth,
  monthSummary,
  reportByArea,
  reportByCollector,
  reportByMethod,
  yearByMonth,
  type Period,
} from '../db/repo';
import type { Business, PaymentMethod } from '../db/types';
import type { StringKey } from '../i18n/strings';
import type { TFunction } from '../state/app';
import { todayKey } from './date';
import type { DueStatus } from './dues';
import { esc, htmlPage } from './html';
import { buildXlsx, type XCell, type XSheet } from './xlsx';

export interface ReportFormat {
  t: TFunction;
  rtl: boolean;
  money: (n: number) => string;
  monthLabel: (m: string) => string;
  dateLabel: (d: string) => string;
  methodLabel: (m: PaymentMethod) => string;
  staffLabel: (name: string | null, role: string | null) => string;
}

interface Table {
  title: string;
  head: string[];
  /** Index of columns holding money amounts (right-aligned, formatted in PDF). */
  money: number[];
  rows: XCell[][];
  total?: XCell[];
  // PDF presentation only (the Excel file ignores these):
  /** Text columns kept left to right, e.g. phone numbers. */
  ltr?: number[];
  /** Column showing the due status word, coloured by `statuses`. */
  statusColumn?: number;
  /** Status of each row, same order as `rows`. */
  statuses?: DueStatus[];
}

/** Status tone of a KPI card in the PDF. */
type CardTone = DueStatus | null;

interface Report {
  title: string;
  subtitle: string;
  cards: [string, string][];
  tables: Table[];
  // PDF presentation only (the Excel file uses title, subtitle, cards and tables):
  header?: { business: string; name: string; period: string; generated: string };
  /** Tone of each card, same order as `cards`. */
  cardTones?: CardTone[];
}

/** Build the report data once; render it to PDF or Excel. */
export async function buildReport(
  db: SQLiteDatabase,
  business: Business,
  period: Period,
  f: ReportFormat,
  withCollectors: boolean,
): Promise<Report> {
  const { t } = f;
  const tables: Table[] = [];
  let cards: [string, string][];
  let cardTones: CardTone[];
  const periodName = typeof period === 'number' ? String(period) : f.monthLabel(period);

  if (typeof period === 'number') {
    const months = await yearByMonth(db, business.id, period);
    const billed = months.reduce((s, m) => s + m.billed, 0);
    const collected = months.reduce((s, m) => s + m.collected, 0);
    const pending = months.length ? months[months.length - 1].pending : 0;
    cards = [
      [t('feesBilled'), f.money(billed)],
      [t('collected'), f.money(collected)],
      [t('pendingNow'), f.money(pending)],
    ];
    cardTones = [null, 'paid', 'unpaid'];
    tables.push({
      title: t('byMonth'),
      head: [t('month'), t('feesBilled'), t('collected'), t('pending')],
      money: [1, 2, 3],
      rows: months.map((m) => [f.monthLabel(m.month), m.billed, m.collected, m.pending]),
      total: [t('total'), billed, collected, null],
    });
  } else {
    const s = await monthSummary(db, business.id, period);
    cards = [
      [t('expected'), f.money(s.expected)],
      [t('collected'), f.money(s.collected)],
      [t('pending'), f.money(s.pending)],
      [t('moneyNotPaidLabel'), String(s.counts.unpaid + s.counts.partial)],
    ];
    cardTones = [null, 'paid', 'unpaid', null];
    const dues = await listDuesForMonth(db, business.id, period);
    tables.push({
      title: t('customersTitle'),
      head: [
        t('customerName'),
        t('phone'),
        t('area'),
        t('monthlyFee'),
        t('carriedShort'),
        t('totalDue'),
        t('paid'),
        t('remaining'),
        t('status'),
        t('lastPaid'),
      ],
      money: [3, 4, 5, 6, 7],
      ltr: [1],
      statusColumn: 8,
      statuses: dues.map((d) => d.status),
      rows: dues.map((d) => [
        d.customer_name,
        d.customer_phone,
        d.area_name,
        d.fee_amount,
        d.carried_forward,
        d.total_due,
        d.paid_amount,
        Math.max(0, d.total_due - d.paid_amount),
        t(d.status as StringKey),
        d.last_paid_on ? f.dateLabel(d.last_paid_on) : null,
      ]),
      total: [
        t('total'),
        null,
        null,
        dues.reduce((a, d) => a + d.fee_amount, 0),
        null,
        dues.reduce((a, d) => a + Math.max(0, d.total_due), 0),
        dues.reduce((a, d) => a + d.paid_amount, 0),
        dues.reduce((a, d) => a + Math.max(0, d.total_due - d.paid_amount), 0),
        null,
        null,
      ],
    });
  }

  const methods = await reportByMethod(db, business.id, period);
  if (methods.length > 0) {
    tables.push({
      title: t('byMethod'),
      head: [t('method'), t('payments'), t('amount')],
      money: [2],
      rows: methods.map((m) => [f.methodLabel(m.method), m.count, m.total]),
    });
  }
  const areas = await reportByArea(db, business.id, period);
  if (areas.length > 1 || (areas.length === 1 && areas[0].area_id)) {
    tables.push({
      title: t('moneyByArea'),
      head: [t('area'), t('customersTitle'), t('feesBilled'), t('collected'), t('pending')],
      money: [2, 3, 4],
      rows: areas.map((a) => [a.area_name ?? t('noArea'), a.customers, a.billed, a.collected, a.pending]),
    });
  }
  if (withCollectors) {
    const staff = await reportByCollector(db, business.id, period);
    if (staff.length > 0) {
      tables.push({
        title: t('byCollector'),
        head: [t('receivedBy'), t('payments'), t('amount')],
        money: [2],
        rows: staff.map((s) => [f.staffLabel(s.staff_name, s.role), s.count, s.total]),
      });
    }
  }

  const generated = t('generatedOn', { date: f.dateLabel(todayKey()) });
  return {
    title: `${business.name} — ${t('collectionReport')}`,
    subtitle: `${periodName} · ${generated}`,
    cards,
    tables,
    header: { business: business.name, name: t('collectionReport'), period: periodName, generated },
    cardTones,
  };
}

/** Fixed stylesheet for the PDF report (no user text). */
const REPORT_CSS = `
  .brand { background: #0F766E; color: #FFFFFF; border-radius: 12px; padding: 16px 20px; }
  .brand .biz { font-size: 20px; font-weight: 700; unicode-bidi: plaintext; text-align: left; }
  html[dir=rtl] .brand .biz { text-align: right; }
  .brand .name { font-size: 14px; font-weight: 600; color: #CCFBF1; margin-top: 2px; }
  .brand .meta { font-size: 11px; color: #CCFBF1; margin-top: 6px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 4px; }
  .kpi { flex: 1 1 0; min-width: 110px; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 12px; }
  .kpi .label { color: #475569; font-size: 11px; font-weight: 600; }
  .kpi .value { font-size: 16px; font-weight: 700; margin-top: 2px; }
  h2 { color: #0F172A; border-inline-start: 3px solid #0F766E; padding-inline-start: 8px; margin-top: 22px;
       page-break-after: avoid; break-after: avoid; }
  table { font-size: 11px; }
  tbody tr:nth-child(even) td { background: #F8FAFC; }
  tbody tr.total td { background: #FFFFFF; }
  td.status { font-weight: 600; }`;

/** Class for a status tone; only these fixed names ever reach the HTML. */
function toneClass(tone: DueStatus | null | undefined): string {
  return tone === 'paid' || tone === 'partial' || tone === 'unpaid' ? ` ${tone}` : '';
}

export function reportHtml(r: Report, f: ReportFormat): string {
  const cell = (v: XCell, isMoney: boolean) =>
    v === null ? '' : isMoney && typeof v === 'number' ? esc(f.money(v)) : esc(v);
  const tables = r.tables
    .map((tb) => {
      // Number columns (money, counts) are end-aligned with tabular figures, header included.
      const numeric = (i: number) =>
        tb.money.includes(i) || (tb.rows.length > 0 && tb.rows.every((c) => c[i] === null || typeof c[i] === 'number'));
      const head = tb.head.map((h, i) => `<th${numeric(i) ? ' class="num"' : ''}>${esc(h)}</th>`).join('');
      const row = (cells: XCell[], cls = '', status?: DueStatus) =>
        `<tr${cls}>${cells
          .map((v, i) => {
            const classes =
              numeric(i) || typeof v === 'number' ? 'num' : tb.ltr?.includes(i) ? 'ltr' : '';
            const statusCls = status && i === tb.statusColumn ? `status${toneClass(status)}` : '';
            const all = [classes, statusCls].filter(Boolean).join(' ');
            return `<td${all ? ` class="${all}"` : ''}>${cell(v, tb.money.includes(i))}</td>`;
          })
          .join('')}</tr>`;
      const body =
        tb.rows.map((c, i) => row(c, '', tb.statuses?.[i])).join('') +
        (tb.total ? row(tb.total, ' class="total"') : '');
      return `<h2>${esc(tb.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join('');
  const cards = r.cards
    .map(
      ([k, v], i) =>
        `<div class="kpi"><div class="label">${esc(k)}</div><div class="value num${toneClass(r.cardTones?.[i])}">${esc(v)}</div></div>`,
    )
    .join('');
  const h = r.header;
  const brand = h
    ? `<header class="brand"><div class="biz">${esc(h.business)}</div><div class="name">${esc(h.name)}</div>` +
      `<div class="meta">${esc(h.period)} · ${esc(h.generated)}</div></header>`
    : `<header class="brand"><div class="biz">${esc(r.title)}</div><div class="meta">${esc(r.subtitle)}</div></header>`;
  return htmlPage(
    r.title,
    `${brand}<section class="kpis">${cards}</section>${tables}
     <footer>${esc(f.t('appName'))}</footer>`,
    f.rtl,
    REPORT_CSS,
  );
}

export function reportSheets(r: Report, f: ReportFormat): XSheet[] {
  const summary: XSheet = {
    name: f.t('summary'),
    rows: [[r.title, ''], [r.subtitle, ''], ...r.cards.map(([k, v]) => [k, v] as XCell[])],
  };
  return [
    summary,
    ...r.tables.map((tb) => ({
      name: tb.title,
      rows: [tb.head, ...tb.rows, ...(tb.total ? [tb.total] : [])],
    })),
  ];
}

/** Safe file name part, e.g. "City Cable" -> "city-cable". */
export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'report'
  );
}

/** Replace an earlier file of the same name in the cache folder (the name can't leave it). */
function freshCacheFile(name: string): File {
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '') || 'file';
  const file = new File(Paths.cache, safe);
  if (file.exists) file.delete();
  return file;
}

export async function sharePdf(html: string, fileName: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const target = freshCacheFile(`${fileName}.pdf`);
  await new File(uri).move(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle });
}

export async function shareXlsx(sheets: XSheet[], fileName: string, dialogTitle: string): Promise<void> {
  const file = freshCacheFile(`${fileName}.xlsx`);
  file.create();
  await file.write(buildXlsx(sheets));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle,
  });
}
