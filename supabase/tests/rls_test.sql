-- Checks for the sync functions and access rules. Run after the migrations,
-- as a superuser, with psql -v ON_ERROR_STOP=1. Each check raises on failure.
\set owner '11111111-1111-1111-1111-111111111111'
\set collector '22222222-2222-2222-2222-222222222222'
\set stranger '33333333-3333-3333-3333-333333333333'
\set guesser '44444444-4444-4444-4444-444444444444'
insert into auth.users values (:'owner'), (:'collector'), (:'stranger'), (:'guesser');

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

set role authenticated;

-- Owner puts a business in the cloud and uploads data.
select set_config('request.jwt.claim.sub', :'owner', false);
select public.link_business(
  '{"id":"b1","name":"City Cable","currency":"PKR","language":"en","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:00.000Z"}',
  '{"id":"s1","name":"","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:00.000Z"}');
select pg_temp.check(public.member_role('b1') = 'owner', 'owner role after link');
select pg_temp.check(public.push_rows('customers', '[{"id":"c1","business_id":"b1","name":"Ali","monthly_fee":2000,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:01.000Z"}]') = 0, 'owner adds customer');
select pg_temp.check(public.push_rows('staff', '[{"id":"s2","business_id":"b1","name":"Imran","role":"collector","invite_code":"ABCD2345","user_id":"forged","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:02.000Z"}]') = 0, 'owner adds collector');
select pg_temp.check((select user_id from public.staff where id = 's2') is null, 'uploaded user_id is ignored');
select pg_temp.check((select count(*) from public.pull_rows('customers', 'b1', null, null, 100, false)) = 1, 'owner downloads customers');
-- A pending manager invite that only the owner may see.
select pg_temp.check(public.push_rows('staff', '[{"id":"s3","business_id":"b1","name":"Sana","role":"manager","invite_code":"MGRX2345","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:03.000Z"}]') = 0, 'owner adds a manager invite');
select pg_temp.check((select data->>'invite_code' from public.pull_rows('staff', 'b1', null, null, 100, false) where row_id = 's3') = 'MGRX2345', 'owner downloads invite codes');
select pg_temp.check(public.push_rows('staff', '[{"id":"s3","business_id":"b1","name":"Sana K","role":"manager","invite_code":"MGRX2345","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:04.000Z"}]') = 0, 'owner edits a staff member');
select pg_temp.check((select name from public.staff where id = 's3') = 'Sana K', 'staff edit stored');

-- Older copy loses (last write wins).
select public.push_rows('customers', '[{"id":"c1","business_id":"b1","name":"OLD","monthly_fee":2000,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:00.500Z"}]');
select pg_temp.check((select name from public.customers where id = 'c1') = 'Ali', 'older update ignored');

-- Row checks: bad values are skipped, a far-future updated_at can't lock a row.
select pg_temp.check(public.push_rows('customers', '[{"id":"c9","business_id":"b1","name":"Big","monthly_fee":-5,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:01.000Z"}]') = 1, 'negative fee rejected');
select pg_temp.check(public.push_rows('customers', '[{"id":"../staff/edit","business_id":"b1","name":"X","monthly_fee":1,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:01.000Z"}]') = 1, 'id with path characters rejected');
select pg_temp.check(public.push_rows('customers', format('[{"id":"c9","business_id":"b1","name":"%s","monthly_fee":1,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:01.000Z"}]', repeat('x', 5000))::jsonb) = 1, 'oversized text rejected');
select pg_temp.check(public.push_rows('customers', '[{"id":"c9","business_id":"b1","name":"Bad","monthly_fee":"lots","start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:01.000Z"}]') = 1, 'wrong type skipped, not an error');
select pg_temp.check(public.push_rows('customers', '[{"id":"c9","business_id":"b1","name":"Bad","monthly_fee":1,"start_date":"someday","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:01.000Z"}]') = 1, 'bad date rejected');
select pg_temp.check(public.push_rows('customers', '[{"id":"c8","business_id":"b1","name":"Future","monthly_fee":1,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2999-01-01T00:00:00.000Z"}]') = 0, 'future row accepted');
select pg_temp.check((select updated_at from public.customers where id = 'c8') < '2999', 'far-future updated_at is clamped');
do $$ begin
  perform public.push_rows('customers', '{"id":"c7"}');
  raise exception 'FAILED: non-array accepted';
exception when invalid_parameter_value then raise notice 'ok: push needs an array';
end $$;

-- Collector joins with the code.
select set_config('request.jwt.claim.sub', :'collector', false);
select pg_temp.check((select role from public.join_business(' abcd2345 ')) = 'collector', 'collector joins with code');
select pg_temp.check((select count(*) from public.my_businesses()) = 1, 'collector sees the business');
select pg_temp.check(public.push_rows('customers', '[{"id":"c1","business_id":"b1","name":"Hacked","monthly_fee":0,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-02T00:00:00.000Z"}]') = 1, 'collector cannot edit customers');
select pg_temp.check(public.push_rows('payments', '[{"id":"p1","business_id":"b1","monthly_due_id":"c1:2026-11","customer_id":"c1","amount":500,"paid_on":"2026-11-02","method":"cash","received_by":"s2","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-02T00:00:00.000Z"}]') = 0, 'collector records a payment');
select pg_temp.check(public.push_rows('payments', '[{"id":"p1","business_id":"b1","monthly_due_id":"c1:2026-11","customer_id":"c1","amount":500,"paid_on":"2026-11-02","method":"cash","received_by":"s2","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-03T00:00:00.000Z","deleted_at":"2026-11-03T00:00:00.000Z"}]') = 1, 'collector cannot delete a payment');
select pg_temp.check(public.push_rows('payments', '[{"id":"p1","business_id":"b1","monthly_due_id":"c1:2026-11","customer_id":"c1","amount":50,"paid_on":"2026-11-02","method":"cash","received_by":"s2","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-03T00:00:00.000Z"}]') = 1, 'collector cannot change a payment');
select pg_temp.check((select amount from public.payments where id = 'p1') = 500, 'payment amount unchanged');
select pg_temp.check(public.push_rows('payments', '[{"id":"p2","business_id":"b1","monthly_due_id":"c1:2026-11","customer_id":"c1","amount":0,"paid_on":"2026-11-02","method":"cash","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-02T00:00:00.000Z"}]') = 1, 'zero payment rejected');

-- Invite codes stay with the owner.
select pg_temp.check((select count(*) from public.pull_rows('staff', 'b1', null, null, 100, false)) = 3, 'collector downloads staff');
select pg_temp.check(not exists (select 1 from public.pull_rows('staff', 'b1', null, null, 100, false) where data ? 'invite_code'), 'collector gets no invite codes');
do $$ begin
  perform invite_code from public.staff;
  raise exception 'FAILED: invite codes readable from the table';
exception when insufficient_privilege then raise notice 'ok: invite codes not readable from the table';
end $$;
select pg_temp.check((select count(*) from public.staff) = 3, 'other staff columns stay readable');
-- Even knowing the code, a member can't take a second (higher) place.
select pg_temp.check((select role from public.join_business('MGRX2345')) = 'collector', 'member keeps their own role');
select pg_temp.check(public.member_role('b1') = 'collector', 'no promotion through an invite');
reset role;
select pg_temp.check((select user_id from public.staff where id = 's3') is null and (select invite_code from public.staff where id = 's3') = 'MGRX2345', 'invite stays unused');
set role authenticated;

-- A collector who owns another business can't move rows into it.
select public.link_business(
  '{"id":"b2","name":"Own Shop","currency":"PKR","language":"en","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:00.000Z"}',
  '{"id":"s20","name":"","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:00.000Z"}');
select pg_temp.check(public.push_rows('reminders_log', '[{"id":"r1","business_id":"b1","customer_id":"c1","channel":"whatsapp","sent_at":"2026-11-02T00:00:00.000Z","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-02T00:00:00.000Z"}]') = 0, 'collector logs a reminder');
select pg_temp.check(public.push_rows('reminders_log', '[{"id":"r1","business_id":"b2","customer_id":"c1","channel":"whatsapp","sent_at":"2026-11-02T00:00:00.000Z","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-03T00:00:00.000Z"}]') = 1, 'rows cannot move to another business');
select pg_temp.check(public.push_rows('staff', '[{"id":"s9","business_id":"b1","name":"Fake","role":"owner","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-01T00:00:00.000Z"}]') = 1, 'collector cannot add staff');
select pg_temp.check(public.push_rows('staff', '[{"id":"s2","business_id":"b1","name":"Imran","role":"owner","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-05T00:00:00.000Z"}]') = 1, 'collector cannot promote themselves');
select pg_temp.check(public.push_rows('staff', '[{"id":"s2","business_id":"b2","name":"Imran","role":"owner","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-05T00:00:00.000Z"}]') = 1, 'collector cannot pull a staff row into their business');

-- Wrong codes are counted (the attempt is kept) and limited.
select set_config('request.jwt.claim.sub', :'guesser', false);
select pg_temp.check((select count(*) from public.join_business('WRONG234')) = 0, 'wrong code returns nothing');
select pg_temp.check((select count(*) from public.join_business('ABCD2345')) = 0, 'used code returns nothing');
select pg_temp.check((select count(*) from public.join_business('x')) = 0, 'malformed code returns nothing');
reset role;
select pg_temp.check((select count(*) from public.join_attempts where user_id = :'guesser') = 3, 'failed attempts are recorded');
set role authenticated;
do $$ begin
  for i in 1..7 loop perform public.join_business('WRONG234'); end loop;
end $$;
do $$ begin
  perform public.join_business('MGRX2345');
  raise exception 'FAILED: rate limit not applied';
exception when program_limit_exceeded then raise notice 'ok: too many attempts';
end $$;
reset role;
select pg_temp.check((select user_id from public.staff where id = 's3') is null, 'rate-limited guess changes nothing');
set role authenticated;

-- A stranger sees and changes nothing.
select set_config('request.jwt.claim.sub', :'stranger', false);
select pg_temp.check((select count(*) from public.pull_rows('customers', 'b1', null, null, 100, false)) = 0, 'stranger sees nothing');
select pg_temp.check((select count(*) from public.customers) = 0, 'stranger reads nothing from the tables');
select pg_temp.check(public.push_rows('payments', '[{"id":"p9","business_id":"b1","monthly_due_id":"x","customer_id":"c1","amount":1,"paid_on":"2026-11-02","method":"cash","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-02T00:00:00.000Z"}]') = 1, 'stranger cannot write');
select pg_temp.check(public.push_rows('payments', '[{"id":"p1","business_id":"b1","monthly_due_id":"x","customer_id":"c1","amount":1,"paid_on":"2026-11-02","method":"cash","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-12-02T00:00:00.000Z"}]') = 1, 'stranger cannot overwrite');
select pg_temp.check(public.push_rows('staff', '[{"id":"s1","business_id":"b1","name":"Me","role":"owner","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-12-01T00:00:00.000Z"}]') = 1, 'stranger cannot take over the owner row');
do $$ begin
  perform public.link_business('{"id":"b1","name":"Mine","created_at":"x","updated_at":"x"}', '{"id":"s9","name":"","created_at":"x","updated_at":"x"}');
  raise exception 'FAILED: took over a business';
exception when insufficient_privilege then raise notice 'ok: cannot claim another business';
end $$;
do $$ begin
  perform public.unlink_business('b1');
  raise exception 'FAILED: stranger removed a business';
exception when insufficient_privilege then raise notice 'ok: stranger cannot remove a business';
end $$;
do $$ begin
  perform public.pull_rows('pg_authid', 'b1', null, null, 100, false);
  raise exception 'FAILED: unknown table accepted';
exception when invalid_parameter_value then raise notice 'ok: only sync tables';
end $$;

-- A stale staff copy from the owner's phone can't remove the collector's access.
select set_config('request.jwt.claim.sub', :'owner', false);
select public.push_rows('staff', '[{"id":"s2","business_id":"b1","name":"Imran K","role":"collector","invite_code":"ABCD2345","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2099-01-01T00:00:00.000Z"}]');
select pg_temp.check((select user_id from public.staff where id = 's2') = '22222222-2222-2222-2222-222222222222', 'collector link survives a stale upload');
select pg_temp.check((select data->>'invite_code' from public.pull_rows('staff', 'b1', null, null, 100, false) where row_id = 's2') is null, 'a linked member has no invite code');

-- Owner can still edit and delete payments; deleting a customer clears their details.
select pg_temp.check(public.push_rows('payments', '[{"id":"p1","business_id":"b1","monthly_due_id":"c1:2026-11","customer_id":"c1","amount":500,"paid_on":"2026-11-02","method":"cash","note":"cash at shop","created_at":"2026-11-02T00:00:00.000Z","updated_at":"2026-11-04T00:00:00.000Z","deleted_at":"2026-11-04T00:00:00.000Z"}]') = 0, 'owner deletes a payment');
select pg_temp.check((select note from public.payments where id = 'p1') is null, 'deleted payment note cleared');
select pg_temp.check(public.push_rows('customers', '[{"id":"c1","business_id":"b1","name":"Ali","phone":"03001234567","address":"Street 1","notes":"gate 2","monthly_fee":2000,"start_date":"2026-11-01","status":"active","created_at":"2026-11-01T00:00:00.000Z","updated_at":"2026-11-04T00:00:00.000Z","deleted_at":"2026-11-04T00:00:00.000Z"}]') = 0, 'owner deletes a customer');
select pg_temp.check((select name = '' and phone is null and address is null and notes is null from public.customers where id = 'c1'), 'deleted customer details cleared');

-- Change feed paging and overlap.
select pg_temp.check((select count(*) from public.pull_rows('staff', 'b1', null, null, 1, false)) = 1, 'page size respected');
select pg_temp.check((select count(*) from public.pull_rows('staff', 'b1', now() + interval '1 hour', 'zzz', 100, false)) = 0, 'nothing after the cursor');
select pg_temp.check((select count(*) from public.pull_rows('staff', 'b1', clock_timestamp(), 'zzz', 100, true)) = 3, 'overlap re-reads the last minute');

-- Owner deletes their account: business data and login are gone.
select public.delete_my_account();
reset role;
select pg_temp.check((select count(*) from public.businesses where id = 'b1') = 0, 'business removed');
select pg_temp.check((select count(*) from public.payments) = 0, 'payments removed');
select pg_temp.check(not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'login removed');
select pg_temp.check((select count(*) from public.businesses where id = 'b2') = 1, 'other accounts keep their businesses');
\echo ALL RLS CHECKS PASSED
