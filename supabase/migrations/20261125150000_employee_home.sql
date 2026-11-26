-- =====================================================================
-- Meal Portal — Sprint 2, piece 1: employee home and opt-in (US-001, US-002, US-024)
-- Runs after 20261125140000_cycles.sql.
--   * Draft cycles (and their holidays) are visible to Admins only
--   * my_home(): everything the employee Home screen needs, in one call
-- =====================================================================

-- ---------- Drafts are the Admin's work in progress -------------------
drop policy sel on public.lunch_cycles;
create policy sel on public.lunch_cycles for select to authenticated
  using ((select private.is_admin()) or (status <> 'draft' and (select private.me()) is not null));

drop policy sel on public.cycle_holidays;
create policy sel on public.cycle_holidays for select to authenticated
  using ((select private.is_admin())
         or ((select private.me()) is not null
             and exists (select 1 from public.lunch_cycles c where c.id = cycle_id and c.status <> 'draft')));

-- ---------- Home screen data ------------------------------------------
-- Shape:
-- { tz, today: { date, is_lunch_day, opted_in, served_at },
--   current: { cycle_id, month, status, opted_in, opted_days, consumed_days, payable_paise } | null,
--   next:    { cycle_id, month, status, price_paise, weekdays, lunch_days, holidays[], optin_opens_at,
--              optin_closes_at, serve_start, serve_end, opted_in (true/false/null), source, can_change } | null }
create or replace function public.my_home()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_me    uuid := private.me();
  v_tz    text := private.tz();
  v_today date := private.today();
  cur     lunch_cycles;
  nxt     lunch_cycles;
  v_today_json jsonb;
  v_cur_json   jsonb;
  v_next_json  jsonb;
  v_opted boolean; v_source text; v_served timestamptz;
begin
  if v_me is null then raise exception 'NOT_AN_EMPLOYEE'; end if;

  -- this month (hidden if still a draft)
  select * into cur from lunch_cycles where month = date_trunc('month', v_today)::date and status <> 'draft';
  if found then
    select opted_in into v_opted from enrollments where cycle_id = cur.id and employee_id = v_me;
    select served_at into v_served from meal_logs where employee_id = v_me and served_on = v_today and voided_at is null;
    v_today_json := jsonb_build_object('date', v_today, 'is_lunch_day', private.is_lunch_day(cur, v_today),
                      'opted_in', coalesce(v_opted, false), 'served_at', v_served,
                      'serve_start', cur.serve_start, 'serve_end', cur.serve_end);
    select jsonb_build_object('cycle_id', cycle_id, 'month', month, 'status', cur.status, 'opted_in', coalesce(v_opted, false),
                              'opted_days', opted_days, 'consumed_days', consumed_days, 'payable_paise', payable_paise)
      into v_cur_json from v_monthly_bill where cycle_id = cur.id and employee_id = v_me;
  else
    v_today_json := jsonb_build_object('date', v_today, 'is_lunch_day', false, 'opted_in', false, 'served_at', null);
  end if;

  -- next: the cycle the employee can act on. A cycle open for opt-in right now wins;
  -- otherwise the first non-draft cycle after this month (e.g. closed, so they see their choice)
  select * into nxt from lunch_cycles
   where month > date_trunc('month', v_today)::date and status <> 'draft'
   order by (status = 'open' and now() between optin_opens_at and optin_closes_at) desc, month
   limit 1;
  if found then
    v_opted := null; v_source := null;
    select opted_in, source::text into v_opted, v_source from enrollments where cycle_id = nxt.id and employee_id = v_me;
    v_next_json := jsonb_build_object(
      'cycle_id', nxt.id, 'month', nxt.month, 'status', nxt.status, 'price_paise', nxt.price_paise, 'weekdays', nxt.weekdays,
      'lunch_days', (select count(*) from v_lunch_days where cycle_id = nxt.id),
      'holidays', coalesce((select jsonb_agg(day order by day) from cycle_holidays where cycle_id = nxt.id), '[]'),
      'optin_opens_at', nxt.optin_opens_at, 'optin_closes_at', nxt.optin_closes_at,
      'serve_start', nxt.serve_start, 'serve_end', nxt.serve_end,
      'opted_in', v_opted, 'source', v_source,
      'can_change', nxt.status = 'open' and now() between nxt.optin_opens_at and nxt.optin_closes_at);
  end if;

  return jsonb_build_object('tz', v_tz, 'today', v_today_json, 'current', v_cur_json, 'next', v_next_json);
end $$;

revoke all on function public.my_home() from public, anon;
grant execute on function public.my_home() to authenticated;
