# Security

How Fee Tracker protects its data, what was checked, and what you (the owner/publisher)
must do before and after release. Report a vulnerability to the contact email in
`src/config.ts` (`PUBLISHER.contactEmail`).

## Security model

**On the phone (offline, the default)**

- All records live in the app's private SQLite database. Every query uses bound
  parameters; table and column names only come from constants in the code or the app's
  own schema. `secure_delete` is on, so deleted rows are overwritten in the file.
- **Deleting** a customer, payment, staff member or business keeps a tombstone (cloud sync
  needs it) but clears names, phone numbers, addresses and notes, on the phone and on the
  server. **Delete all data** empties every table and the write-ahead log, removes exported
  files from the cache, clears shown and scheduled alerts, and signs out of cloud sync.
- **Roles** (owner / manager / collector, `src/lib/permissions.ts`) are checked when a
  screen opens and again in every action handler, never only by hiding a button. Only the
  owner may **restore** a backup (a restore replaces staff and removes PINs).
- **Staff PINs** are stored as PBKDF2-HMAC-SHA256 with a random salt per PIN
  (`src/lib/pin.ts`); old 1.0 hashes are upgraded after the next correct entry. Wrong
  PINs pause entry: 5 tries, then 30 s, doubling up to 1 hour, saved on the phone so a
  restart doesn't reset it. A 4-6 digit PIN only guards switching user on a shared phone;
  someone with a copy of the app's data could still try all PINs offline, but they would
  already have the data itself. Never reuse a bank or phone PIN here.
- **Backups** are plain JSON chosen by the user (Drive etc.) and are not encrypted. They
  never contain PINs, sync state or invite codes. A restore checks the file size (50 MB),
  every row (ids, types, sizes, allowed values, dates; `src/lib/rowSchema.ts`) and runs
  in one transaction, so a bad or malicious file changes nothing.
- **Links**: the app opens only `https:` (account deletion page), `mailto:` (contact),
  `tel:`, `sms:` and `https://wa.me/` links built from validated phone numbers and
  URL-encoded text. Links into the app (`feetracker://...`) can open only the main tabs and
  the privacy policy (`src/app/+native-intent.tsx`); alert taps open only the unpaid list
  or reminders, rebuilt from checked parts, and never switch a non-owner into another
  business.
- **Receipts and reports**: every value is HTML-escaped (`esc()`), the print page has a
  Content-Security-Policy with no scripts and no network. Excel cells are inline strings
  (a value starting with `=` is never a formula).
- **Logs** never contain error objects or personal data, and only print in development.
- **Android**: no SMS, contacts, storage or media permissions (`blockedPermissions` in
  `app.json`; `expo-secure-store` adds none). Release builds use Android's default of no
  cleartext HTTP (Expo allows it only in debug builds, for the dev server). Links into the
  app arrive through the `feetracker` scheme on the main activity.

**Cloud sync (optional, premium)**: `supabase/migrations/`

- The app holds only the Supabase URL and **publishable** key. It refuses to turn cloud
  sync on with a non-https URL or a secret / service_role key (`src/lib/cloudKeys.ts`).
- The sign-in session is kept in Android's encrypted SecureStore (`expo-secure-store`),
  which is left out of device backups.
- Every table has row-level security: an account sees only businesses where it is a staff
  member, and writes only what its role allows. Collectors can add payments but not change
  or delete them; only owners change staff or business settings.
- Invite codes (8 random characters from a 32-letter alphabet, made with a secure random
  generator) are readable by owners only, work once, can't give an existing member a
  second place, and wrong codes are counted: 10 per hour per account.
- The server checks every row (sizes, number ranges, date formats, ids), never lets a row
  move to another business, and clamps `updated_at` to at most one day ahead so nobody can
  lock a row against later edits.
- Security definer functions use an empty `search_path`; table names passed to
  `push_rows` / `pull_rows` are checked against a fixed list.
- The phone checks downloaded rows again and only writes rows of the business being
  synced, never overwriting or attaching to another business on the phone.

## What you must do

1. **Apply both migrations** in `supabase/migrations/` in order (`npx supabase db push`).
   `20261114000000_security_hardening.sql` fixes the issues listed above; apply it to any
   project that already has the first migration. Run Supabase's **Security Advisor**
   (Dashboard → Advisors) afterwards.
2. **Only the publishable key in the app.** Put `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_KEY` in `.env` (git-ignored) or EAS environment variables. Never
   put the secret / service_role key anywhere in this project. If a secret key was ever
   committed, shared or built into an app, **rotate it** in Supabase (Project Settings →
   API Keys) and rebuild.
3. **Email sign-in**: set up your own SMTP sender (Authentication → SMTP), keep the OTP
   expiry short (≤ 10 minutes), and keep Supabase's auth rate limits on. Consider enabling
   CAPTCHA protection for sign-ups if you see abuse.
4. **Play review demo account**: give it a long unique password and only a demo business.
5. **Account deletion page**: publish it and set `PUBLISHER.accountDeletionUrl` (https) in
   `src/config.ts` and in Play Console. Complete requests that arrive through the page
   within the time you promise: in the Supabase SQL editor, delete the businesses that
   account owns and then the login (the same steps as `delete_my_account` in the
   migration), or ask the user to use **Delete cloud account** in the app.
6. **Backups of the database** (Supabase PITR / daily backups) keep deleted data for their
   retention period; keep the privacy policy's wording in line with your plan.
7. **Keys and signing**: keep Play App Signing on; the upload key is managed by EAS. Don't
   commit keystores (`*.jks`, `*.p12` are git-ignored).
8. **Premium is checked on the phone.** A determined user can unlock it on their own phone.
   If that matters, verify purchases on a server (Google Play Developer API) and store the
   result per business.

9. **First release build**: check the merged Android manifest (Android Studio's
   *Merged Manifest* view, or `aapt dump xmltree`) for permissions and exported
   components you don't expect.

## Accepted risks and limits

- **Device backup** (`allowBackup: true`) lets Android copy the app database (customer
  records, PIN hashes) into the user's Google backup, encrypted with their screen lock.
  It is kept on so a lost phone doesn't lose the business's records; the sign-in session
  is excluded. Set `allowBackup` to `false` in `app.json` if you prefer the opposite.
- The database file on the phone is not encrypted beyond Android's device encryption;
  a rooted or unlocked phone exposes it.
- Staff are trusted with the data their role can see. A collector still sees every
  customer's phone number and balance, and the derived month totals (`monthly_dues`) are
  written by every phone.
- Invite codes don't expire; remove a staff member who never joined to cancel their code.
- An ex-member who knows a business's id could link that id first after the owner removes
  the business from the cloud, which would stop the owner re-linking it (data stays safe).
- `npm audit` reports moderate issues only in development and build tools (Jest, ESLint,
  `@expo/fingerprint` → `minimatch`); none of them is in the app bundle. The suggested
  fixes are downgrades to older Expo/Jest versions, so they are not applied.

## Tests

- `npm test`: includes `src/lib/__tests__/security.test.ts`, `src/db/__tests__/security.test.ts`
  and `src/sync/__tests__/security.test.ts` (row checks, links, PINs, backups, deletion,
  malicious sync data).
- Server rules: `supabase/tests/rls_test.sql` (see `supabase/README.md`).
