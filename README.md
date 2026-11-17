<p align="center"><img src="assets/brand/logo-lockup.png" alt="Fee Tracker" width="480"></p>

# Fee Tracker (Monthly Fee Tracker)

An offline-first Android app for monthly service businesses: add a customer once, record
their payment each month, and see at a glance who has paid, who hasn't, and when.

Built with Expo SDK 58 (React Native 0.88), Expo Router and expo-sqlite. It implements
version 1, version 2 and the premium features of
[the feature plan](docs/Monthly%20Fee%20Tracker%20App%20Feature%20Plan.pdf).
For publishing, see [docs/PLAY_STORE.md](docs/PLAY_STORE.md); for the security model and
what to set up before release, see [SECURITY.md](SECURITY.md).

## Run it

Requires **Node 22.13+** (Expo SDK 58 does not support Node 20).

```bash
nvm use            # or any Node >= 22.13; see .nvmrc
npm install
npx expo start     # scan the QR code with Expo Go on an Android phone
```

Everything works in Expo Go. Two `app.json` settings only take effect in a real build
(`npm run build:preview`): the blocked permissions, and `supportsRTL: false`.

Optional cloud sync needs a Supabase project: copy `.env.example` to `.env` and follow
[supabase/README.md](supabase/README.md). Without it the app is fully offline.

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (Expo config, React Compiler rules) |
| `npm test` | Unit and database tests (Jest) |
| `npm run doctor` | expo-doctor dependency and config checks |
| `npm run build:preview` | Installable APK via EAS |
| `npm run build:production` | Play Store `.aab` via EAS |

## Screens

Bottom tabs: **Home, Collection, Customers, Reports, Settings**.

| # | Screen | Version | File |
| --- | --- | --- | --- |
| 1 | Welcome / setup | 1 | `src/app/setup.tsx` |
| 2 | Home (dashboard) | 1 | `src/app/(tabs)/index.tsx` |
| 3 | Monthly collection | 1 | `src/app/(tabs)/collection.tsx` |
| 4 | Record payment (bottom sheet) | 1 | `src/components/RecordPaymentSheet.tsx` |
| 5 | Customers list | 1 | `src/app/(tabs)/customers.tsx` |
| 6 | Add / edit customer | 1 | `src/components/CustomerForm.tsx`, `src/app/customer/new.tsx`, `src/app/customer/[id]/edit.tsx` |
| 7 | Customer detail | 1 | `src/app/customer/[id]/index.tsx` |
| 8 | Areas / groups | 1 | `src/app/areas.tsx` |
| 9 | Settings | 1 | `src/app/(tabs)/settings.tsx` (+ `business.tsx`, `privacy.tsx`) |
| 10 | Reminders (WhatsApp / SMS, one by one) | 2 | `src/app/reminders.tsx`, template: `src/app/messages.tsx` |
| 11 | Receipt preview (image / PDF) | 2 | `src/app/receipt/[id].tsx` |
| 12 | Reports (month / year, PDF / Excel) | 2 | `src/app/(tabs)/reports.tsx`, `src/lib/exportReport.ts` |
| 13 | Fee change + fee history | 2 | `src/app/customer/[id]/fee.tsx` |
| – | Owner alerts | 2 | `src/app/alerts.tsx`, `src/lib/notify.ts` |
| 14 | Staff management | Premium | `src/app/staff/`, switch user: `src/components/SwitchUserSheet.tsx` |
| – | Several businesses | Premium | `src/app/businesses.tsx` |
| – | Cloud sync, join with invite code | Premium | `src/app/cloud.tsx`, `src/app/join.tsx`, `src/sync/` |
| – | Payment details / payment link | Premium | `src/app/payment-details.tsx` |

Main flow: **Home → Open unpaid list → tap customer → Save payment**. That's 3 taps, after
which the customer moves to the Paid tab.

## Version 2 and premium, in short

- **WhatsApp reminders:** pick unpaid customers, preview the message (template with
  `{name}`, `{amount}`, `{month}`, `{business}`, `{phone}`, `{payment}`), then send one by
  one; each opens WhatsApp with the text typed in. SMS works the same way through the SMS
  app, so the app needs no SMS permission. Every reminder is logged (`reminders_log`).
- **Receipts:** after "Save and share receipt", or from any payment: image (view
  capture) or PDF (`expo-print`), shared through the share sheet, or sent as text to the
  customer's WhatsApp.
- **Reports:** monthly and yearly totals by area, method and collector; export to PDF or a
  real `.xlsx` file (`src/lib/xlsx.ts`).
- **Fee change:** from any month (past ones re-price billed months, future ones are
  scheduled); the history stays a consistent chain and any change can be undone.
- **Owner alerts:** local notifications, e.g. "15 customers still unpaid", on a chosen day.
- **Premium (`src/config.ts` → `PREMIUM`)**:
  - Staff with roles (owner / manager / collector), optional PINs on shared phones, and
    "received by" on every payment.
  - Several businesses.
  - Cloud sync through your own Supabase project.
  - A reminder schedule.
  - Payment details and link in reminders and receipts.

  Free for everyone in the first release (`enforce: false`); Google Play Billing is not
  shipped yet. `src/premium/state.ts` is where the store check goes when it is added, and
  [docs/PLAY_STORE.md](docs/PLAY_STORE.md) lists the steps.
- **Automatic sending** of WhatsApp/SMS without a tap isn't possible in a Play-compliant
  phone app (it needs the WhatsApp Business Platform on a server, or the restricted SMS
  permission). The reminder schedule prompts the owner instead, and sending stays one tap
  per customer.
- **Online payment links:** the app adds the business's own JazzCash/Easypaisa/bank
  payment page link. Generating per-customer payment requests needs a merchant account and
  server-side integration with those providers.

## How the money logic works

Defined in `src/lib/dues.ts` (pure functions) and `src/db/repo.ts` (database):

1. When the app opens or returns to the foreground, every active customer gets a
   `monthly_dues` row for each month from their start month up to now. This works offline
   and needs no server.
2. `carried_forward` = previous month's `total_due − paid_amount`. A positive value is
   unpaid balance. A negative value is an **advance**: an overpayment reduces next month's
   due instead of being lost. (The plan only carried positive balances; this extends it.)
3. Each payment updates `paid_amount` and `status` (unpaid / partial / paid), then
   recalculates the later months for that customer, so a late payment for an old month
   fixes everything after it.
4. The Paid / Unpaid / Partial tabs are queries on `monthly_dues` by month and status.

Other rules:
- **Fee change:** applies from the chosen month, is logged in `fee_changes`, and earlier
  months keep their old fee. `customers.monthly_fee` is the latest fee (it can be a
  scheduled future fee); lists show the fee for the current month.
- **Inactive customer:** gets no new dues. This month's due is removed unless money was
  already received. On reactivation, dues restart from the reactivation month, and the
  old unpaid balance carries over.
- **Soft delete:** every table has `created_at`, `updated_at` and `deleted_at`, which cloud
  sync relies on.
- **Due ids** are `customerId:month`, so two phones that create the same month offline
  end up with one row.

## Cloud sync

`src/sync/engine.ts`, with the server in `supabase/`:

- **Local changes:** SQLite triggers record writes to cloud-linked businesses in
  `sync_outbox`.
- **Push and pull:** sync uploads those rows, then downloads rows changed on the server.
  The newer `updated_at` wins on both sides.
- **Balances:** each phone recomputes balances from the payments, so payments taken
  offline on two phones add up correctly.
- **Access:** row-level security on the server limits each account to its businesses and
  its role. Staff join with one-time invite codes, which only owners can see.
- **Trust:** the server checks every uploaded row, and the phone checks every downloaded
  row and only writes rows of the business being synced. The sign-in session is kept in
  Android's encrypted SecureStore. See [SECURITY.md](SECURITY.md).

## Backup and restore

Settings → **Back up now** writes all tables (except PINs, invite codes and sync state) to
a JSON file and opens the Android share sheet, where the user picks Google Drive.
**Restore from backup** (owner only: it replaces staff and removes PINs) opens the system
file picker, where Drive appears too. The file (up to 50 MB) is checked row by row and the
restore runs in one transaction, so a bad file changes nothing. This avoids Google sign-in,
Drive API scopes and OAuth verification. Home shows a reminder if there's been no backup in
7 days.

## Urdu / right-to-left

The original strings live in `src/i18n/strings.ts`; newer ones live in one file per work
area under `src/i18n/groups/` (`design`, `core`, `customers`, `money`, `settings`), and
`strings.ts` merges them. Each file's Urdu dictionary is type-checked against its English
one, so a missing translation fails `npm run typecheck`. Keys must be unique across all
files, so new keys carry their area as a prefix (for example `coreHeroTitle`). Native RTL
mirroring is switched off (`supportsRTL: false`). Instead, the UI components (`Txt`,
`Row`, `Icon` with `flipForRTL`, the tab bar and others in `src/components/ui.tsx` and
`src/components/ds/`) lay themselves out right-to-left when Urdu is selected. Switching
language therefore applies instantly with no app restart.

## Design system and fonts

The full spec is [docs/DESIGN.md](docs/DESIGN.md) (Material 3, light theme, teal
`#0F766E`).

- **Tokens:** colours (status colours only for due status), type scales for Latin and
  Urdu, spacing, radii and shadows, all in `src/theme.ts`.
- **Fonts:** Inter for Latin text and every number, and Noto Nastaliq Urdu for Urdu
  (`@expo-google-fonts/inter`, `@expo-google-fonts/noto-nastaliq-urdu`, both OFL).
  `src/components/ds/fonts.ts` loads them at runtime with `useFonts` from `expo-font`,
  from the TTF files inside the npm packages. This works in Expo Go and makes no network
  request. The splash screen waits up to 6 seconds for them; a font error or a slow load
  falls back to the system font.
- **Components:** the shared kit is `src/components/ui.tsx` (`Txt`, `Amount`, `Button`,
  `Field`, `Card`, `ListItem`, `Banner`, …) and `src/components/ds/` (tab bar, bottom sheet,
  FAB, bottom action bar, form screen, meter, stat tile, KPI row, segmented bar). Each
  screen area keeps its own pieces in `src/components/core/`, `customers/`, `money/`
  (charts) and `settings/`. Charts are plain Views, with no chart or animation library.

## Tests

`npm test` (Jest) runs the real repository code against Node's built-in SQLite
(`src/db/testing/nodeSqlite.ts`):

- `src/db/__tests__/repo.test.ts`: carry-forward, partial payments, advance credit, late
  payments, month rollover, inactive/reactivate, start-date edits, filters, reports, and
  backup round-trip and rollback.
- `src/db/__tests__/v2.test.ts`: fee changes (past, current, future, undo), several
  businesses, staff and "received by", reminder log, the v1 → v2 migration and restoring
  version-1 backups.
- `src/sync/__tests__/engine.test.ts`: two phones syncing through a fake server (offline
  payments on both, conflicts, deletes, no endless re-uploads).
- `src/lib/__tests__/`: dates, money, phone numbers, WhatsApp links, templates, `.xlsx`
  output, alert dates, roles.
- `*/__tests__/security.test.ts`: row checks for restored and downloaded data, links into
  the app, PIN hashing, backup files, deletion of personal details, and a malicious sync
  server.
- `src/components/*/__tests__/links.test.ts`: the checks run before any link opens
  (call, WhatsApp, SMS, https and mailto), and the wrong-PIN pause.

The server's access rules are tested on Postgres with `supabase/tests/` (see
`supabase/README.md`).

## Project layout

```
src/
  app/            Expo Router screens (file = route)
  components/     UI kit (ui.tsx), pickers, payment sheet, customer form, reminders, switch user
    ds/           design-system pieces: fonts, tab bar, sheet, FAB, forms, meter, stat tiles
    core/ customers/ money/ settings/   per-area components (charts in money/)
  db/             schema + migrations, repository (all SQL), change events, useQuery hook
  i18n/           English and Urdu strings (strings.ts + groups/<area>.ts)
  lib/            dates, money, phone, dues, backup, templates, receipts, reports, xlsx, alerts
  premium/        premium state (store check goes here later)
  sync/           cloud sync engine, Supabase client, background runner
  state/          app state (business, staff role, premium, language) and background work
  config.ts       publisher details, premium settings, cloud keys
supabase/         server schema, access rules and their tests
docs/             feature plan, Play Store checklist, privacy policy and delete-account pages
                  (served by GitHub Pages), store graphics
scripts/          build-pages.mjs: renders docs/*.md into the hosted HTML pages;
                  build-brand.mjs: renders every logo asset from one vector mark
```

## Brand

The mark is a bold **F** (Fee) whose third line is a **check** (paid): white with a mint
check on the teal tile, teal on light surfaces. Everything that shows it (app icons,
adaptive icon layers, splash, notification icon, favicons, Play Store icon and feature
graphic, website and this README) is generated from one definition by
`node scripts/build-brand.mjs` (needs Google Chrome for rendering). Vector sources live in
`assets/brand/`. Change the geometry or colours there, rerun the script, and rebuild the
app.
