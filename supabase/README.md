# Cloud sync server (Supabase)

Cloud sync is a premium feature and is **optional**: without the two environment variables
below, the app hides it and works fully offline.

## What runs on the server

Two migrations, applied in order (`npx supabase db push` does both):

`migrations/20261113000000_fee_tracker_sync.sql` creates:

- The same tables as the app (`businesses`, `areas`, `staff`, `customers`, `monthly_dues`,
  `payments`, `fee_changes`, `reminders_log`), each with a `server_updated_at` change-feed
  column.
- Row-level security: an account can only see businesses where it is a staff member, and
  can only write what its role allows (owner / manager / collector).
- Functions the app calls: `push_rows` (upload, newest `updated_at` wins), `pull_rows`
  (download changes), `link_business`, `my_businesses`, `join_business` (one-time invite
  codes, rate limited), `unlink_business` and `delete_my_account` (Play's account deletion
  requirement).

`migrations/20261114000000_security_hardening.sql` tightens it (see `../SECURITY.md`):

- Invite codes can be read by owners only (other roles could otherwise read a pending
  manager/owner code and promote themselves), and a member can't take a second place.
- Wrong invite codes now return no row instead of an error, so the attempt is really
  recorded and the limit of 10 per hour works.
- Collectors can add payments but not change or delete them.
- Every row is checked (sizes, number ranges, dates, ids); rows can't move to another
  business; `updated_at` is limited to one day ahead; deleted rows lose personal details.
- Security definer functions use an empty `search_path`.

Apply it to existing projects too. The app never uses a service key; everything goes
through these functions as the signed-in user.

## Set up

1. Create a project at [supabase.com](https://supabase.com). Choose a region close to your
   users (e.g. Mumbai `ap-south-1` for Pakistan).
2. Apply the migrations: `npx supabase db push` (after `npx supabase link`), or paste both
   SQL files into **SQL Editor** and run them in order.
3. **Authentication → Providers → Email**: keep Email enabled. Users sign in with a
   one-time code, so there are no passwords to manage.
4. **Authentication → Email Templates → Magic Link**: make the email show the code, e.g.
   `Your Fee Tracker code is {{ .Token }}`. (The app asks for the 6-digit code, not a link.)
5. **Authentication → SMTP**: add your own SMTP sender for production. Supabase's built-in
   sender is limited to a few emails per hour and is for testing only.
6. Put the project URL and publishable (anon) key in the app's environment:

   ```bash
   # .env (local) — see .env.example
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
   ```

   For EAS builds, add the same two variables in the Expo dashboard (or
   `npx eas-cli@latest env:create`) for the `preview` and `production` environments.

## Test the SQL locally

`tests/` checks the access rules on plain Postgres, with a small stand-in for Supabase's
`auth` schema:

```bash
docker run -d --rm --name ft-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55439:5432 postgres:16
export PGPASSWORD=test PGHOST=127.0.0.1 PGPORT=55439 PGUSER=postgres
psql -v ON_ERROR_STOP=1 -f supabase/tests/stub_auth.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql   # ends with "ALL RLS CHECKS PASSED"
docker stop ft-pg
```

## Before release

- Google Play **Data safety** changes when you ship cloud sync: see `docs/PLAY_STORE.md`.
- Only the publishable key goes in the app (it refuses secret / service_role keys). Use
  your own SMTP sender and keep the auth rate limits on: see `../SECURITY.md`.
- Publish an account deletion page and put its URL in `src/config.ts`
  (`PUBLISHER.accountDeletionUrl`) and in Play Console.
- Premium is checked on the phone. Staff phones that joined a business keep syncing even if
  the owner's subscription ends; if you need to enforce that, verify purchases on a server
  (Google Play Developer API) and store the result per business.
