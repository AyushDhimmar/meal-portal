-- =====================================================================
-- Meal Portal — Sprint 1, piece 1: manage employees (US-012, US-027)
-- Runs after 20261125110000_employee_code_format.sql.
--   * admin_save_employee(): create or edit an employee AND set their roles in one transaction
--   * guard: there must always be at least one active Admin
-- =====================================================================

-- ---------- Never lose the last Admin --------------------------------
create or replace function private.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.user_roles r
                 join public.employees e on e.id = r.employee_id
                 where r.role = 'admin' and e.status = 'active') then
    raise exception 'LAST_ADMIN' using hint = 'At least one active Admin must remain';
  end if;
  return null;
end $$;

-- checked at the end of the statement, after all its rows have changed
create trigger guard_last_admin after delete on public.user_roles
  for each statement execute function private.guard_last_admin();
create trigger guard_last_admin after update of status on public.employees
  for each statement execute function private.guard_last_admin();

-- ---------- Create / edit an employee with roles ----------------------
-- p_id null = create (code required); otherwise edit (code cannot change: it is printed on
-- paper lists and badges). Roles: the full set of extra roles, e.g. '{verifier}' or '{}'.
create or replace function admin_save_employee(
  p_id         uuid,
  p_emp_code   text,
  p_name       text,
  p_email      text,
  p_department text,
  p_status     employee_status,
  p_roles      app_role[]
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_domain text := (select value #>> '{}' from app_settings where key = 'allowed_domain');
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_name   text := trim(coalesce(p_name, ''));
  v_dept   text := nullif(trim(coalesce(p_department, '')), '');
  v_roles  app_role[] := coalesce(p_roles, '{}');
  v_id     uuid := p_id;
  v_code   text;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED'; end if;
  if v_email !~ ('^[^@\s]+@' || replace(v_domain, '.', '\.') || '$') then raise exception 'EMAIL_DOMAIN'; end if;
  if exists (select 1 from employees where email = v_email and id is distinct from v_id) then
    raise exception 'EMAIL_TAKEN';
  end if;

  if v_id is null then
    v_code := private.normalize_emp_code(p_emp_code);
    if v_code !~ '^1R-[0-9]{4}$' then raise exception 'EMP_CODE_FORMAT'; end if;
    if exists (select 1 from employees where emp_code = v_code) then raise exception 'EMP_CODE_TAKEN'; end if;
    insert into employees (emp_code, name, email, department, status)
    values (v_code, v_name, v_email, v_dept, p_status)
    returning id into v_id;
  else
    update employees set name = v_name, email = v_email, department = v_dept, status = p_status
     where id = v_id
    returning emp_code into v_code;
    if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  end if;

  -- roles: remove the ones not wanted, add the missing ones (audit trigger logs each change)
  delete from user_roles where employee_id = v_id and role <> all (v_roles);
  insert into user_roles (employee_id, role)
  select v_id, r from unnest(v_roles) r
  on conflict (employee_id, role) do nothing;

  return jsonb_build_object('id', v_id, 'emp_code', v_code);
end $$;

revoke all on function admin_save_employee(uuid, text, text, text, text, employee_status, app_role[]) from public, anon;
grant execute on function admin_save_employee(uuid, text, text, text, text, employee_status, app_role[]) to authenticated;
