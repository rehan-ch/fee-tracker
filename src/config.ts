/**
 * App-wide settings to fill in before publishing.
 */
import { isAllowedCloudUrl, isSecretSupabaseKey } from './lib/cloudKeys';

/**
 * Publisher details shown in the in-app privacy policy. Keep them in sync
 * with docs/PRIVACY_POLICY.md and the hosted pages in docs/ (GitHub Pages).
 */
export const PUBLISHER = {
  developerName: 'Rehan Ch',
  contactEmail: 'nexondev.ai@gmail.com',
  policyLastUpdated: '17 November 2026',
  /** Public privacy policy page (Play Console → Store listing). */
  privacyPolicyUrl: 'https://rehan-ch.github.io/fee-tracker/privacy-policy.html',
  /** Public web page where cloud users can ask for their account to be deleted (Play requirement). */
  accountDeletionUrl: 'https://rehan-ch.github.io/fee-tracker/delete-account.html',
};

/**
 * Premium features (staff accounts, several businesses, cloud sync, reminder
 * schedule, payment details).
 *
 * Google Play Billing is not shipped yet, so `enforce` stays false: every
 * feature is unlocked for everyone and no upgrade screen is shown. When
 * subscriptions are added, set `enforce: true` and bring back the billing
 * module and Upgrade screen.
 */
export const PREMIUM = {
  enforce: false,
};

/**
 * Cloud sync (premium) uses your own Supabase project. Set these in a .env
 * file or as EAS environment variables; when they are missing, cloud sync is
 * hidden and the app stays fully offline. See supabase/README.md.
 */
export const CLOUD = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  key: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
};
/**
 * Cloud sync stays off unless the URL is https and the key is the
 * publishable one: a secret or service_role key in an app would give anyone
 * full access to every business (see SECURITY.md).
 */
export const cloudConfigured =
  CLOUD.key.length > 0 && isAllowedCloudUrl(CLOUD.url, __DEV__) && !isSecretSupabaseKey(CLOUD.key);

/** Default country calling code for local phone numbers in WhatsApp links. */
export const DEFAULT_COUNTRY_CODE = '92';
