-- =====================================================================
-- Meal Portal — Sprint 3, piece 3: today's served vs expected list (US-019)
-- Runs after 20261125170000_counter_recent.sql.
-- counter_today(): everyone expected today (opted in, active, lunch day) plus anyone served today
-- who wasn't expected (e.g. an Admin-recorded meal). Name, code, department, served time only.
-- =====================================================================

create or replace function public.counter_today()
returns table (emp_code text, name text, department text, expected boolean, served_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_day date := private.today();
  c lunch_cycles;
  v_lunch boolean := false;
begin
  if not (private.has_role('verifier') or private.has_role('admin')) then raise exception 'FORBIDDEN'; end if;
  select * into c from lunch_cycles where month = date_trunc('month', v_day)::date;
  if found then v_lunch := private.is_lunch_day(c, v_day); end if;

  return query
  with exp as (
    select en.employee_id from enrollments en join employees e on e.id = en.employee_id
    where v_lunch and en.cycle_id = c.id and en.opted_in and e.status = 'active'
  ), srv as (
    select m.employee_id, m.served_at from meal_logs m where m.served_on = v_day and m.voided_at is null
  )
  select e.emp_code::text, e.name, e.department, (x.employee_id is not null), s.served_at
  from employees e
  left join exp x on x.employee_id = e.id
  left join srv s on s.employee_id = e.id
  where x.employee_id is not null or s.employee_id is not null
  order by e.name;
end $$;

revoke all on function public.counter_today() from public, anon;
grant execute on function public.counter_today() to authenticated;

-- ---------- Counts that match the list ----------------------------------
-- v1 counted every meal served today against "expected", so an Admin-recorded meal for someone
-- not on today's list could show "2 / 2 served" while a person was still waiting.
-- Now: served_expected = expected people already served (drives progress); unplanned = extra meals;
-- served = all meals (kept for compatibility).
create or replace function public.counter_counts(p_day date default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_day date := coalesce(p_day, private.today());
  c lunch_cycles;
  v_lunch boolean := false;
  v_expected int := 0; v_served_expected int := 0; v_served int;
begin
  if not (private.has_role('verifier') or private.has_role('admin')) then raise exception 'FORBIDDEN'; end if;
  select * into c from lunch_cycles where month = date_trunc('month', v_day)::date;
  if found then v_lunch := private.is_lunch_day(c, v_day); end if;

  if v_lunch then
    select count(*), count(m.id)
      into v_expected, v_served_expected
      from enrollments en
      join employees e on e.id = en.employee_id and e.status = 'active'
      left join meal_logs m on m.employee_id = en.employee_id and m.served_on = v_day and m.voided_at is null
     where en.cycle_id = c.id and en.opted_in;
  end if;
  select count(*) into v_served from meal_logs where served_on = v_day and voided_at is null;

  return jsonb_build_object('day', v_day, 'is_lunch_day', v_lunch, 'expected', v_expected,
                            'served_expected', v_served_expected, 'unplanned', v_served - v_served_expected,
                            'served', v_served);
end $$;
