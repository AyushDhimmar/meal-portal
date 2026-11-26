-- =====================================================================
-- Meal Portal — Sprint 3, piece 1: counter (US-015 … US-021, US-006)
-- Runs after 20261125160000_employee_history.sql.
-- counter_recent(): the last meals served today, for the counter screen. Verifiers cannot read
-- meal_logs directly, so this returns only name, code, department and time — nothing else.
-- =====================================================================

create or replace function public.counter_recent(p_limit integer default 5)
returns table (emp_code text, name text, department text, served_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (private.has_role('verifier') or private.has_role('admin')) then raise exception 'FORBIDDEN'; end if;
  return query
  select e.emp_code::text, e.name, e.department, m.served_at
  from meal_logs m join employees e on e.id = m.employee_id
  where m.served_on = private.today() and m.voided_at is null          -- meal_logs_day_emp index
  order by m.served_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 50);
end $$;

revoke all on function public.counter_recent(integer) from public, anon;
grant execute on function public.counter_recent(integer) to authenticated;
