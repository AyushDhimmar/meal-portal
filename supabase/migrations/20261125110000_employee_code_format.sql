-- =====================================================================
-- Meal Portal — employee code format: 1R- followed by 4 digits (e.g. 1R-0123)
-- Runs after 20261125100000_advisor_fixes.sql.
-- Replaces the prototype's E1234 format everywhere it is checked, and lets people type the
-- code loosely: '0123', '123', '1r-0123', '1R0123' and ' 1R-0123 ' all mean 1R-0123.
-- =====================================================================

create or replace function private.normalize_emp_code(p text) returns text
language sql immutable set search_path = pg_catalog, pg_temp as $$
  select case
           when v ~ '^1R-[0-9]{4}$'   then v
           when v ~ '^1R-?[0-9]{1,4}$' then '1R-' || lpad(regexp_replace(v, '^1R-?', ''), 4, '0')
           when v ~ '^[0-9]{1,4}$'     then '1R-' || lpad(v, 4, '0')
           else v                                         -- anything else is left as typed and fails the check
         end
  from (select upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) as v) s
$$;

-- the rule itself
alter table public.employees drop constraint employees_emp_code_check;
alter table public.employees add  constraint employees_emp_code_check check (emp_code ~ '^1R-[0-9]{4}$');

-- functions that read or validate codes (same as before apart from the code handling)
create or replace function verify_and_serve(p_emp_code text, p_day date default null,
                                            p_mark boolean default true, p_method serve_method default 'code')
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_today date := private.today();                                                -- [R3] IST, not server UTC
  v_day   date := coalesce(p_day, v_today);
  v_code  text := private.normalize_emp_code(p_emp_code);   -- '0123', '1r-0123', '1R0123' -> '1R-0123'
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
    where e.emp_code like upper(v_q) || '%'                  -- "1R-01" ("C" collation btree prefix)
       or e.emp_code like '1R-' || v_q || '%'                -- "01": Verifier types only the digits
    order by 3 limit 10
  )
  select h.emp_code, h.name, h.department,
         h.status = 'active' and exists (select 1 from enrollments en
                                         where en.cycle_id = v_cycle and en.employee_id = h.id and en.opted_in),
         exists (select 1 from meal_logs m where m.employee_id = h.id and m.served_on = v_day and m.voided_at is null)
  from hits h order by h.name;
end $$;

create or replace function admin_record_meal(p_emp_code text, p_day date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform private.require_reason(p_reason);
  r := verify_and_serve(p_emp_code, p_day, true, 'paper');
  perform private.write_audit('record_meal', 'meal_logs', private.normalize_emp_code(p_emp_code), null, r, p_reason);
  return r;
end $$;

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
         private.normalize_emp_code(r->>'emp_code') as emp_code,
         trim(r->>'name')                         as name,
         lower(trim(r->>'email'))                 as email,
         nullif(trim(r->>'department'), '')       as department,
         coalesce(nullif(lower(trim(r->>'status')), ''), 'active') as status,
         null::text as error
  from jsonb_array_elements(p_rows) with ordinality as t(r, ord);

  update _imp set error = 'Employee code must look like 1R-0123'  where emp_code = '' or emp_code !~ '^1R-[0-9]{4}$';
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
