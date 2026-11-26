-- =====================================================================
-- Meal Portal — Sprint 1, piece 2: employee import with preview (US-008, US-012)
-- Runs after 20261125120000_admin_save_employee.sql.
--
-- import_employees(rows, dry_run):
--   dry_run = true  → validates and classifies every row, writes nothing (the preview screen)
--   dry_run = false → same checks, then writes the new and changed rows in one transaction
-- Rows that already match the master list exactly are skipped, so re-importing the same
-- file changes nothing and leaves no audit noise.
-- =====================================================================

drop function if exists public.import_employees(jsonb);

create or replace function public.import_employees(p_rows jsonb, p_dry_run boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_domain text := (select value #>> '{}' from app_settings where key = 'allowed_domain');
  v_total int; v_new int; v_changed int; v_unchanged int; v_errors jsonb;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'ROWS_MUST_BE_AN_ARRAY'; end if;
  v_total := jsonb_array_length(p_rows);
  if v_total = 0 then raise exception 'FILE_EMPTY'; end if;
  if v_total > 5000 then raise exception 'FILE_TOO_LARGE' using hint = 'Import at most 5,000 rows at a time'; end if;

  create temp table _imp on commit drop as
  select ord::int                                                   as row_no,
         private.normalize_emp_code(r->>'emp_code')                 as emp_code,
         trim(coalesce(r->>'name', ''))                             as name,
         lower(trim(coalesce(r->>'email', '')))                     as email,
         nullif(trim(coalesce(r->>'department', '')), '')           as department,
         coalesce(nullif(lower(trim(r->>'status')), ''), 'active')  as status,
         null::text as error,
         null::text as kind          -- 'new' | 'changed' | 'unchanged'
  from jsonb_array_elements(p_rows) with ordinality as t(r, ord);

  -- validation, first problem per row wins
  update _imp set error = 'Employee code must look like 1R-0123'   where emp_code !~ '^1R-[0-9]{4}$';
  update _imp i set error = 'Same employee code as row ' || (select min(j.row_no) from _imp j where j.emp_code = i.emp_code)
   where error is null and exists (select 1 from _imp j where j.emp_code = i.emp_code and j.row_no < i.row_no);
  update _imp set error = 'Name is missing'                        where error is null and name = '';
  update _imp set error = 'Email missing or not @' || v_domain     where error is null
     and email !~ ('^[^@\s]+@' || replace(v_domain, '.', '\.') || '$');
  update _imp i set error = 'Same email as row ' || (select min(j.row_no) from _imp j where j.email = i.email)
   where error is null and exists (select 1 from _imp j where j.email = i.email and j.row_no < i.row_no);
  update _imp set error = 'Status must be active or inactive'      where error is null and status not in ('active','inactive');
  update _imp i set error = 'Email already belongs to ' || e.emp_code
    from employees e where i.error is null and e.email = i.email and e.emp_code <> i.emp_code;

  -- classify the valid rows
  update _imp i set kind = 'new'
   where i.error is null and not exists (select 1 from employees e where e.emp_code = i.emp_code);
  update _imp i set kind = case
      when (e.name, e.email, e.department, e.status::text) is not distinct from (i.name, i.email, i.department, i.status)
      then 'unchanged' else 'changed' end
    from employees e
   where i.error is null and e.emp_code = i.emp_code;

  select count(*) filter (where kind = 'new'), count(*) filter (where kind = 'changed'),
         count(*) filter (where kind = 'unchanged')
    into v_new, v_changed, v_unchanged from _imp;
  select coalesce(jsonb_agg(jsonb_build_object('row', row_no, 'code', emp_code, 'name', name, 'error', error)
                            order by row_no), '[]')
    into v_errors from _imp where error is not null;

  if not p_dry_run then
    -- the last-admin guard still applies: deactivating every Admin through a file is refused
    insert into employees (emp_code, name, email, department, status)
    select emp_code, name, email, department, status::employee_status from _imp where kind = 'new';
    update employees e set name = i.name, email = i.email, department = i.department, status = i.status::employee_status
      from _imp i where i.kind = 'changed' and e.emp_code = i.emp_code;
  end if;

  return jsonb_build_object('dry_run', p_dry_run, 'total', v_total,
                            'new', v_new, 'changed', v_changed, 'unchanged', v_unchanged,
                            'error_count', jsonb_array_length(v_errors), 'errors', v_errors);
end $$;

revoke all on function public.import_employees(jsonb, boolean) from public, anon;
grant execute on function public.import_employees(jsonb, boolean) to authenticated;
