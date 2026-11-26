-- =====================================================================
-- Meal Portal — Sprint 2, piece 2: meal history and monthly bill (US-003, US-010)
-- Runs after 20261125150000_employee_home.sql.
--
-- my_history(cycle_id default null) → the signed-in employee's own month:
-- { tz, months: [{cycle_id, month}], cycle: {...bill}, days: [{day, kind, served_at}] }
-- kind: served | missed | today | upcoming | holiday | not_opted
-- With no cycle_id it returns the latest month that has started.
-- =====================================================================

create or replace function public.my_history(p_cycle_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me    uuid := private.me();
  v_today date := private.today();
  c       lunch_cycles;
  v_opted boolean;
  v_bill  record;
begin
  if v_me is null then raise exception 'NOT_AN_EMPLOYEE'; end if;

  if p_cycle_id is null then
    select * into c from lunch_cycles
     where status <> 'draft' and month <= v_today
     order by month desc limit 1;
  else
    select * into c from lunch_cycles where id = p_cycle_id and status <> 'draft';
  end if;

  if not found then
    return jsonb_build_object('tz', private.tz(), 'months', '[]'::jsonb, 'cycle', null, 'days', '[]'::jsonb);
  end if;

  select coalesce(opted_in, false) into v_opted from enrollments where cycle_id = c.id and employee_id = v_me;
  v_opted := coalesce(v_opted, false);
  select * into v_bill from v_monthly_bill where cycle_id = c.id and employee_id = v_me;

  return jsonb_build_object(
    'tz', private.tz(),
    -- months to pick from: the last 12 that have started, newest first
    'months', (select coalesce(jsonb_agg(jsonb_build_object('cycle_id', id, 'month', month) order by month desc), '[]')
                 from (select id, month from lunch_cycles
                        where status <> 'draft' and month <= v_today
                        order by month desc limit 12) m),
    'cycle', jsonb_build_object(
      'cycle_id', c.id, 'month', c.month, 'status', c.status, 'price_paise', c.price_paise,
      'billing_basis', c.billing_basis, 'opted_in', v_opted,
      'opted_days', coalesce(v_bill.opted_days, 0), 'consumed_days', coalesce(v_bill.consumed_days, 0),
      'payable_paise', coalesce(v_bill.payable_paise, 0)),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'kind', d.kind, 'served_at', d.served_at) order by d.day desc), '[]')
      from (
        select g::date as day,
               m.served_at,
               case
                 when h.day is not null                 then 'holiday'
                 when m.served_at is not null           then 'served'     -- served counts even if opted out (Admin record)
                 when not v_opted                        then 'not_opted'
                 when g::date = v_today                 then 'today'
                 when g::date > v_today                 then 'upcoming'
                 else 'missed'
               end as kind
        from generate_series(c.month::timestamp, c.month + interval '1 month - 1 day', interval '1 day') g
        left join cycle_holidays h on h.cycle_id = c.id and h.day = g::date
        left join meal_logs m on m.employee_id = v_me and m.served_on = g::date and m.voided_at is null
        where extract(dow from g)::smallint = any (c.weekdays) or m.served_at is not null
      ) d
    ));
end $$;

revoke all on function public.my_history(uuid) from public, anon;
grant execute on function public.my_history(uuid) to authenticated;
