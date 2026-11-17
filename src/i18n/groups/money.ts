/**
 * Strings added by the "money" work area. Add English keys to `en` and the same
 * keys to `ur` (TypeScript fails if an Urdu string is missing). Keys must be
 * unique across all string files.
 *
 * Reused instead of new keys: designPercentCollected ("{percent}% collected"),
 * monthlySummary ("Month by month"), collected / designLegendBilled (chart
 * legend), selectedCount, noPhone, paymentInfo ("How to pay"), pendingNow,
 * sendingProgress, remindersDone, somethingWrong.
 */
export const en = {
  // Reports
  moneyByArea: 'By area',
  moneyReportPeriod: 'Report period',
  moneyCustomerStatus: 'Customers by status',
  moneyCollectionRate: 'Collection rate',
  moneyNoMonthData: 'No records for {month} yet',
  moneyNoYearData: 'No records for {year} yet',
  moneyNoDataBody: 'Add customers and record their payments, and this report fills in by itself.',
  moneyLoading: 'Loading…',
  moneyCollectionChart: 'Collected and billed by month',
  moneyCollectedOf: 'Collected {collected} of {billed}',
  moneyPendingAmount: 'Pending {amount}',
  moneySlotEmpty: '{month}: no records',
  moneyChartSummary:
    'Column chart for {year}: money collected against fees billed, month by month. The list below shows every month.',
  moneyTapColumn: 'Tap a column to see that month.',
  moneyHighestMonth: 'Highest: {month}',
  moneyPaymentsCount: '{count} payments',
  moneyPaymentsOne: '1 payment',
  moneyCustomersOne: '1 customer',
  moneyMethodSummary: 'Payment methods: {list}',
  moneyExportCaptionMonth:
    'Includes the totals for {period}, every customer\'s dues and payments, and the breakdowns shown above.',
  moneyExportCaptionYear:
    'Includes the totals for {period}, each month\'s fees and collection, and the breakdowns shown above.',
  moneyPdf: 'PDF',
  moneyExcel: 'Excel',
  moneyExportPdfA11y: 'Export report as PDF',
  moneyExportExcelA11y: 'Export report as Excel file',
  /** Exported report card label (the old one showed a raw "{count}"). */
  moneyNotPaidLabel: 'Customers not fully paid',

  // Receipt
  moneyPaidStamp: 'PAID',

  // Reminders
  moneySelectAll: 'Select all',
  moneySelectNone: 'Select none',
  moneyStartSending: 'Start sending ({count})',
  moneySendProgress: 'Reminder progress',
  moneyDueAmount: '{amount} due',
  moneyRemindersDoneBody: 'The list shows when each customer was last reminded.',

  // Message template
  moneyCharCount: '{count} / {max} characters',
  moneyInsertPlaceholder: 'Insert {placeholder}',
  moneySampleName: 'Ali Khan',
  moneyPreviewSample: 'Shown with a sample customer and amount.',
} satisfies Record<string, string>;

export const ur: Record<keyof typeof en, string> = {
  moneyByArea: 'علاقے کے لحاظ سے',
  moneyReportPeriod: 'رپورٹ کی مدت',
  moneyCustomerStatus: 'گاہکوں کی حالت',
  moneyCollectionRate: 'وصولی کی شرح',
  moneyNoMonthData: '{month} کا ابھی کوئی ریکارڈ نہیں',
  moneyNoYearData: '{year} کا ابھی کوئی ریکارڈ نہیں',
  moneyNoDataBody: 'گاہک شامل کریں اور ان کی ادائیگیاں درج کریں، یہ رپورٹ خود بخود تیار ہو جائے گی۔',
  moneyLoading: 'لوڈ ہو رہا ہے…',
  moneyCollectionChart: 'ہر مہینے کی وصولی اور بل شدہ رقم',
  moneyCollectedOf: '{billed} میں سے {collected} وصول',
  moneyPendingAmount: 'باقی {amount}',
  moneySlotEmpty: '{month}: کوئی ریکارڈ نہیں',
  moneyChartSummary:
    '{year} کا کالم چارٹ: ہر مہینے کی بل شدہ فیس کے مقابلے میں وصول شدہ رقم۔ نیچے کی فہرست میں ہر مہینہ درج ہے۔',
  moneyTapColumn: 'کسی مہینے کی تفصیل دیکھنے کے لیے اس کے کالم پر ٹیپ کریں۔',
  moneyHighestMonth: 'سب سے زیادہ: {month}',
  moneyPaymentsCount: '{count} ادائیگیاں',
  moneyPaymentsOne: '1 ادائیگی',
  moneyCustomersOne: '1 گاہک',
  moneyMethodSummary: 'ادائیگی کے طریقے: {list}',
  moneyExportCaptionMonth:
    'اس میں {period} کے کل، ہر گاہک کے واجبات اور ادائیگیاں، اور اوپر دکھائی گئی تفصیل شامل ہے۔',
  moneyExportCaptionYear:
    'اس میں {period} کے کل، ہر مہینے کی فیس اور وصولی، اور اوپر دکھائی گئی تفصیل شامل ہے۔',
  moneyPdf: 'پی ڈی ایف',
  moneyExcel: 'ایکسل',
  moneyExportPdfA11y: 'رپورٹ پی ڈی ایف میں ایکسپورٹ کریں',
  moneyExportExcelA11y: 'رپورٹ ایکسل فائل میں ایکسپورٹ کریں',
  moneyNotPaidLabel: 'جن گاہکوں نے پوری ادائیگی نہیں کی',

  moneyPaidStamp: 'ادا شدہ',

  moneySelectAll: 'سب منتخب کریں',
  moneySelectNone: 'انتخاب ختم کریں',
  moneyStartSending: 'بھیجنا شروع کریں ({count})',
  moneySendProgress: 'یاددہانیوں کی پیش رفت',
  moneyDueAmount: '{amount} واجب الادا',
  moneyRemindersDoneBody: 'فہرست میں ہر گاہک کی آخری یاددہانی کی تاریخ نظر آتی ہے۔',

  moneyCharCount: '{max} میں سے {count} حروف',
  moneyInsertPlaceholder: '{placeholder} شامل کریں',
  moneySampleName: 'علی خان',
  moneyPreviewSample: 'ایک فرضی گاہک اور رقم کے ساتھ دکھایا گیا ہے۔',
};
