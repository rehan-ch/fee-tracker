# Google Play release checklist

How this app is set up to pass Google Play review, and what you still need to do in Play
Console. Google changes its forms and requirements often, so check the wording in Play
Console as you go; the answers below describe what the app actually does.

## Already handled in the code

| Requirement | How the app meets it |
| --- | --- |
| Target API level | Expo SDK 58 builds with `targetSdk 36` (Android 16), `minSdk 24`. |
| 64-bit and 16 KB page size | Expo SDK 58 / React Native 0.88 native libraries support both. |
| Minimal permissions | Declared in the built bundle (checked 17 Nov 2026): `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `WAKE_LOCK`, `POST_NOTIFICATIONS` (asked for only when you turn on alerts), `RECEIVE_BOOT_COMPLETED` (to restore scheduled alerts after a restart), `USE_BIOMETRIC` / `USE_FINGERPRINT` (from the secure-store library; the app never prompts for them), plus the notification library's launcher-badge and `c2dm` entries. All of these are normal permissions with no Play declaration form. Storage, media, audio and overlay permissions pulled in by libraries are removed via `android.blockedPermissions`. No billing permission: Google Play Billing is not in this build. **No SMS, call log, contacts, location, camera or exact-alarm permissions**: reminders open WhatsApp or the SMS app for you to send, so the SMS permission policy doesn't apply. |
| Privacy policy inside the app | Settings → Privacy policy (`src/app/privacy.tsx`), also linked from the first-launch screen. The cloud section only shows when cloud sync is built in. |
| User data deletion | Delete a customer, a business, or everything on the phone (deleting clears names, phone numbers, addresses and notes, on the phone and in the cloud). With cloud sync: in-app **Delete cloud account** (Settings → Cloud sync) plus a web page you publish (`PUBLISHER.accountDeletionUrl`). |
| Security | See `SECURITY.md`: parameterized SQL, validated backups and sync data, escaped receipts/reports, checked links, salted PIN hashes, encrypted sign-in storage, row-level security on the server. |
| Subscriptions | Not in this release. `PREMIUM.enforce` is `false` in `src/config.ts`, so every feature is free and there is no Upgrade screen, no `expo-iap` and no BILLING permission. See "Adding subscriptions later" below. |
| No placeholder or broken features | Cloud sync is hidden unless the Supabase keys are set. |
| Edge-to-edge (Android 15+) | Safe-area handling on every screen and sheet. |
| Accessibility basics | Touch targets ≥ 44–48dp, labels on icon-only buttons. |
| Payments for real-world services | The app only records payments customers make outside the app. Payment links in reminders point to the business's own JazzCash/Easypaisa/bank pages; the app doesn't process them. |

## Before your first build

1. **Package name:** `com.feetracker.app` (`app.json` → `android.package`), decided on
   17 November 2026. **It can never be changed after the first upload.**
2. **Publisher details** are filled in (`src/config.ts` → `PUBLISHER`, `docs/PRIVACY_POLICY.md`,
   `docs/DELETE_ACCOUNT.md`). If the contact email changes, update all three and run
   `node scripts/build-pages.mjs`.
3. **Privacy policy and account-deletion pages** are served by GitHub Pages from `docs/`:
   - Privacy policy: https://rehan-ch.github.io/fee-tracker/privacy-policy.html
   - Delete account: https://rehan-ch.github.io/fee-tracker/delete-account.html
   Edit the `.md` files, run `node scripts/build-pages.mjs`, commit and push.
4. **Premium** is free for everyone in this release (`PREMIUM.enforce: false`).
5. **Cloud sync (optional):** follow `supabase/README.md`, then set
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` for your EAS builds. Leave them
   unset to ship an offline-only app (the simpler Play forms below).
6. Optional: rename the app in `app.json` → `expo.name` (max 30 characters on Play).

## Build

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure            # links the project to your Expo account
npm run build:preview                          # APK to install on your own phone for testing
npm run build:production                       # .aab for Google Play (versionCode auto-increments)
```

EAS creates and stores the upload keystore for you. In Play Console, keep **Play App
Signing** turned on (the default).

The **first** `.aab` must be uploaded by hand in Play Console. After that you can use
`npx eas-cli@latest submit --platform android` (it needs a Google service-account key;
`eas.json` sends builds to the internal track as drafts).

## Adding subscriptions later

The feature gates (`premium.active`, `PremiumGate`, `can('subscription')`) are still in the
code; only the billing layer was removed. To sell premium:

1. `npx expo install expo-iap` and add its config plugin back to `app.json`
   (`["expo-iap", { "android": { "store": "play" } }]`).
2. Restore `src/premium/billing.ts`, `src/app/premium.tsx` and
   `src/components/settings/PlanCard.tsx` from git history (commit "Prepare first Play
   release"), point `src/state/app.tsx` at the billing module, and set
   `PREMIUM.enforce: true` with your `productIds`.
3. Upload a build that includes billing to a testing track, then **Monetize → Products →
   Subscriptions → Create subscription** with monthly (P1M) and yearly (P1Y) base plans.
4. **Setup → License testing**: add testers' Gmail addresses.
5. Update the privacy policy (purchases section) and the content rating (digital purchases:
   yes).

## Testing requirement for new developer accounts

Personal developer accounts created after November 2023 must run a **closed test with at
least 12 testers who stay opted in for 14 days** before production access is granted.
This matches the plan's advice: give the app free to 10–20 real businesses first
(`PREMIUM.enforce: false`). Collect their Gmail addresses, add them to a closed testing
track, and gather feedback during the 14 days.

## Play Console forms – suggested answers

These follow from how the app works. You are responsible for the final declarations.

**App access:** Core features need no login. If you ship cloud sync, add instructions:
"Cloud sync (Settings → Cloud sync) needs a sign-in. Tap *Sign in with a password
instead* and use: email … / password …". Create that demo account in Supabase
(**Authentication → Users → Add user**, with a password) and invite it to a demo business.
There are no in-app purchases in this release.

**Ads:** No, the app does not contain ads.

**Content rating questionnaire:** Category "Utility, productivity, communication or
other". Answer "No" to violence, sexual content, profanity, drugs, gambling and location
sharing. Digital purchases: **No** (no in-app purchases in this release). Users
interacting: No (staff accounts only share business records inside one business).
Expected rating: Everyone / 3+.

**Target audience and content:** 18 and over (business tool). Not designed for children,
so the Families policy does not apply.

**Data safety – offline-only build (no Supabase keys):**
- *Does your app collect or share any of the required user data types?* **No.** All data
  stays on the device. Reminders, receipts and backups are sent by the user through other
  apps they choose. Purchases are handled by Google Play, and the app doesn't send purchase
  information anywhere.

**Data safety – build with cloud sync:**
- Collects data: **Yes**. Shares data: **No** (Supabase is your service provider, which
  doesn't count as sharing).
- Data types (all for **App functionality**; **optional**, because users choose to turn
  on sync; not used for ads or analytics):
  - Personal info → **Email address** (also **Account management**)
  - Personal info → **Name**, **Phone number**, **Address** (customer and staff details the
    user enters)
  - Financial info → **Other financial info** (fees and payment records)
- Encrypted in transit: **Yes** (HTTPS).
- Users can request deletion: **Yes**. Data deletion URL: your `accountDeletionUrl` page.
  Account deletion is also available in the app.

**Financial features declaration:** The app is a record-keeping tool. It doesn't move
money, connect to banks or wallets, give loans or process payments. Pick the option that
says the app provides none of the listed financial services.

**Government app / Health / News:** No.

## Store listing

**App name** (≤ 30 chars): `Fee Tracker: Collection Book` (28 characters)

**Short description** (≤ 80 chars):
`Track monthly fees, send WhatsApp reminders and see who paid at a glance.`

**Full description:**

```
Fee Tracker helps monthly service businesses keep their collection book on the phone
instead of a notebook. Internet and cable operators, tuition centres, gyms, hostels, milk
and water delivery, and committee collections all use the same simple flow.

• Add each customer once with their monthly fee
• Every month, all active customers appear as Unpaid automatically
• Mark paid in one tap, with amount and date filled in
• Partial payments, with the remaining balance carried to next month
• Record the method: cash, JazzCash, Easypaisa or bank transfer
• Paid, Unpaid and Partial lists for any month, by area or batch
• WhatsApp reminders to everyone unpaid, with name and amount filled in
• Receipts as an image or PDF, ready to share on WhatsApp
• Fee changes from any month, with full fee history
• Monthly and yearly reports, exported to PDF or Excel
• Alerts like "15 customers still unpaid this month"
• English and Urdu
• Works fully offline; save a backup file (for example to Google Drive) and restore on any phone

Also included: staff accounts with roles, several businesses, a reminder schedule, and
your payment details in reminders and receipts.

Private by design: your records stay on your phone unless you turn on cloud sync.
No ads, no tracking.

JazzCash and Easypaisa are trademarks of their owners. Fee Tracker is not affiliated with
them and does not process payments.
```

Remove the "cloud sync" phrases if you ship without it.

**Graphics** (in `docs/store/`):
- `play-icon-512.png`: 512×512 app icon, 32-bit PNG with alpha, no text or badges
- `feature-graphic-1024x500.png`: feature graphic, 1024×500, 24-bit PNG without alpha
- **Phone screenshots: you still need at least 2** (Google recommends 4 or more), 9:16,
  1080×1920, JPEG or 24-bit PNG without alpha. Install the internal-testing build on a
  phone, load `docs/store/sample-backup.json` through Settings → Restore backup, and take
  screenshots of Home, the Unpaid list, a customer page and Reports. No real customer
  details.

**Category:** Business. **Contact email:** `rehanch642@gmail.com`.
**Privacy policy URL:** https://rehan-ch.github.io/fee-tracker/privacy-policy.html

## Verified against "Google Play Publishing Requirements and Terms" (17 November 2026)

Checked on the first production bundle (`fee-tracker-1.0.0-vc2.aab`, EAS build
`d3ed5c35`). Sections 1, 2, 6, 8 and 9 of that document are account and process steps for
the publisher; the app-side items are below.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Android App Bundle | Done | `eas.json` production profile builds `app-bundle`. |
| Target API 36 | Done | Bundle manifest: `minSdkVersion` 24, `targetSdkVersion` 36, `compileSdkVersion` 37. |
| Play App Signing | At upload | Upload keystore generated and stored on EAS; accept Play App Signing on the first release. |
| Permanent package name | Done | `com.feetracker.app`, confirmed. |
| Version code increases | Done | `appVersionSource: remote` + `autoIncrement`; first build is versionCode 2. |
| 16 KB page size | Done | All 26 arm64 `.so` files in the bundle have 16 KB (`0x4000`) LOAD alignment. |
| Download size | Done | Bundle is 72 MB; Play serves per-device splits, well inside the limit. |
| App name ≤ 30 | Done | `Fee Tracker: Collection Book` (28). |
| Short description ≤ 80 | Done | 73 characters. |
| Full description ≤ 4,000 | Done | About 1,400 characters, no keyword stuffing. |
| Icon 512×512, 32-bit PNG with alpha, ≤ 1 MB, no badges | Done | `docs/store/play-icon-512.png` (RGBA, 4 KB). |
| Feature graphic 1024×500, no alpha | Done | `docs/store/feature-graphic-1024x500.png` (RGB, 16 KB). |
| At least 2 phone screenshots | **To do** | Take from the installed internal-testing build (see Graphics above). |
| Support email | Done | `rehanch642@gmail.com`. |
| Privacy policy: public web page, not a PDF, linked in the app | Done | https://rehan-ch.github.io/fee-tracker/privacy-policy.html; in-app under Settings → Privacy policy with a "Read online" button. |
| Data safety form | Answers ready | See "Play Console forms" above; offline build collects nothing. |
| Account deletion in app and on the web | Done | Settings → Cloud sync → Delete cloud account (when cloud sync is built in); https://rehan-ch.github.io/fee-tracker/delete-account.html. No accounts in the offline build. |
| Ads | None | No ad SDK. |
| App access | No login | Nothing needs credentials in the offline build. |
| Target audience / content rating | Answers ready | 18+, Everyone. |
| High-risk permissions | None | No SMS, call log, location, camera, microphone, all-files or exact-alarm permissions in the bundle. |
| Restricted content, impersonation, IP | Compliant | Original icon and graphics; Inter and Noto Nastaliq Urdu fonts (OFL); Ionicons (MIT); JazzCash / Easypaisa named only as payment methods with a disclaimer. |
| Privacy and user data | Compliant | Records stay on the phone; no analytics or tracking SDKs; policy explains every data flow. |
| Deceptive behaviour / minimum functionality | Compliant | Listing describes the shipped features; 98 automated tests, lint and typecheck pass. |
| Payments policy | N/A | No digital goods; the app only records payments made outside it. |
| Special app types (finance, loans, health, news…) | N/A | Record-keeping tool; declare "none" in the financial features form. |
| Third-party SDKs | Reviewed | Expo modules, React Native, SQLite, fflate; Supabase only when cloud keys are set. |
