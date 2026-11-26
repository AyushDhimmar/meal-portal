-- =====================================================================
-- Meal Portal — initial schema, v2 (Supabase / Postgres 15+)
-- Supersedes 0001_meal_portal_schema.sql after DB review (24 Nov 2026).
-- Review fixes are tagged [R#] — see the review notes for each number.
--
-- Layout
--   public   : tables, views and the RPC functions the app calls (exposed by PostgREST)
--   private  : helpers used by RLS and by the RPCs (NOT exposed by PostgREST)
--
-- Volumes this is sized for: ~2,000 employees, ~40k meals/month, years of history.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm with schema extensions;        -- [R14] Supabase keeps extensions out of public

create schema if not exists private;
revoke all on schema private from public;

-- [R1] Supabase's default privileges give anon/authenticated EXECUTE on every new function
--      and ALL on every new table in public. Turn that off for everything this migration creates,
--      then grant explicitly at the end.
alter default privileges in schema public  revoke all on tables    from public, anon, authenticated;
alter default privileges in schema public  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- ---------- Enums ----------------------------------------------------
create type employee_status as enum ('active', 'inactive');
create type app_role        as enum ('admin', 'verifier');
create type cycle_status    as enum ('draft', 'open', 'closed', 'locked');
create type billing_basis   as enum ('opted', 'consumed');
create type enroll_source   as enum ('self', 'admin_override');
create type serve_method    as enum ('code', 'scan', 'name', 'paper');

-- ---------- Settings -------------------------------------------------
create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('timezone',        '"Asia/Kolkata"'),                                  -- [R3] all "today"/serving-time logic uses this
  ('allowed_domain',  '"1rivet.com"'),
  ('cycle_defaults',  '{"weekdays":[1,2,3,4],"price_paise":5000,"optin_open_day":15,"optin_close_day":25,"serve_start":"12:30","serve_end":"14:30","enforce_serving_window":false,"billing_basis":"opted"}'),
  ('monthly_email',   '{"enabled":true,"day":1,"time":"08:00","recipients":"all_admins"}'),
  ('jobs',            '{"fallback_list_time":"11:00","nightly_backup_time":"02:00","backup_retention_days":90}');

-- ---------- Employees & roles ---------------------------------------
create table employees (
  id           uuid primary key default gen_random_uuid(),
  emp_code     text collate "C" not null unique                         -- [R15] "C" collation: prefix LIKE uses the unique btree
                 check (emp_code ~ '^E[0-9]{4,6}$'),
  name         text not null check (length(trim(name)) > 0),
  email        text not null unique check (email = lower(email)),       -- [R10] one canonical form, plain unique index serves lookups
  department   text,
  status       employee_status not null default 'active',
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index employees_name_trgm on employees using gin (name extensions.gin_trgm_ops);  -- [R15] matches "name ILIKE '%q%'"

create table user_roles (
  employee_id uuid not null references employees(id) on delete restrict,  -- [R12] employees are deactivated, never deleted
  role        app_role not null,
  created_at  timestamptz not null default now(),
  primary key (employee_id, role)
);

-- ---------- Cycles ---------------------------------------------------
create table lunch_cycles (
  id                     uuid primary key default gen_random_uuid(),
  month                  date not null unique check (extract(day from month) = 1),
  status                 cycle_status not null default 'draft',
  price_paise            integer not null check (price_paise > 0),
  weekdays               smallint[] not null
                           check (cardinality(weekdays) between 1 and 7                 -- [R8] array_length('{}') is NULL, so v1 let '{}' through
                                  and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  optin_opens_at         timestamptz not null,
  optin_closes_at        timestamptz not null,
  serve_start            time not null default '12:30',
  serve_end              time not null default '14:30',
  enforce_serving_window boolean not null default false,
  billing_basis          billing_basis not null default 'opted',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (optin_closes_at > optin_opens_at),
  check (serve_end > serve_start)
);

create table cycle_holidays (
  cycle_id uuid not null references lunch_cycles(id) on delete cascade,
  day      date not null,
  label    text,
  primary key (cycle_id, day)
);

-- ---------- Enrollments & meals -------------------------------------
create table enrollments (
  cycle_id    uuid not null references lunch_cycles(id) on delete restrict,
  employee_id uuid not null references employees(id)    on delete restrict,   -- [R12] v1 cascaded and would erase billing history
  opted_in    boolean not null,
  source      enroll_source not null default 'self',
  updated_at  timestamptz not null default now(),
  primary key (cycle_id, employee_id)
);
create index enrollments_employee on enrollments (employee_id);                -- [R11] FK + "my enrollments" lookups

-- [R9] v1 stored cycle_id on meal_logs as well as served_on; the two could disagree.
--      The cycle is fully determined by served_on's month, so it is no longer stored.
create table meal_logs (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete restrict,
  served_on   date not null,
  served_at   timestamptz not null default now(),
  served_by   uuid references employees(id) on delete restrict,
  method      serve_method not null default 'code',
  voided_at   timestamptz,
  voided_by   uuid references employees(id) on delete restrict,
  void_reason text,
  check ((voided_at is null) = (void_reason is null))
);
-- THE duplicate-meal guard + "my history" (employee_id leading)
create unique index meal_logs_one_per_day on meal_logs (employee_id, served_on) where voided_at is null;
-- [R11] daily counts, live dashboard and monthly billing all range-scan by day; employee_id included
--       so counts and per-employee aggregation can be answered from the index
create index meal_logs_day_emp on meal_logs (served_on, employee_id) where voided_at is null;
-- [R11] full (not partial) index for "this employee's history incl. voided meals", the FK from employees,
--       and RLS's "employee_id = me()" — the partial unique index above cannot serve queries that
--       don't also say "voided_at is null"
create index meal_logs_employee on meal_logs (employee_id, served_on);

-- ---------- Audit ----------------------------------------------------
create table audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor_id  uuid references employees(id) on delete restrict,
  action    text not null,
  entity    text not null,
  entity_id text,
  before    jsonb,
  after     jsonb,
  reason    text
);
create index audit_log_at     on audit_log (at desc);                       -- [R11] audit screen = newest first
create index audit_log_entity on audit_log (entity, entity_id, at desc);    -- "history of this employee/cycle"

-- =====================================================================
-- private helpers
-- =====================================================================
-- [R2] RLS calls these on every row unless wrapped as (select private.fn()) in the policy, which
--      makes Postgres run them once per statement (an InitPlan). All policies below do that.
create or replace function private.me() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.employees where auth_user_id = auth.uid() and status = 'active'
$$;

create or replace function private.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_roles where employee_id = private.me() and role = r)
$$;

create or replace function private.is_admin() returns boolean
language sql stable set search_path = public, pg_temp as $$ select private.has_role('admin') $$;

-- [R3] local clock: Supabase runs in UTC, the canteen runs in IST
create or replace function private.tz() returns text
language sql stable set search_path = public, pg_temp as $$
  select coalesce((select value #>> '{}' from public.app_settings where key = 'timezone'), 'UTC')
$$;
create or replace function private.local_now() returns timestamp
language sql stable set search_path = public, pg_temp as $$ select now() at time zone private.tz() $$;
create or replace function private.today() returns date
language sql stable set search_path = public, pg_temp as $$ select private.local_now()::date $$;

-- [R16] one-day check without building the whole month
create or replace function private.is_lunch_day(p_cycle public.lunch_cycles, p_day date) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select date_trunc('month', p_day)::date = p_cycle.month
     and extract(dow from p_day)::smallint = any (p_cycle.weekdays)
     and not exists (select 1 from public.cycle_holidays h where h.cycle_id = p_cycle.id and h.day = p_day)
$$;

create or replace function private.require_reason(p_reason text) returns void
language plpgsql set search_path = public, pg_temp as $$
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001', hint = 'A reason of at least 5 characters is required';
  end if;
end $$;

-- reason travels from an RPC to the audit trigger through a transaction-local setting
create or replace function private.set_reason(p_reason text) returns void
language sql set search_path = public, pg_temp as $$ select set_config('app.reason', p_reason, true) $$;
create or replace function private.reason() returns text
language sql stable set search_path = public, pg_temp as $$ select nullif(current_setting('app.reason', true), '') $$;

create or replace function private.write_audit(p_action text, p_entity text, p_entity_id text,
                                               p_before jsonb, p_after jsonb, p_reason text)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after, reason)
  values (private.me(), p_action, p_entity, p_entity_id, p_before, p_after, coalesce(p_reason, private.reason()))
$$;

-- =====================================================================
-- Triggers
-- =====================================================================
-- updated_at maintenance (v1 declared the columns but never set them)            [R13]
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
create trigger touch before update on employees      for each row execute function private.touch_updated_at();
create trigger touch before update on lunch_cycles   for each row execute function private.touch_updated_at();
create trigger touch before update on enrollments    for each row execute function private.touch_updated_at();
create trigger touch before update on app_settings   for each row execute function private.touch_updated_at();

-- [R5] generic audit for every table Admins can write directly through the API
--      (v1 only audited what went through RPCs; a direct role change left no trace)
create or replace function private.audit_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.write_audit(lower(tg_op), tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'employee_id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'key'),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end,
          null);
  return null;
end $$;
create trigger audit after insert or update or delete on employees      for each row execute function private.audit_row();
create trigger audit after insert or update or delete on user_roles     for each row execute function private.audit_row();
create trigger audit after insert or update or delete on lunch_cycles   for each row execute function private.audit_row();
create trigger audit after insert or update or delete on cycle_holidays for each row execute function private.audit_row();
create trigger audit after insert or update or delete on app_settings   for each row execute function private.audit_row();

-- [R6] audit_log is append-only for everyone, including the table owner and service role
create or replace function private.audit_immutable() returns trigger
language plpgsql as $$ begin raise exception 'AUDIT_LOG_IS_APPEND_ONLY'; end $$;
create trigger immutable before update or delete on audit_log for each row execute function private.audit_immutable();
create trigger immutable_truncate before truncate on audit_log for each statement execute function private.audit_immutable();

-- [R5] cycle rules live in the table, not only in set_cycle_status(): direct API updates are held to them too
create or replace function private.guard_cycle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and not ((old.status = 'draft'  and new.status = 'open')
           or (old.status = 'open'   and new.status = 'closed')
           or (old.status = 'closed' and new.status = 'locked')) then
    raise exception 'INVALID_TRANSITION % -> %', old.status, new.status;
  end if;
  -- once closed, money-affecting fields need a reason (set via admin_update_cycle)
  if tg_op = 'UPDATE' and old.status in ('closed','locked')
     and (new.price_paise, new.weekdays, new.billing_basis, new.month)
         is distinct from (old.price_paise, old.weekdays, old.billing_basis, old.month)
     and private.reason() is null then
    raise exception 'REASON_REQUIRED' using hint = 'Use admin_update_cycle() for a closed or locked cycle';
  end if;
  -- opt-in must close before the month starts (in local time)
  if new.optin_closes_at > (new.month::timestamp at time zone private.tz()) then
    raise exception 'OPTIN_MUST_CLOSE_BEFORE_MONTH_STARTS';
  end if;
  return new;
end $$;
create trigger guard before insert or update on lunch_cycles for each row execute function private.guard_cycle();

create or replace function private.guard_holiday() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cycle public.lunch_cycles;
begin
  select * into v_cycle from public.lunch_cycles
   where id = case when tg_op = 'DELETE' then old.cycle_id else new.cycle_id end;
  if tg_op <> 'DELETE' and date_trunc('month', new.day)::date <> v_cycle.month then
    raise exception 'Holiday % is outside the cycle month', new.day;
  end if;
  if v_cycle.status in ('closed','locked') and private.reason() is null then   -- changes billing for everyone
    raise exception 'REASON_REQUIRED' using hint = 'Use admin_set_holiday() for a closed or locked cycle';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger guard before insert or update or delete on cycle_holidays for each row execute function private.guard_holiday();

-- [R17] live counter for Verifiers. Realtime "postgres_changes" respects RLS, and Verifiers cannot read
--       meal_logs, so v1's plan (subscribe to meal_logs) gave them nothing. Broadcast counts instead.
create or replace function private.broadcast_counter() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_day date := coalesce(new.served_on, old.served_on);
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    perform realtime.send(jsonb_build_object('day', v_day,
              'served', (select count(*) from public.meal_logs where served_on = v_day and voided_at is null)),
            'counter_update', 'counter:' || v_day::text, true);   -- private channel; authorize via RLS on realtime.messages
  end if;
  return null;
end $$;
create trigger broadcast after insert or update on meal_logs for each row execute function private.broadcast_counter();

-- =====================================================================
-- Views (security_invoker: the caller's RLS applies)                     [R7]
-- =====================================================================
create or replace view v_lunch_days with (security_invoker = true) as
select c.id as cycle_id, d::date as day
from lunch_cycles c
cross join lateral generate_series(c.month::timestamp, c.month + interval '1 month - 1 day', interval '1 day') d
where extract(dow from d)::smallint = any (c.weekdays)
  and not exists (select 1 from cycle_holidays h where h.cycle_id = c.id and h.day = d::date);

-- [R4] v1 ran two correlated sub-queries for every (cycle x employee) row, including a full
--      lunch-day expansion per row. Now: lunch days counted once per cycle, meals aggregated once
--      by range-scanning meal_logs_day_emp, then joined.
create or replace view v_monthly_bill with (security_invoker = true) as
with days as (
  select cycle_id, count(*)::int as lunch_days from v_lunch_days group by cycle_id
), meals as (
  select c.id as cycle_id, m.employee_id, count(*)::int as consumed_days
  from lunch_cycles c
  join meal_logs m on m.served_on >= c.month and m.served_on < (c.month + interval '1 month')::date
                  and m.voided_at is null
  group by c.id, m.employee_id
)
select c.id as cycle_id, c.month, e.id as employee_id, e.emp_code, e.name, e.department, e.status,
       case when coalesce(en.opted_in, false) then coalesce(d.lunch_days, 0) else 0 end as opted_days,
       coalesce(ml.consumed_days, 0) as consumed_days,
       c.billing_basis, c.price_paise,
       (case when c.billing_basis = 'opted'
             then case when coalesce(en.opted_in, false) then coalesce(d.lunch_days, 0) else 0 end
             else coalesce(ml.consumed_days, 0) end) * c.price_paise as payable_paise
from lunch_cycles c
join employees e on true
left join enrollments en on en.cycle_id = c.id and en.employee_id = e.id
left join days  d  on d.cycle_id = c.id
left join meals ml on ml.cycle_id = c.id and ml.employee_id = e.id
where e.status = 'active' or en.employee_id is not null or ml.employee_id is not null;   -- skip long-gone staff with no data

-- =====================================================================
-- Row Level Security                                                       [R2]
-- One policy per command (no overlapping permissive policies), helpers wrapped in (select …)
-- =====================================================================
alter table employees      enable row level security;
alter table user_roles     enable row level security;
alter table lunch_cycles   enable row level security;
alter table cycle_holidays enable row level security;
alter table enrollments    enable row level security;
alter table meal_logs      enable row level security;
alter table audit_log      enable row level security;
alter table app_settings   enable row level security;

create policy sel on employees      for select to authenticated using (id = (select private.me()) or (select private.is_admin()));
create policy ins on employees      for insert to authenticated with check ((select private.is_admin()));
create policy upd on employees      for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy sel on user_roles     for select to authenticated using (employee_id = (select private.me()) or (select private.is_admin()));
create policy ins on user_roles     for insert to authenticated with check ((select private.is_admin()));
create policy del on user_roles     for delete to authenticated using ((select private.is_admin()));

create policy sel on lunch_cycles   for select to authenticated using ((select private.me()) is not null);
create policy ins on lunch_cycles   for insert to authenticated with check ((select private.is_admin()));
create policy upd on lunch_cycles   for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy sel on cycle_holidays for select to authenticated using ((select private.me()) is not null);
create policy ins on cycle_holidays for insert to authenticated with check ((select private.is_admin()));
create policy del on cycle_holidays for delete to authenticated using ((select private.is_admin()));

create policy sel on enrollments    for select to authenticated using (employee_id = (select private.me()) or (select private.is_admin()));
create policy sel on meal_logs      for select to authenticated using (employee_id = (select private.me()) or (select private.is_admin()));
create policy sel on audit_log      for select to authenticated using ((select private.is_admin()));

create policy sel on app_settings   for select to authenticated using ((select private.me()) is not null);
create policy upd on app_settings   for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
-- enrollments, meal_logs, audit_log: no write policies — writes only through the RPCs below.

-- =====================================================================
-- RPC — Employee
-- =====================================================================
create or replace function set_my_enrollment(p_cycle_id uuid, p_opted_in boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare c lunch_cycles; v_me uuid := private.me(); v_days int;
begin
  if v_me is null then raise exception 'NOT_AN_EMPLOYEE'; end if;
  select * into c from lunch_cycles where id = p_cycle_id;
  if not found then raise exception 'CYCLE_NOT_FOUND'; end if;                      -- [R18] v1: NULL comparisons skipped the check
  if c.status <> 'open' or now() not between c.optin_opens_at and c.optin_closes_at then
    raise exception 'CUTOFF_PASSED' using hint = 'The opt-in window for this cycle is closed';
  end if;
  insert into enrollments (cycle_id, employee_id, opted_in, source)
  values (p_cycle_id, v_me, p_opted_in, 'self')
  on conflict (cycle_id, employee_id) do update set opted_in = excluded.opted_in, source = 'self';
  select count(*) into v_days from v_lunch_days where cycle_id = p_cycle_id;
  return jsonb_build_object('opted_in', p_opted_in, 'lunch_days', v_days,
                            'estimate_paise', case when p_opted_in then v_days * c.price_paise else 0 end);
end $$;

-- =====================================================================
-- RPC — Verifier (counter)
-- =====================================================================
create or replace function verify_and_serve(p_emp_code text, p_day date default null,
                                            p_mark boolean default true, p_method serve_method default 'code')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := private.today();                                                -- [R3] IST, not server UTC
  v_day   date := coalesce(p_day, v_today);
  v_code  text := upper(trim(p_emp_code));
  e employees; c lunch_cycles; v_at timestamptz; v_emp jsonb;
begin
  if not (private.has_role('verifier') or private.has_role('admin')) then raise exception 'FORBIDDEN'; end if;
  if v_day <> v_today and not private.has_role('admin') then raise exception 'TODAY_ONLY'; end if;

  select * into e from employees where emp_code = v_code;                         -- unique btree
  if not found then return jsonb_build_object('result','NOT_FOUND','code',v_code); end if;
  v_emp := jsonb_build_object('emp_code', e.emp_code, 'name', e.name, 'department', e.department);
  if e.status <> 'active' then return jsonb_build_object('result','INACTIVE','employee',v_emp); end if;

  select * into c from lunch_cycles where month = date_trunc('month', v_day)::date;   -- unique btree
  if not found or not private.is_lunch_day(c, v_day) then                         -- [R16] no month expansion
    return jsonb_build_object('result','NOT_LUNCH_DAY','employee',v_emp);
  end if;
  if c.enforce_serving_window and v_day = v_today
     and private.local_now()::time not between c.serve_start and c.serve_end then -- [R3]
    return jsonb_build_object('result','OUTSIDE_SERVING_WINDOW','employee',v_emp);
  end if;
  if not exists (select 1 from enrollments where cycle_id = c.id and employee_id = e.id and opted_in) then
    return jsonb_build_object('result','NOT_OPTED_IN','employee',v_emp);
  end if;

  select served_at into v_at from meal_logs where employee_id = e.id and served_on = v_day and voided_at is null;
  if found then return jsonb_build_object('result','ALREADY_SERVED','employee',v_emp,'served_at',v_at); end if;
  if not p_mark then return jsonb_build_object('result','ELIGIBLE','employee',v_emp); end if;

  -- [R19] ON CONFLICT instead of catching unique_violation: no sub-transaction per serve,
  --       and the losing side of a simultaneous double scan gets ALREADY_SERVED
  insert into meal_logs (employee_id, served_on, served_by, method)
  values (e.id, v_day, private.me(), p_method)
  on conflict (employee_id, served_on) where voided_at is null do nothing
  returning served_at into v_at;
  if not found then
    select served_at into v_at from meal_logs where employee_id = e.id and served_on = v_day and voided_at is null;
    return jsonb_build_object('result','ALREADY_SERVED','employee',v_emp,'served_at',v_at);
  end if;
  return jsonb_build_object('result','SERVED','employee',v_emp,'served_at',v_at);
end $$;

-- [R15] v1 put has_role() in the WHERE clause (evaluated per candidate row), searched name with an
--       expression that did not match its index, and did not escape % and _ in the user's text.
create or replace function search_employees_for_counter(p_q text, p_day date default null)
returns table (emp_code text, name text, department text, eligible boolean, served boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_day date := coalesce(p_day, private.today());
  v_q   text := replace(replace(replace(trim(coalesce(p_q,'')), '\', '\\'), '%', '\%'), '_', '\_');
  v_cycle uuid;
begin
  if not (private.has_role('verifier') or private.has_role('admin')) then raise exception 'FORBIDDEN'; end if;
  if length(v_q) < 2 then return; end if;
  select id into v_cycle from lunch_cycles where month = date_trunc('month', v_day)::date;
  return query
  with hits as (
    select e.id, e.emp_code::text, e.name, e.department, e.status from employees e
    where e.name ilike '%' || v_q || '%'                     -- trigram GIN
    union
    select e.id, e.emp_code::text, e.name, e.department, e.status from employees e
    where e.emp_code like upper(v_q) || '%'                  -- "C" collation btree prefix
    order by 3 limit 10
  )
  select h.emp_code, h.name, h.department,
         h.status = 'active' and exists (select 1 from enrollments en
                                         where en.cycle_id = v_cycle and en.employee_id = h.id and en.opted_in),
         exists (select 1 from meal_logs m where m.employee_id = h.id and m.served_on = v_day and m.voided_at is null)
  from hits h order by h.name;
end $$;

create or replace function counter_counts(p_day date default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_day date := coalesce(p_day, private.today()); c lunch_cycles; v_expected int := 0;
begin
  if not (private.has_role('verifier') or private.has_role('admin')) then raise exception 'FORBIDDEN'; end if;
  select * into c from lunch_cycles where month = date_trunc('month', v_day)::date;
  if found and private.is_lunch_day(c, v_day) then
    select count(*) into v_expected from enrollments en join employees e on e.id = en.employee_id
     where en.cycle_id = c.id and en.opted_in and e.status = 'active';
  end if;
  return jsonb_build_object('day', v_day, 'expected', v_expected,
          'served', (select count(*) from meal_logs where served_on = v_day and voided_at is null));
end $$;

-- =====================================================================
-- RPC — Admin
-- =====================================================================
create or replace function set_cycle_status(p_cycle_id uuid, p_status cycle_status)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  update lunch_cycles set status = p_status where id = p_cycle_id;               -- guard + audit triggers do the rest
  if not found then raise exception 'CYCLE_NOT_FOUND'; end if;
end $$;

create or replace function admin_update_cycle(p_cycle_id uuid, p_changes jsonb, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform private.require_reason(p_reason);
  perform private.set_reason(p_reason);
  update lunch_cycles set
    price_paise   = coalesce((p_changes->>'price_paise')::int, price_paise),
    weekdays      = coalesce((select array_agg(x::smallint) from jsonb_array_elements_text(p_changes->'weekdays') x), weekdays),
    billing_basis = coalesce((p_changes->>'billing_basis')::billing_basis, billing_basis),
    serve_start   = coalesce((p_changes->>'serve_start')::time, serve_start),
    serve_end     = coalesce((p_changes->>'serve_end')::time, serve_end),
    enforce_serving_window = coalesce((p_changes->>'enforce_serving_window')::boolean, enforce_serving_window)
  where id = p_cycle_id;
  if not found then raise exception 'CYCLE_NOT_FOUND'; end if;
end $$;

create or replace function admin_set_holiday(p_cycle_id uuid, p_day date, p_is_holiday boolean,
                                             p_label text default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_reason is not null then perform private.require_reason(p_reason); perform private.set_reason(p_reason); end if;
  if p_is_holiday then
    insert into cycle_holidays (cycle_id, day, label) values (p_cycle_id, p_day, p_label)
    on conflict (cycle_id, day) do update set label = excluded.label;
  else
    delete from cycle_holidays where cycle_id = p_cycle_id and day = p_day;
  end if;
end $$;

create or replace function admin_override_enrollment(p_employee_id uuid, p_cycle_id uuid,
                                                     p_opted_in boolean, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_before jsonb;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform private.require_reason(p_reason);
  select to_jsonb(en) into v_before from enrollments en
   where cycle_id = p_cycle_id and employee_id = p_employee_id for update;
  insert into enrollments (cycle_id, employee_id, opted_in, source)
  values (p_cycle_id, p_employee_id, p_opted_in, 'admin_override')
  on conflict (cycle_id, employee_id) do update set opted_in = excluded.opted_in, source = 'admin_override';
  perform private.write_audit('override_enrollment', 'enrollments', p_employee_id::text, v_before,
                              jsonb_build_object('cycle_id', p_cycle_id, 'opted_in', p_opted_in), p_reason);
end $$;

create or replace function admin_void_meal(p_meal_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare m meal_logs;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform private.require_reason(p_reason);
  update meal_logs set voided_at = now(), voided_by = private.me(), void_reason = p_reason
   where id = p_meal_id and voided_at is null returning * into m;
  if not found then raise exception 'MEAL_NOT_FOUND_OR_ALREADY_VOIDED'; end if;
  perform private.write_audit('void_meal', 'meal_logs', p_meal_id::text, to_jsonb(m), null, p_reason);
end $$;

create or replace function admin_record_meal(p_emp_code text, p_day date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform private.require_reason(p_reason);
  r := verify_and_serve(p_emp_code, p_day, true, 'paper');
  perform private.write_audit('record_meal', 'meal_logs', upper(trim(p_emp_code)), null, r, p_reason);
  return r;
end $$;

-- rows: [{"emp_code":"E1001","name":"…","email":"…","department":"…","status":"active"}, …]
-- [R20] v1: a bad status value or an email already used by another code raised an error and
--       aborted the whole file. Every row is now validated first; only valid rows are written,
--       in one set-based upsert, and new employees are linked to an existing sign-in by email.
create or replace function import_employees(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_domain text := (select value #>> '{}' from app_settings where key = 'allowed_domain');
  v_errors jsonb; v_imported int;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'ROWS_MUST_BE_AN_ARRAY'; end if;

  create temp table _imp on commit drop as
  select ord::int as row_no,
         upper(trim(r->>'emp_code'))              as emp_code,
         trim(r->>'name')                         as name,
         lower(trim(r->>'email'))                 as email,
         nullif(trim(r->>'department'), '')       as department,
         coalesce(nullif(lower(trim(r->>'status')), ''), 'active') as status,
         null::text as error
  from jsonb_array_elements(p_rows) with ordinality as t(r, ord);

  update _imp set error = 'Invalid or missing employee code'  where emp_code is null or emp_code !~ '^E[0-9]{4,6}$';
  update _imp i set error = 'Duplicate employee code in file' where error is null
     and exists (select 1 from _imp j where j.emp_code = i.emp_code and j.row_no < i.row_no);
  update _imp set error = 'Name is missing'                   where error is null and coalesce(name, '') = '';
  update _imp set error = 'Email missing or not @' || v_domain where error is null
     and (email is null or email !~ ('^[^@\s]+@' || replace(v_domain, '.', '\.') || '$'));
  update _imp i set error = 'Duplicate email in file'         where error is null
     and exists (select 1 from _imp j where j.email = i.email and j.row_no < i.row_no);
  update _imp set error = 'Status must be active or inactive' where error is null and status not in ('active','inactive');
  update _imp i set error = 'Email already belongs to ' || e.emp_code
    from employees e where i.error is null and e.email = i.email and e.emp_code <> i.emp_code;

  insert into employees (emp_code, name, email, department, status, auth_user_id)
  select i.emp_code, i.name, i.email, i.department, i.status::employee_status,
         (select u.id from auth.users u where lower(u.email) = i.email limit 1)
  from _imp i where i.error is null
  on conflict (emp_code) do update set name = excluded.name, email = excluded.email,
         department = excluded.department, status = excluded.status,
         auth_user_id = coalesce(employees.auth_user_id, excluded.auth_user_id);
  get diagnostics v_imported = row_count;

  select coalesce(jsonb_agg(jsonb_build_object('row', row_no, 'code', emp_code, 'error', error) order by row_no), '[]')
    into v_errors from _imp where error is not null;
  return jsonb_build_object('imported', v_imported, 'errors', v_errors);
end $$;

-- =====================================================================
-- Sign-up: domain check + link to employee                               [R10]
-- (On Supabase you can also do the domain check in a "Before User Created" Auth Hook,
--  which returns a clean error message instead of "Database error saving new user".)
-- =====================================================================
create or replace function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_domain text := (select value #>> '{}' from public.app_settings where key = 'allowed_domain');
begin
  if new.email is null or lower(new.email) !~ ('^[^@\s]+@' || replace(v_domain, '.', '\.') || '$') then
    raise exception 'DOMAIN_NOT_ALLOWED';                                         -- v1: a NULL email slipped through
  end if;
  update public.employees set auth_user_id = new.id
   where email = lower(new.email) and auth_user_id is null;                       -- plain unique index on email
  return new;
end $$;
create trigger link_employee after insert on auth.users
  for each row execute function private.on_auth_user_created();

-- =====================================================================
-- Grants: deny by default, then grant exactly what the app needs          [R1]
-- =====================================================================
revoke all on all tables    in schema public  from public, anon, authenticated;
revoke all on all functions in schema public  from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema private to authenticated;    -- RLS policies call the helpers below as the user
grant execute on function private.me(), private.has_role(app_role), private.is_admin() to authenticated;
-- (private is not in PostgREST's exposed schemas, so these cannot be called over the API)

grant select on employees, user_roles, lunch_cycles, cycle_holidays, enrollments, meal_logs, audit_log, app_settings
  to authenticated;
grant insert, update on employees, lunch_cycles  to authenticated;   -- RLS: admins only; triggers guard + audit
grant insert, delete on user_roles, cycle_holidays to authenticated;
grant update on app_settings to authenticated;
grant select on v_lunch_days, v_monthly_bill to authenticated;

grant execute on function
  set_my_enrollment(uuid, boolean),
  verify_and_serve(text, date, boolean, serve_method),
  search_employees_for_counter(text, date),
  counter_counts(date),
  set_cycle_status(uuid, cycle_status),
  admin_update_cycle(uuid, jsonb, text),
  admin_set_holiday(uuid, date, boolean, text, text),
  admin_override_enrollment(uuid, uuid, boolean, text),
  admin_void_meal(uuid, text),
  admin_record_meal(text, date, text),
  import_employees(jsonb)
to authenticated;

-- =====================================================================
-- Scheduled job (enable pg_cron in the dashboard first, then run once):
--   select cron.schedule('close-optin-windows', '*/15 * * * *',
--     $$ update public.lunch_cycles set status = 'closed'
--        where status = 'open' and optin_closes_at < now() $$);
-- =====================================================================
