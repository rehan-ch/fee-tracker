/**
 * Strings added by the "customers" work area. Add English keys to `en` and the same
 * keys to `ur` (TypeScript fails if an Urdu string is missing). Keys must be
 * unique across all string files.
 *
 * Reused from strings.ts instead of new keys: due, advance, inactive, active,
 * status (form section), call, sms, edit, editCustomer, addCustomer,
 * addFirstCustomer, noCustomersTitle/Body, noCustomersMatch, perMonth, since,
 * currentBalance, noBalance, recordPayment, remindWhatsApp, feeHistory,
 * changeFee, fromMonth, newMonthlyFee, saveFee, undoFeeChange, receipt,
 * deletePayment, manageAreas, areaName, noAreas, customersCount, cannotOpenApp,
 * noAccess, somethingWrong.
 */
export const en = {
  // Customers list
  customersInactiveFilter: 'Inactive ({count})',
  customersClearFilters: 'Clear filters',
  customersNoMatchBody: 'Try another name or phone number, or clear the filters.',
  customersDueA11y: '{amount} due',
  customersAdvanceA11y: '{amount} advance',

  // Customer detail
  customersQuickWhatsApp: 'WhatsApp',
  customersChatWhatsApp: 'Chat on WhatsApp',
  customersChatSms: 'Send a text message',
  customersCallFailed: 'Could not open the phone app.',
  customersSmsFailed: 'Could not open the messages app.',
  customersSettled: 'Settled',
  customersMonthCellA11y: '{month}, {status}, {amount}',
  customersMonthPaidA11y: '{amount} paid',
  customersMonthEmptyA11y: '{month}, not billed',
  customersFeeFrom: 'From {month}',
  customersFeeChangeA11y: 'From {month}: {from} to {to}',
  customersScheduled: 'Scheduled',
  customersPaymentA11y: '{amount}, paid on {date}, {method}, for {month}',

  // Add / edit form
  customersSectionContact: 'Contact',
  customersSectionBilling: 'Billing',
  customersSectionAreaNotes: 'Area and notes',
  customersFeeEditHint: 'Fee changes are kept in the fee history.',
  customersFixErrors: 'Some fields need fixing. See the messages above.',

  // Fee change
  customersCurrentFee: 'Current fee',

  // Areas
  customersRenameArea: 'Rename {name}',
  customersDeleteArea: 'Delete {name}',
  customersAreaExists: 'An area with this name already exists',
  customersOneCustomer: '1 customer',
  customersNoAreasBody: 'Add your first area above, for example Block A.',
} satisfies Record<string, string>;

export const ur: Record<keyof typeof en, string> = {
  customersInactiveFilter: 'غیر فعال ({count})',
  customersClearFilters: 'فلٹر ہٹائیں',
  customersNoMatchBody: 'کوئی اور نام یا فون نمبر لکھ کر دیکھیں، یا فلٹر ہٹا دیں۔',
  customersDueA11y: '{amount} واجب الادا',
  customersAdvanceA11y: '{amount} پیشگی',

  customersQuickWhatsApp: 'واٹس ایپ',
  customersChatWhatsApp: 'واٹس ایپ پر بات کریں',
  customersChatSms: 'ٹیکسٹ میسج بھیجیں',
  customersCallFailed: 'فون ایپ نہیں کھل سکی۔',
  customersSmsFailed: 'میسجز ایپ نہیں کھل سکی۔',
  customersSettled: 'حساب برابر',
  customersMonthCellA11y: '{month}، {status}، {amount}',
  customersMonthPaidA11y: '{amount} ادا ہو گئے',
  customersMonthEmptyA11y: '{month}، کوئی بل نہیں بنا',
  customersFeeFrom: '{month} سے',
  customersFeeChangeA11y: '{month} سے: {from} کی جگہ {to}',
  customersScheduled: 'طے شدہ',
  customersPaymentA11y: '{amount}، {date} کو ادا ہوئے، {method}، {month} کے لیے',

  customersSectionContact: 'رابطہ',
  customersSectionBilling: 'فیس کی تفصیل',
  customersSectionAreaNotes: 'علاقہ اور نوٹس',
  customersFeeEditHint: 'فیس کی ہر تبدیلی فیس کی تاریخ میں محفوظ رہتی ہے۔',
  customersFixErrors: 'کچھ خانے درست کرنے ہیں۔ اوپر دیے گئے پیغامات دیکھیں۔',

  customersCurrentFee: 'موجودہ فیس',

  customersRenameArea: '{name} کا نام بدلیں',
  customersDeleteArea: '{name} حذف کریں',
  customersAreaExists: 'اس نام کا علاقہ پہلے سے موجود ہے',
  customersOneCustomer: '1 گاہک',
  customersNoAreasBody: 'اوپر اپنا پہلا علاقہ شامل کریں، مثلاً بلاک اے۔',
};
