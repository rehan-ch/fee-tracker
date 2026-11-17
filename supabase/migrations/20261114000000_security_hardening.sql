-- Fee Tracker cloud sync: security hardening. Apply after
-- 20261113000000_fee_tracker_sync.sql (`supabase db push` applies both in order).
--
-- What this changes (see SECURITY.md for the full model):
--  1. join_business: failed invite-code attempts are now really recorded (an
--     error used to roll the record back, so the rate limit never triggered),
--     codes must look like real codes, and a member can't take a second staff
--     place in a business they already belong to.
--  2. Invite codes are visible to owners only: other roles could read a
--     pending owner/manager code and use it to promote themselves.
--  3. Collectors can add payments but no longer change or delete existing ones.
--  4. Every synced row is checked on the server: sizes, number ranges, date
--     formats, ids, and a business_id that can't move a row into another
--     business. updated_at can't be set far in the future (that would let one
--     phone lock a row against every later edit).
--  5. Deleted customers, staff, payments and businesses lose their personal
--     details on the server too.
--  6. Security definer functions use an empty search_path and validate input.

-- ---------------------------------------------------------------------------
-- Row checks (all synced tables, every insert and update, whatever the path)
-- ---------------------------------------------------------------------------

create or replace function public.tg_check_row() returns trigger
language plpgsql set search_path = '' as $$
declare
  j jsonb := to_jsonb(new);
  k text;
  v jsonb;
  ts_re constant text := '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$';
  id_re constant text := '^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$';
  latest text := to_char((now() + interval '1 day') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  for k, v in select e.key, e.value from jsonb_each(j) e loop
    if jsonb_typeof(v) = 'string' and length(v #>> '{}') > 4000 then
      raise exception 'value too long: %', k using errcode = 'check_violation';
    end if;
    if jsonb_typeof(v) = 'number' and abs((v #>> '{}')::numeric) > 1000000000000 then
      raise exception 'number out of range: %', k using errcode = 'check_violation';
    end if;
    if k in ('monthly_fee', 'fee_amount', 'paid_amount', 'old_fee', 'new_fee')
       and jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric < 0 then
      raise exception 'negative amount: %', k using errcode = 'check_violation';
    end if;
    -- Ids end up in the app's screen routes: letters, digits, ":", "_" and "-" only.
    if k in ('id', 'business_id', 'customer_id', 'area_id', 'monthly_due_id', 'received_by', 'sent_by')
       and jsonb_typeof(v) = 'string' and (v #>> '{}') !~ id_re then
      raise exception 'bad id: %', k using errcode = 'check_violation';
    end if;
  end loop;

  if new.created_at !~ ts_re or new.updated_at !~ ts_re
     or (new.deleted_at is not null and new.deleted_at !~ ts_re) then
    raise exception 'bad timestamp' using errcode = 'check_violation';
  end if;
  -- Last write wins on updated_at: a far-future value would win forever.
  if new.updated_at > latest then
    new.updated_at := latest;
  end if;

  if (j ? 'month' and (j->>'month') !~ '^\d{4}-(0[1-9]|1[0-2])$')
     or (j ? 'effective_month' and (j->>'effective_month') !~ '^\d{4}-(0[1-9]|1[0-2])$')
     or (j ? 'start_date' and (j->>'start_date') !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$')
     or (j ? 'paid_on' and (j->>'paid_on') !~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$')
     or (j ? 'sent_at' and (j->>'sent_at') !~ ts_re)
     or (j ? 'language' and (j->>'language') not in ('en', 'ur'))
     or (tg_table_name = 'payments' and (j->>'amount')::numeric <= 0) then
    raise exception 'bad value' using errcode = 'check_violation';
  end if;

  -- A row never moves to another business.
  if tg_op = 'UPDATE' and tg_table_name <> 'businesses'
     and (j->>'business_id') is distinct from (to_jsonb(old)->>'business_id') then
    raise exception 'business_id cannot change' using errcode = 'insufficient_privilege';
  end if;

  -- Personal details don't outlive a delete (the row stays as a tombstone for sync).
  if new.deleted_at is not null then
    new := jsonb_populate_record(new, (case tg_table_name
      when 'customers' then '{"name": "", "phone": null, "address": null, "notes": null}'
      when 'staff' then '{"phone": null, "invite_code": null}'
      when 'payments' then '{"note": null}'
      when 'fee_changes' then '{"note": null}'
      when 'businesses' then '{"name": "", "phone": null, "reminder_template": null, "payment_info": null, "payment_link": null}'
      else '{}' end)::jsonb);
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['businesses', 'areas', 'staff', 'customers', 'monthly_dues',
                           'payments', 'fee_changes', 'reminders_log'] loop
    execute format('drop trigger if exists check_row on public.%I', t);
    execute format('create trigger check_row before insert or update on public.%I
                    for each row execute function public.tg_check_row()', t);
  end loop;
end $$;

-- staff.user_id links an account to a business. Only join_business,
-- link_business and delete_my_account (security definer, which set
-- app.linking) may change it; a signed-in user's own statements never can.
-- A linked staff member has no invite code any more.
create or replace function public.tg_staff_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.linking', true), '') <> 'on'
     or current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.user_id := null;
    else
      new.user_id := old.user_id;
    end if;
  end if;
  if new.user_id is not null then
    new.invite_code := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Access rules
-- ---------------------------------------------------------------------------

create or replace function public.member_role(bid text) returns text
language sql stable security definer set search_path = '' as $$
  select s.role from public.staff s
  where s.business_id = bid and s.user_id = (select auth.uid())::text and s.deleted_at is null
  order by case s.role when 'owner' then 0 when 'manager' then 1 else 2 end
  limit 1
$$;

-- Collectors record payments; only owners and managers change or delete them.
drop policy if exists collectors_keep_payments on public.payments;
drop policy if exists managers_edit_payments on public.payments;
create policy managers_edit_payments on public.payments as restrictive for update to authenticated
  using (public.member_role(business_id) in ('owner', 'manager'))
  with check (public.member_role(business_id) in ('owner', 'manager'));

-- Invite codes: never readable straight from the table. Owners get them
-- through pull_rows; everyone else gets staff rows without them.
revoke select on public.staff from authenticated;
grant select (id, business_id, name, phone, role, user_id, created_at, updated_at, deleted_at,
              server_updated_at) on public.staff to authenticated;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

create or replace function public.assert_sync_table(p_table text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_table is null or p_table not in ('businesses', 'areas', 'staff', 'customers', 'monthly_dues',
                                        'payments', 'fee_changes', 'reminders_log') then
    raise exception 'unknown table' using errcode = '22023';
  end if;
end $$;

-- Upload one staff row (owners only). Staff rows need their own path because
-- signed-in users can't read invite_code from the table, which an upsert of
-- the whole row needs. Mirrors the staff policies: the caller must own the
-- row's business, and the business of the copy already stored.
create or replace function public.push_staff_row(r jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  old_bid text;
begin
  if jsonb_typeof(r) is distinct from 'object' then
    raise exception 'bad row' using errcode = '22023';
  end if;
  perform set_config('app.linking', 'off', true);
  select s.business_id into old_bid from public.staff s where s.id = r->>'id';
  if public.member_role(r->>'business_id') is distinct from 'owner'
     or (old_bid is not null and public.member_role(old_bid) is distinct from 'owner') then
    raise exception 'only the owner can change staff' using errcode = '42501';
  end if;
  insert into public.staff as t (id, business_id, name, phone, role, user_id, invite_code,
                                 created_at, updated_at, deleted_at)
    select p.id, p.business_id, p.name, p.phone, p.role, p.user_id, p.invite_code,
           p.created_at, p.updated_at, p.deleted_at
      from jsonb_populate_record(null::public.staff, r) p
  on conflict (id) do update set
    business_id = excluded.business_id, name = excluded.name, phone = excluded.phone,
    role = excluded.role, user_id = excluded.user_id, invite_code = excluded.invite_code,
    created_at = excluded.created_at, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
  where t.updated_at <= excluded.updated_at;
end $$;

-- Upload rows. A row replaces the server copy only if its updated_at is the
-- same or newer (last write wins). Rows the caller may not write, or that
-- fail the row checks, are skipped and counted, so one bad row can't block a
-- phone's sync forever. Runs as the caller, so row-level security applies.
create or replace function public.push_rows(p_table text, p_rows jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  r jsonb;
  cols text;
  sets text;
  skipped integer := 0;
begin
  perform public.assert_sync_table(p_table);
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'send an array of at most 500 rows' using errcode = '22023';
  end if;
  perform set_config('app.linking', 'off', true);
  select string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('%I = excluded.%I', c.column_name, c.column_name), ', ' order by c.ordinal_position)
           filter (where c.column_name <> 'id')
    into cols, sets
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = p_table and c.column_name <> 'server_updated_at';
  for r in select e.value from jsonb_array_elements(p_rows) e loop
    begin
      if jsonb_typeof(r) is distinct from 'object' then
        raise exception 'bad row' using errcode = '22023';
      end if;
      if p_table = 'staff' then
        perform public.push_staff_row(r);
      else
        execute format(
          'insert into public.%1$I as t (%2$s)
             select %2$s from jsonb_populate_record(null::public.%1$I, $1)
           on conflict (id) do update set %3$s
             where t.updated_at <= excluded.updated_at',
          p_table, cols, sets) using r;
      end if;
    exception when insufficient_privilege or check_violation or not_null_violation or data_exception then
      skipped := skipped + 1;
    end;
  end loop;
  return skipped;
end $$;

-- Download one business's rows changed after (p_since_ts, p_since_id), oldest
-- first. p_overlap re-reads the last minute in case a slow upload committed
-- with an earlier time than rows already downloaded. Members only (the same
-- rule as the tables' read policies); invite codes go to owners only.
create or replace function public.pull_rows(
  p_table text,
  p_business text,
  p_since_ts timestamptz,
  p_since_id text,
  p_limit integer,
  p_overlap boolean
) returns table (data jsonb, ts timestamptz, row_id text)
language plpgsql stable security definer set search_path = '' as $$
declare
  scope text := case when p_table = 'businesses' then 'id' else 'business_id' end;
  since_ts timestamptz := coalesce(p_since_ts, '-infinity'::timestamptz);
  since_id text := coalesce(p_since_id, '');
  my_role text;
  hidden text[] := array['server_updated_at'];
begin
  perform public.assert_sync_table(p_table);
  my_role := public.member_role(p_business);
  if my_role is null then
    return;
  end if;
  if my_role <> 'owner' then
    hidden := hidden || array['invite_code'];
  end if;
  if p_overlap and p_since_ts is not null then
    since_ts := p_since_ts - interval '60 seconds';
    since_id := '';
  end if;
  return query execute format(
    'select to_jsonb(t) - $5, t.server_updated_at, t.id
       from public.%1$I t
      where t.%2$I = $1 and (t.server_updated_at, t.id) > ($2, $3)
      order by t.server_updated_at, t.id
      limit $4', p_table, scope)
    using p_business, since_ts, since_id, least(greatest(coalesce(p_limit, 500), 1), 1000), hidden;
end $$;

-- Put a business in the cloud, owned by the caller. Its other rows follow
-- with push_rows. Calling it again for your own business does nothing.
create or replace function public.link_business(p_business jsonb, p_owner jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  bid text := p_business->>'id';
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(p_business) is distinct from 'object' or jsonb_typeof(p_owner) is distinct from 'object'
     or bid is null then
    raise exception 'bad input' using errcode = '22023';
  end if;
  if exists (select 1 from public.businesses b where b.id = bid) then
    if public.member_role(bid) is distinct from 'owner' then
      raise exception 'business belongs to another account' using errcode = '42501';
    end if;
    return;
  end if;
  -- Keeps one account from filling the database with businesses.
  if (select count(*) from public.staff s
      where s.user_id = uid::text and s.role = 'owner' and s.deleted_at is null) >= 20 then
    raise exception 'too many businesses' using errcode = '54000';
  end if;
  perform set_config('app.linking', 'on', true);
  insert into public.businesses
    select * from jsonb_populate_record(null::public.businesses, p_business);
  insert into public.staff
    select * from jsonb_populate_record(null::public.staff,
      p_owner || jsonb_build_object('business_id', bid, 'role', 'owner', 'user_id', uid::text,
                                    'invite_code', null, 'deleted_at', null));
  perform set_config('app.linking', 'off', true);
end $$;

-- Businesses the caller belongs to (for a new or reinstalled phone).
create or replace function public.my_businesses()
returns table (business_id text, name text, role text, staff_id text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name, s.role, s.id
  from public.staff s join public.businesses b on b.id = s.business_id
  where s.user_id = (select auth.uid())::text and s.deleted_at is null and b.deleted_at is null
  order by b.name
$$;

-- A staff member joins with the code the owner shared. Codes work once.
-- A wrong code returns no row (instead of an error, which would undo the
-- record of the failed attempt); after 10 wrong codes in an hour the account
-- has to wait. Someone who already belongs to the business gets their
-- existing place back and the code stays unused.
create or replace function public.join_business(p_code text)
returns table (business_id text, staff_id text, role text)
language plpgsql security definer set search_path = '' as $$
declare
  s public.staff;
  uid uuid := auth.uid();
  code text := upper(btrim(coalesce(p_code, '')));
  matched boolean := false;
  existing record;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from public.join_attempts a where a.user_id = uid and a.at < now() - interval '1 day';
  if (select count(*) from public.join_attempts a
      where a.user_id = uid and a.at > now() - interval '1 hour') >= 10 then
    raise exception 'too many attempts' using errcode = '54000';
  end if;
  if code ~ '^[A-Z0-9]{8,32}$' then
    select * into s from public.staff st
     where st.invite_code = code and st.deleted_at is null and st.user_id is null
     order by st.id
     limit 1 for update;
    matched := found;
  end if;
  if not matched then
    insert into public.join_attempts (user_id) values (uid);
    return;
  end if;
  select m.id, m.role into existing from public.staff m
   where m.business_id = s.business_id and m.user_id = uid::text and m.deleted_at is null
   order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end
   limit 1;
  if found then
    return query select s.business_id, existing.id::text, existing.role::text;
    return;
  end if;
  perform set_config('app.linking', 'on', true);
  update public.staff st
     set user_id = uid::text,
         invite_code = null,
         updated_at = to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   where st.id = s.id;
  perform set_config('app.linking', 'off', true);
  return query select s.business_id, s.id, s.role;
end $$;

-- Owner removes a business from the cloud. Phones keep their own copy.
create or replace function public.unlink_business(p_business text) returns void
language plpgsql security definer set search_path = '' as $$
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
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  bid text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  for bid in select s.business_id from public.staff s
             where s.user_id = uid::text and s.role = 'owner' and s.deleted_at is null loop
    perform public.unlink_business(bid);
  end loop;
  perform set_config('app.linking', 'on', true);
  update public.staff set user_id = null where user_id = uid::text;
  perform set_config('app.linking', 'off', true);
  delete from public.join_attempts where user_id = uid;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.tg_check_row() from public, anon, authenticated;
revoke all on function public.push_staff_row(jsonb) from public, anon;
revoke all on function public.member_role(text) from public, anon;
revoke all on function public.push_rows(text, jsonb) from public, anon;
revoke all on function public.pull_rows(text, text, timestamptz, text, integer, boolean) from public, anon;
revoke all on function public.link_business(jsonb, jsonb) from public, anon;
revoke all on function public.my_businesses() from public, anon;
revoke all on function public.join_business(text) from public, anon;
revoke all on function public.unlink_business(text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.assert_sync_table(text) from public, anon;
grant execute on function public.push_staff_row(jsonb), public.assert_sync_table(text) to authenticated;
grant execute on function public.member_role(text), public.push_rows(text, jsonb),
  public.pull_rows(text, text, timestamptz, text, integer, boolean),
  public.link_business(jsonb, jsonb), public.my_businesses(), public.join_business(text),
  public.unlink_business(text), public.delete_my_account() to authenticated;
