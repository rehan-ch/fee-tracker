/**
 * Strings added by the "design" work area. Add English keys to `en` and the same
 * keys to `ur` (TypeScript fails if an Urdu string is missing). Keys must be
 * unique across all string files.
 *
 * Reused from strings.ts instead of new keys: close (sheet scrim and close
 * button), thisMonth (MonthPicker), collected / feesBilled (chart legends),
 * monthlySummary ("Month by month"), premium (premium badge).
 */
export const en = {
  designClearSearch: 'Clear search',
  designErrorLabel: 'Error: {message}',
  designPercentCollected: '{percent}% collected',
  designLegendBilled: 'Billed',
  designNoData: 'No data yet',
  designPreviousMonth: 'Previous month, {month}',
  designNextMonth: 'Next month, {month}',
} satisfies Record<string, string>;

export const ur: Record<keyof typeof en, string> = {
  designClearSearch: 'تلاش صاف کریں',
  designErrorLabel: 'غلطی: {message}',
  designPercentCollected: '{percent}% وصول ہو گیا',
  designLegendBilled: 'بل شدہ رقم',
  designNoData: 'ابھی کوئی ڈیٹا نہیں',
  designPreviousMonth: 'پچھلا مہینہ، {month}',
  designNextMonth: 'اگلا مہینہ، {month}',
};
