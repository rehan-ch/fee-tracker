/**
 * Strings added by the "core" work area. Add English keys to `en` and the same
 * keys to `ur` (TypeScript fails if an Urdu string is missing). Keys must be
 * unique across all string files.
 *
 * Reused from strings.ts instead of new keys: pending, collected, paid, partial,
 * unpaid, due, totalDue, alreadyPaid, remaining, includesPrevious,
 * creditFromPrevious, overpayNote, notPaidOne, notPaidCount, unpaidCount,
 * partialCount, openUnpaidList, sendReminders, backupNever, backupOld,
 * backupNow, noCustomersTitle, noCustomersBody, addFirstCustomer, noUnpaid,
 * noPartial, noPaid, paidOn, anyDate, allAreas, noArea, recordPayment,
 * remindedOn, switchBusiness, usingAs, welcomeSubtitle, getStarted,
 * joinWithInvite, privacyPolicy, somethingWrong. From design.ts:
 * designErrorLabel.
 */
export const en = {
  // Home
  coreCollectedIn: 'Collected · {month}',
  coreOfExpected: 'of {amount} expected',
  coreLeftToPay: 'Left to pay',
  coreOfCustomers: 'of {count} customers',
  coreAllPaidFor: 'Everyone has paid for {month}',
  coreNoDuesFor: 'No fees due for {month}',
  coreNoDuesBody: "Each customer's fees start from their start month.",
  coreHowItWorks: 'How it works',
  coreStep1: 'Add your customers and their monthly fee',
  coreStep2: 'Record each payment when you receive it',
  coreStep3: 'Send WhatsApp reminders to those who have not paid',
  coreStepLabel: 'Step {n}: {text}',
  coreOpensCollection: 'Opens the collection list',

  // Collection
  coreNoMatches: 'No matches',
  coreNoMatchesBody: 'Try another name, area or date.',
  coreClearFilters: 'Clear filters',
  coreShowPartial: 'Show partial payments',

  // Record payment
  coreFullAmount: 'Full amount {amount}',

  // Welcome / setup
  coreWelcomeTitle: 'Welcome to Fee Tracker',
  coreWelcomePoint1: 'Add your customers once',
  coreWelcomePoint2: 'Record a payment in 3 taps',
  coreWelcomePoint3: 'Send reminders on WhatsApp with one tap',
  coreYourBusiness: 'Your business',
  coreRecordsStay: 'Your records are saved on this phone.',
} satisfies Record<string, string>;

export const ur: Record<keyof typeof en, string> = {
  // Home
  coreCollectedIn: '{month} کی وصولی',
  coreOfExpected: 'متوقع {amount} میں سے',
  coreLeftToPay: 'ادائیگی باقی',
  coreOfCustomers: 'کل {count} گاہکوں میں سے',
  coreAllPaidFor: 'سب نے {month} کی ادائیگی کر دی ہے',
  coreNoDuesFor: '{month} کی کوئی فیس واجب الادا نہیں',
  coreNoDuesBody: 'ہر گاہک کی فیس اس کے شروع ہونے والے مہینے سے لگتی ہے۔',
  coreHowItWorks: 'یہ کیسے کام کرتا ہے',
  coreStep1: 'اپنے گاہک اور ان کی ماہانہ فیس شامل کریں',
  coreStep2: 'ہر ادائیگی ملتے ہی درج کریں',
  coreStep3: 'جنہوں نے ادائیگی نہیں کی، انہیں واٹس ایپ پر یاددہانی بھیجیں',
  coreStepLabel: 'مرحلہ {n}: {text}',
  coreOpensCollection: 'وصولی کی فہرست کھلتی ہے',

  // Collection
  coreNoMatches: 'کچھ نہیں ملا',
  coreNoMatchesBody: 'کوئی اور نام، علاقہ یا تاریخ آزما کر دیکھیں۔',
  coreClearFilters: 'فلٹر ہٹائیں',
  coreShowPartial: 'جزوی ادائیگیاں دیکھیں',

  // Record payment
  coreFullAmount: 'پوری رقم {amount}',

  // Welcome / setup
  coreWelcomeTitle: 'فیس ٹریکر میں خوش آمدید',
  coreWelcomePoint1: 'اپنے گاہک صرف ایک بار شامل کریں',
  coreWelcomePoint2: 'صرف 3 ٹیپ میں ادائیگی درج کریں',
  coreWelcomePoint3: 'ایک ٹیپ سے واٹس ایپ پر یاددہانی بھیجیں',
  coreYourBusiness: 'آپ کا کاروبار',
  coreRecordsStay: 'آپ کا ریکارڈ اسی فون پر محفوظ ہوتا ہے۔',
};
