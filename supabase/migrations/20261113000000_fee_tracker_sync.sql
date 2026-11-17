-- Fee Tracker cloud sync (premium): server schema for Supabase.
--
-- Mirrors the app's local SQLite tables. Every row carries business_id
-- (businesses use their own id) and server_updated_at, which orders the
-- change feed phones download from. Phones talk to the database only through
-- the functions at the bottom; row-level security limits each signed-in
-- account to the businesses where it is a staff member, with what its role
-- allows:
--   owner     everything, including staff and business settings
--   manager   customers, areas, fees, payments; not staff or business settings
--   collector record payments and reminders; read everything else
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.businesses (
  id text primary key,
  name text not null,
  phone text,
  currency text not null default 'PKR',
  language text not null default 'en',
  reminder_template text,
  payment_info text,
  payment_link text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.areas (
  id text primary key,
  business_id text not null,
  name text not null,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.staff (
  id text primary key,
  business_id text not null,
  name text not null,
  phone text,
  role text not null check (role in ('owner', 'manager', 'collector')),
  user_id text,
  invite_code text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);
create index staff_user_idx on public.staff (user_id) where deleted_at is null;
create index staff_invite_idx on public.staff (invite_code) where invite_code is not null;

create table public.customers (
  id text primary key,
  business_id text not null,
  area_id text,
  name text not null,
  phone text,
  address text,
  monthly_fee bigint not null default 0,
  start_date text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.monthly_dues (
  id text primary key,
  business_id text not null,
  customer_id text not null,
  month text not null,
  fee_amount bigint not null,
  carried_forward bigint not null default 0,
  total_due bigint not null,
  paid_amount bigint not null default 0,
  status text not null check (status in ('unpaid', 'partial', 'paid')),
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.payments (
  id text primary key,
  business_id text not null,
  monthly_due_id text not null,
  customer_id text not null,
  amount bigint not null,
  paid_on text not null,
  method text not null check (method in ('cash', 'jazzcash', 'easypaisa', 'bank')),
  received_by text,
  note text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.fee_changes (
  id text primary key,
  business_id text not null,
  customer_id text not null,
  old_fee bigint not null,
  new_fee bigint not null,
  effective_month text not null,
  note text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table public.reminders_log (
  id text primary key,
  business_id text not null,
  customer_id text not null,
  monthly_due_id text,
  channel text not null check (channel in ('whatsapp', 'sms')),
  sent_at text not null,
  sent_by text,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- Failed invite-code attempts, to slow down guessing.
create table public.join_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index join_attempts_idx on public.join_attempts (user_id, at);

-- Change feed indexes.
create index businesses_feed on public.businesses (id, server_updated_at);
create index areas_feed on public.areas (business_id, server_updated_at, id);
create index staff_feed on public.staff (business_id, server_updated_at, id);
create index customers_feed on public.customers (business_id, server_updated_at, id);
create index monthly_dues_feed on public.monthly_dues (business_id, server_updated_at, id);
create index payments_feed on public.payments (business_id, server_updated_at, id);
create index fee_changes_feed on public.fee_changes (business_id, server_updated_at, id);
create index reminders_log_feed on public.reminders_log (business_id, server_updated_at, id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.tg_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

-- staff.user_id links an account to a business. Only join_business and
-- link_business may set it, so a stale copy uploaded by another phone can't
-- remove or forge access.
create or replace function public.tg_staff_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.linking', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.user_id := null;
    else
      new.user_id := old.user_id;
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['businesses', 'areas', 'staff', 'customers', 'monthly_dues',
                           'payments', 'fee_changes', 'reminders_log'] loop
    execute format('create trigger touch before insert or update on public.%I
                    for each row execute function public.tg_touch()', t);
  end loop;
end $$;

create trigger staff_guard before insert or update on public.staff
  for each row execute function public.tg_staff_guard();

-- ---------------------------------------------------------------------------
-- Access rules
-- ---------------------------------------------------------------------------

-- The caller's role in a business, or null if they are not a member.
create or replace function public.member_role(bid text) returns text
language sql stable security definer set search_path = public as $$
  select s.role from public.staff s
  where s.business_id = bid and s.user_id = (select auth.uid())::text and s.deleted_at is null
  order by case s.role when 'owner' then 0 when 'manager' then 1 else 2 end
  limit 1
$$;

alter table public.businesses enable row level security;
alter table public.areas enable row level security;
alter table public.staff enable row level security;
alter table public.customers enable row level security;
alter table public.monthly_dues enable row level security;
alter table public.payments enable row level security;
alter table public.fee_changes enable row level security;
alter table public.reminders_log enable row level security;
alter table public.join_attempts enable row level security;

create policy read on public.businesses for select to authenticated
  using (public.member_role(id) is not null);
create policy owner_update on public.businesses for update to authenticated
  using (public.member_role(id) = 'owner') with check (public.member_role(id) = 'owner');

create policy read on public.staff for select to authenticated
  using (public.member_role(business_id) is not null);
create policy owner_insert on public.staff for insert to authenticated
  with check (public.member_role(business_id) = 'owner');
create policy owner_update on public.staff for update to authenticated
  using (public.member_role(business_id) = 'owner')
  with check (public.member_role(business_id) = 'owner');

do $$
declare t text;
begin
  -- Customer data: owners and managers write, everyone in the business reads.
  foreach t in array array['areas', 'customers', 'fee_changes'] loop
    execute format('create policy read on public.%I for select to authenticated
                    using (public.member_role(business_id) is not null)', t);
    execute format('create policy manage_insert on public.%I for insert to authenticated
                    with check (public.member_role(business_id) in (''owner'', ''manager''))', t);
    execute format('create policy manage_update on public.%I for update to authenticated
                    using (public.member_role(business_id) in (''owner'', ''manager''))
                    with check (public.member_role(business_id) in (''owner'', ''manager''))', t);
  end loop;
  -- Collection data: any member writes (collectors record payments).
  foreach t in array array['monthly_dues', 'reminders_log', 'payments'] loop
    execute format('create policy read on public.%I for select to authenticated
                    using (public.member_role(business_id) is not null)', t);
    execute format('create policy member_insert on public.%I for insert to authenticated
                    with check (public.member_role(business_id) is not null)', t);
    execute format('create policy member_update on public.%I for update to authenticated
                    using (public.member_role(business_id) is not null)
                    with check (public.member_role(business_id) is not null)', t);
  end loop;
end $$;

-- Collectors can't delete payments.
create policy collectors_keep_payments on public.payments as restrictive for update to authenticated
  using (true)
  with check (deleted_at is null or public.member_role(business_id) in ('owner', 'manager'));

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.businesses, public.areas, public.staff, public.customers,
  public.monthly_dues, public.payments, public.fee_changes, public.reminders_log to authenticated;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

create or replace function public.assert_sync_table(p_table text) returns void
language plpgsql immutable as $$
begin
  if p_table not in ('businesses', 'areas', 'staff', 'customers', 'monthly_dues', 'payments',
                     'fee_changes', 'reminders_log') then
    raise exception 'unknown table %', p_table;
  end if;
end $$;

-- Upload rows. A row replaces the server copy only if its updated_at is the
-- same or newer (last write wins). Rows the caller may not write are skipped
-- and counted, so one bad row can't block a phone's sync forever.
create or replace function public.push_rows(p_table text, p_rows jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  r jsonb;
  cols text;
  sets text;
  skipped integer := 0;
begin
  perform public.assert_sync_table(p_table);
  select string_agg(format('%I', column_name), ', ' order by ordinal_position),
         string_agg(format('%I = excluded.%I', column_name, column_name), ', ' order by ordinal_position)
           filter (where column_name <> 'id')
    into cols, sets
    from information_schema.columns
   where table_schema = 'public' and table_name = p_table and column_name <> 'server_updated_at';
  for r in select value from jsonb_array_elements(p_rows) loop
    begin
      execute format(
        'insert into public.%1$I as t (%2$s)
           select %2$s from jsonb_populate_record(null::public.%1$I, $1)
         on conflict (id) do update set %3$s
           where t.updated_at <= excluded.updated_at',
        p_table, cols, sets) using r;
    exception when insufficient_privilege or check_violation or not_null_violation then
      skipped := skipped + 1;
    end;
  end loop;
  return skipped;
end $$;

-- Download one business's rows changed after (p_since_ts, p_since_id), oldest
-- first. p_overlap re-reads the last minute in case a slow upload committed
-- with an earlier time than rows already downloaded.
create or replace function public.pull_rows(
  p_table text,
  p_business text,
  p_since_ts timestamptz,
  p_since_id text,
  p_limit integer,
  p_overlap boolean
) returns table (data jsonb, ts timestamptz, row_id text)
language plpgsql stable security invoker set search_path = public as $$
declare
  scope text := case when p_table = 'businesses' then 'id' else 'business_id' end;
  since_ts timestamptz := coalesce(p_since_ts, '-infinity'::timestamptz);
  since_id text := coalesce(p_since_id, '');
begin
  perform public.assert_sync_table(p_table);
  if p_overlap and p_since_ts is not null then
    since_ts := p_since_ts - interval '60 seconds';
    since_id := '';
  end if;
  return query execute format(
    'select to_jsonb(t) - ''server_updated_at'', t.server_updated_at, t.id
       from public.%1$I t
      where t.%2$I = $1 and (t.server_updated_at, t.id) > ($2, $3)
      order by t.server_updated_at, t.id
      limit $4', p_table, scope)
    using p_business, since_ts, since_id, least(greatest(p_limit, 1), 1000);
end $$;

-- Put a business in the cloud, owned by the caller. Its other rows follow
-- with push_rows. Calling it again for your own business does nothing.
create or replace function public.link_business(p_business jsonb, p_owner jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  bid text := p_business->>'id';
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if exists (select 1 from public.businesses where id = bid) then
    if public.member_role(bid) is distinct from 'owner' then
      raise exception 'business belongs to another account' using errcode = '42501';
    end if;
    return;
  end if;
  perform set_config('app.linking', 'on', true);
  insert into public.businesses
    select * from jsonb_populate_record(null::public.businesses, p_business);
  insert into public.staff
    select * from jsonb_populate_record(null::public.staff,
      p_owner || jsonb_build_object('business_id', bid, 'role', 'owner', 'user_id', auth.uid()::text,
                                    'invite_code', null, 'deleted_at', null));
  perform set_config('app.linking', 'off', true);
end $$;

-- Businesses the caller belongs to (for a new or reinstalled phone).
create or replace function public.my_businesses()
returns table (business_id text, name text, role text, staff_id text)
language sql stable security definer set search_path = public as $$
  select b.id, b.name, s.role, s.id
  from public.staff s join public.businesses b on b.id = s.business_id
  where s.user_id = auth.uid()::text and s.deleted_at is null and b.deleted_at is null
  order by b.name
$$;

-- A staff member joins with the code the owner shared. Codes work once.
create or replace function public.join_business(p_code text)
returns table (business_id text, staff_id text, role text)
language plpgsql security definer set search_path = public as $$
declare
  s public.staff;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if (select count(*) from public.join_attempts a
      where a.user_id = uid and a.at > now() - interval '1 hour') >= 10 then
    raise exception 'too many attempts' using errcode = '54000';
  end if;
  select * into s from public.staff st
   where st.invite_code = upper(trim(p_code)) and st.deleted_at is null and st.user_id is null
   limit 1 for update;
  if not found then
    insert into public.join_attempts (user_id) values (uid);
    raise exception 'invalid code' using errcode = 'P0002';
  end if;
  perform set_config('app.linking', 'on', true);
  update public.staff
     set user_id = uid::text,
         invite_code = null,
         updated_at = to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   where id = s.id;
  perform set_config('app.linking', 'off', true);
  return query select s.business_id, s.id, s.role;
end $$;

-- Owner removes a business from the cloud. Phones keep their own copy.
create or replace function public.unlink_business(p_business text) returns void
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if public.member_role(p_business) is distinct from 'owner' then
    raise exception 'only the owner can do this' using errcode = '42501';
  end if;
  foreach t in array array['reminders_log', 'fee_changes', 'payments', 'monthly_dues', 'customers',
                           'staff', 'areas'] loop
    execute format('delete from public.%I where business_id = $1', t) using p_business;
  end loop;
  delete from public.businesses where id = p_business;
end $$;

-- Delete the caller's account (Google Play account deletion requirement):
-- businesses they own are removed from the cloud, their staff links in other
-- businesses are cleared, then the login itself is deleted.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  bid text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  for bid in select s.business_id from public.staff s
             where s.user_id = uid::text and s.role = 'owner' and s.deleted_at is null loop
    perform public.unlink_business(bid);
  end loop;
  perform set_config('app.linking', 'on', true);
  update public.staff set user_id = null where user_id = uid::text;
  delete from public.join_attempts where user_id = uid;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.member_role(text) from public, anon;
revoke all on function public.push_rows(text, jsonb) from public, anon;
revoke all on function public.pull_rows(text, text, timestamptz, text, integer, boolean) from public, anon;
revoke all on function public.link_business(jsonb, jsonb) from public, anon;
revoke all on function public.my_businesses() from public, anon;
revoke all on function public.join_business(text) from public, anon;
revoke all on function public.unlink_business(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.member_role(text), public.push_rows(text, jsonb),
  public.pull_rows(text, text, timestamptz, text, integer, boolean),
  public.link_business(jsonb, jsonb), public.my_businesses(), public.join_business(text),
  public.unlink_business(text), public.delete_my_account() to authenticated;
