/**
 * Payment receipt as an HTML page (for the PDF version). The layout mirrors
 * the in-app receipt card (docs/DESIGN.md 13.11): teal band with the business
 * name and phone, "Payment receipt · R-XXXX" with a PAID stamp, the amount,
 * detail rows, payment info and a centred footer. Every value goes through
 * esc(); the page CSP blocks scripts and remote loads (see ./html).
 */
import { esc, htmlPage } from './html';

export interface ReceiptContent {
  rtl: boolean;
  title: string;
  business: string;
  businessPhone: string | null;
  number: string;
  /** Label, value, and whether the value is a number or phone kept left to right. */
  rows: [label: string, value: string, ltr?: boolean][];
  amountLabel: string;
  amount: string;
  footer: string;
  paymentInfo: string | null;
  /** Word on the paid stamp, e.g. "PAID". Omitted: no stamp. */
  paidLabel?: string;
  /** Heading above the payment info block, e.g. "How to pay". */
  paymentInfoTitle?: string;
}

/** Short receipt number derived from the payment id, e.g. R-3F2A9C1B. */
export function receiptNumber(paymentId: string): string {
  return `R-${paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
}

/** Fixed stylesheet for the receipt (no user text). */
const RECEIPT_CSS = `
  .receipt { max-width: 440px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0;
             border-radius: 16px; overflow: hidden; }
  .band { background: #0F766E; color: #FFFFFF; padding: 16px 20px; }
  .band .biz { font-size: 20px; font-weight: 700; margin: 0; unicode-bidi: plaintext; text-align: left; }
  .band .biz-phone { color: #CCFBF1; font-size: 12px; margin-top: 2px; text-align: left; }
  html[dir=rtl] .band .biz, html[dir=rtl] .band .biz-phone { text-align: right; }
  .content { padding: 20px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .head .title { color: #475569; font-size: 13px; font-weight: 600; }
  .stamp { display: inline-block; white-space: nowrap; background: #DCFCE7; color: #166534;
           border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 700; }
  .stamp .tick { color: #15803D; }
  .hero { text-align: center; margin: 16px 0 12px; }
  .hero .amount { font-size: 32px; font-weight: 700; color: #15803D; line-height: 1.25; }
  .details td { border-bottom: 1px solid #E2E8F0; padding: 8px 0; }
  .details tr:last-child td { border-bottom: 0; }
  .details td.label { color: #5B6779; }
  /* Values sit at the reading end; user text keeps its own direction (plaintext). */
  .details td.value { font-weight: 700; text-align: right; white-space: normal; }
  html[dir=rtl] .details td.value { text-align: left; }
  .payinfo { background: #EEF2F6; border-radius: 12px; padding: 12px; margin-top: 12px; }
  .payinfo .label { color: #475569; font-weight: 600; font-size: 12px; }
  .payinfo p { margin: 4px 0 0; white-space: pre-line; color: #475569; unicode-bidi: plaintext; text-align: left; }
  html[dir=rtl] .payinfo p { text-align: right; }
  .receipt footer { text-align: center; margin-top: 16px; font-size: 11px; color: #5B6779; }`;

export function receiptHtml(c: ReceiptContent): string {
  const rows = c.rows
    .map(
      ([k, v, ltr]) =>
        `<tr><td class="label">${esc(k)}</td><td class="value${ltr ? ' num' : ''}">${esc(v)}</td></tr>`,
    )
    .join('');
  const stamp = c.paidLabel ? `<span class="stamp"><span class="tick">&#10003;</span> ${esc(c.paidLabel)}</span>` : '';
  const payInfo = c.paymentInfo
    ? `<div class="payinfo">${c.paymentInfoTitle ? `<div class="label">${esc(c.paymentInfoTitle)}</div>` : ''}<p>${esc(c.paymentInfo)}</p></div>`
    : '';
  const body = `
  <div class="receipt">
    <div class="band">
      <div class="biz">${esc(c.business)}</div>
      ${c.businessPhone ? `<div class="biz-phone"><span class="ltr">${esc(c.businessPhone)}</span></div>` : ''}
    </div>
    <div class="content">
      <div class="head">
        <div class="title">${esc(c.title)} · <span class="num">${esc(c.number)}</span></div>
        ${stamp}
      </div>
      <div class="hero">
        <div class="muted">${esc(c.amountLabel)}</div>
        <div class="amount num">${esc(c.amount)}</div>
      </div>
      <table class="details">${rows}</table>
      ${payInfo}
      <footer>${esc(c.footer)}</footer>
    </div>
  </div>`;
  return htmlPage(`${c.title} ${c.number}`, body, c.rtl, RECEIPT_CSS);
}
