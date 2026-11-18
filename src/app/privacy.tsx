/** In-app privacy policy (Google Play requires one inside apps that handle personal data). */
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { BrandMark } from '../components/core/BrandMark';
import { mailtoUrl, safeHttpsUrl } from '../components/settings/links';
import { Button, Card, Row, Screen, Txt } from '../components/ui';
import { cloudConfigured, PUBLISHER } from '../config';
import { useApp } from '../state/app';
import { space } from '../theme';

/** Urdu summary of the policy, shown under a "Summary" heading in Urdu. */
const URDU_SUMMARY =
  'آپ کا ریکارڈ اسی فون پر محفوظ ہوتا ہے۔ ہم کوئی ڈیٹا فروخت یا شیئر نہیں کرتے، اور ایپ میں کوئی اشتہار یا ٹریکنگ نہیں۔ بیک اپ، واٹس ایپ یاددہانی اور رسید صرف تب بنتی ہیں جب آپ خود بٹن دبائیں۔ اگر آپ خود کلاؤڈ سنک آن کریں تو آپ کی ای میل اور منتخب کاروبار کا ڈیٹا ہمارے کلاؤڈ ڈیٹا بیس میں محفوظ ہوتا ہے تاکہ عملے کے فون پر بھی دستیاب ہو؛ آپ کسی بھی وقت اسے اور اپنا اکاؤنٹ حذف کر سکتے ہیں۔';

interface Section {
  title: string;
  body: string;
  /** Only shown when the app is built with cloud sync. */
  cloud?: boolean;
}

const SECTIONS: Section[] = [
  {
    title: 'Summary',
    body:
      'Fee Tracker stores your records on your phone. We do not sell or share your data, and the app has no advertising, analytics or tracking. Backups, reminders and receipts are only created when you tap a button. If you choose to turn on cloud sync, the business you choose is stored in our cloud database so your staff can use it too.',
  },
  {
    title: 'Information you enter',
    body:
      "Your business name and phone number; for each customer: name, phone number, address, area, notes, monthly fee, fee changes and payment records (amount, date, method, who received it and a note); staff names, phone numbers and roles; your reminder message and payment details. This is saved in the app's private storage on your phone and is used only to show your collection lists, balances, reminders, receipts and reports. If you attach a payment screenshot to a payment (for example the JazzCash or Easypaisa confirmation a customer sent you), the image is also stored in the app's private storage on your phone; it is not included in backup files or cloud sync, and it is deleted with the payment.",
  },
  {
    title: 'Staff PINs',
    body:
      'Staff PINs are stored only on the phone where they were set, as a salted one-way hash. They are never included in backup files or cloud sync.',
  },
  {
    title: 'Reminders and receipts',
    body:
      'When you send a reminder or a receipt, the app opens WhatsApp, your SMS app or the Android share menu with the text or file filled in, and you send it yourself. The app cannot read your messages. Those apps handle what you send under their own privacy policies.',
  },
  {
    title: 'Alerts',
    body:
      'If you turn on alerts, the app schedules notifications on your phone (for example "15 customers still unpaid"). They are created on the phone; nothing is sent to a server. Android asks for your permission first.',
  },
  {
    title: 'Backups',
    body:
      'A backup file is created only when you tap "Back up now". Android then shows the share menu, and you choose where to send or save the file (for example Google Drive). That service handles the file under its own privacy policy. The backup file is not encrypted, so keep it somewhere private. Restoring reads a backup file that you pick.',
  },
  {
    title: 'Android device backup',
    body:
      "If Android backup is turned on for your device, Android may include this app's data in your device backup to your Google account. This is managed by Google and your device settings; we cannot access it.",
  },
  {
    title: 'Cloud sync (optional)',
    cloud: true,
    body:
      'Cloud sync is off unless you turn it on. When you sign in, we store your email address to send you sign-in codes. When you turn sync on for a business, that business\'s records listed above (except PINs) are stored in our cloud database, hosted by Supabase, so the owner\'s and staff phones stay up to date. Data is sent over encrypted connections (HTTPS) and only accounts you invite as staff can see it, with the role you give them. We use this data only to provide sync, never for advertising, and we do not sell it. You can remove a business from the cloud, or delete your cloud account and the businesses you own in it, from Settings > Cloud sync, or ask for deletion on our website. Deleted data is removed from our database straight away; our hosting provider\'s backups may keep a copy for a short time until they are replaced.',
  },
  {
    title: 'Permissions',
    body:
      "Internet (only used for cloud sync, if you turn it on) and notifications (only if you turn on alerts). The app does not ask for access to your contacts, location, camera, microphone, photos, files or SMS. The \"Call\" button opens your phone's dialer with the number filled in; you place the call yourself.",
  },
  {
    title: "Your customers' information",
    body:
      'You are responsible for the customer details you record. If a customer asks you to remove their details, open the customer and tap "Delete customer".',
  },
  {
    title: 'Deleting your data',
    body:
      'You can delete a single customer, a whole business (Settings > Businesses), or everything on the phone at once (Settings > Delete all data). Uninstalling the app also removes all data stored by the app on your phone. Backup files and messages you sent elsewhere must be deleted where you saved or sent them. Cloud data is deleted as described above.',
  },
  {
    title: 'Children',
    body: 'This app is a business tool and is not directed at children.',
  },
  {
    title: 'Changes',
    body:
      'If this policy changes, the updated version will be shown in the app and on our privacy policy page, with a new date.',
  },
  {
    title: 'Contact',
    body: `${PUBLISHER.developerName}, ${PUBLISHER.contactEmail}. Online: ${PUBLISHER.privacyPolicyUrl}`,
  },
];

// The policy itself is English, so it always reads left-to-right (Inter,
// left-aligned) even when the app is in Urdu.
const ltrAlign = { textAlign: 'left' } as const;

/** Built once from the publisher address; null (no button) if it isn't a plain email. */
const CONTACT_MAILTO = mailtoUrl(PUBLISHER.contactEmail);
/** The same policy on the web (Play requires a public URL; this links it from inside the app). */
const POLICY_URL = safeHttpsUrl(PUBLISHER.privacyPolicyUrl);

export default function PrivacyScreen() {
  const { lang, t } = useApp();
  const open = (url: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert(t('somethingWrong')));
  };
  const contact = () => open(CONTACT_MAILTO);
  return (
    <Screen>
      <View style={styles.column}>
        <Row gap={space.sm} justify="center">
          <BrandMark size={32} variant="teal" />
          <Txt variant="h2" header>
            {t('appName')}
          </Txt>
        </Row>
        {lang === 'ur' ? (
          <Card variant="tonal" style={styles.gapSm}>
            <Txt variant="h2" header>
              {t('summary')}
            </Txt>
            <Txt variant="bodyLarge">{URDU_SUMMARY}</Txt>
          </Card>
        ) : null}
        <Card style={styles.policy}>
          <Txt variant="title" header ltr style={ltrAlign}>
            Privacy Policy
          </Txt>
          <Txt variant="small" ltr style={ltrAlign}>
            Last updated: {PUBLISHER.policyLastUpdated}
          </Txt>
          {SECTIONS.filter((s) => cloudConfigured || !s.cloud).map((s) => (
            <View key={s.title} style={styles.section}>
              <Txt variant="h2" header ltr style={ltrAlign}>
                {s.title}
              </Txt>
              <Txt variant="bodyLarge" ltr selectable style={ltrAlign}>
                {s.body}
              </Txt>
            </View>
          ))}
        </Card>
        {CONTACT_MAILTO || POLICY_URL ? (
          <View style={styles.gapSm}>
            {POLICY_URL ? (
              <Button
                title={t('settingsPrivacyOnline')}
                icon="globe-outline"
                variant="tonal"
                accessibilityHint={POLICY_URL}
                onPress={() => open(POLICY_URL)}
              />
            ) : null}
            {CONTACT_MAILTO ? (
              <Button
                title={t('settingsContactUs')}
                icon="mail-outline"
                variant="tonal"
                accessibilityHint={PUBLISHER.contactEmail}
                onPress={contact}
              />
            ) : null}
            <Txt variant="small" ltr center selectable>
              {PUBLISHER.contactEmail}
            </Txt>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Comfortable reading width on tablets and wide phones.
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.md },
  policy: { gap: space.lg },
  section: { gap: space.xs },
  gapSm: { gap: space.sm },
});
