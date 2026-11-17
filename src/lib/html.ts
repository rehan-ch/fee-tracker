/** Escape text for HTML documents (receipts and PDF reports). */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Content-Security-Policy for the print WebView (docs/DESIGN.md 13.18): no
 * scripts, no network requests, no remote fonts; only the inline stylesheet
 * and data: images.
 */
export const PRINT_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** Status colours for printed documents (docs/DESIGN.md section 4). */
const STATUS_CSS = `
  .paid { color: #15803D; } .unpaid { color: #B91C1C; } .partial { color: #B45309; }`;

/**
 * Shared page frame for printed documents. `title` and every value in `body`
 * must already be escaped with esc(); `css` is a fixed stylesheet from this
 * codebase (never user text).
 */
export function htmlPage(title: string, body: string, rtl: boolean, css = ''): string {
  return `<!DOCTYPE html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ur' : 'en'}">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  @page { margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #FFFFFF; }
  body { font-family: Roboto, 'Noto Sans', Arial, sans-serif; color: #0F172A; font-size: 12px;
         line-height: 1.45; }
  html[lang=ur] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', sans-serif; line-height: 2; }
  /* Numbers, amounts, phones and receipt numbers: Latin digits, left to right, aligned columns. */
  .num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  html[lang=ur] .num, html[lang=ur] .ltr { font-family: Roboto, 'Noto Sans', Arial, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #0F766E; }
  h2 { font-size: 14px; margin: 20px 0 8px; }
  .muted { color: #5B6779; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #E2E8F0; text-align: left; vertical-align: top; }
  html[dir=rtl] th, html[dir=rtl] td { text-align: right; }
  th { background: #EEF2F6; color: #475569; font-weight: 600; }
  /* User text (names, areas, notes) takes its direction from its own first letter, so an
     English name in an Urdu report (or the reverse) keeps its punctuation in place. */
  td:not(.num):not(.ltr) { unicode-bidi: plaintext; }
  /* End-aligned in the reading direction (.num itself is always left to right). */
  td.num, th.num { text-align: right; white-space: nowrap; }
  html[dir=rtl] td.num, html[dir=rtl] th.num { text-align: left; }
  td.ltr { white-space: nowrap; }
  tr.total td { font-weight: 700; border-top: 2px solid #0F172A; }
  ${STATUS_CSS}
  footer { margin-top: 24px; font-size: 10px; color: #5B6779; }
  ${css}
</style>
</head>
<body>${body}</body>
</html>`;
}
