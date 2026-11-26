-- =====================================================================
-- Meal Portal — Sprint 1, piece 3: create and configure lunch cycles (US-013)
-- Runs after 20261125130000_import_preview.sql.
--   * admin_save_cycle(): create or edit a draft/open cycle. Opt-in dates are converted to
--     exact moments in the canteen's time zone here, not in the browser.
--   * v_cycle_overview: one row per cycle with lunch days, holidays and opted-in count
-- =====================================================================

-- The view below shows opt-in dates in local time; the helper only reads a setting.
grant execute on function private.tz() to authenticated;

create or replace function public.admin_save_cycle(
  p_id          uuid,          -- null = create
  p_month       date,          -- any day in the month; stored as the 1st
  p_weekdays    smallint[],    -- 0 = Sunday … 6 = Saturday
  p_price_paise integer,
  p_optin_open  date,          -- opt-in opens 00:00 local time on this day
  p_optin_close date,          -- opt-in closes 23:59:59 local time on this day
  p_serve_start time default '12:30',
  p_serve_end   time default '14:30',
  p_open        boolean default false   -- create straight into "open"
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tz     text := private.tz();
  v_month  date := date_trunc('month', p_month)::date;
  v_opens  timestamptz := p_optin_open::timestamp at time zone v_tz;
  v_closes timestamptz := (p_optin_close::timestamp + interval '1 day' - interval '1 second') at time zone v_tz;
  v_id     uuid := p_id;
  v_status cycle_status;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_month is null or p_optin_open is null or p_optin_close is null then raise exception 'DATES_REQUIRED'; end if;
  if coalesce(cardinality(p_weekdays), 0) = 0 then raise exception 'WEEKDAYS_REQUIRED'; end if;
  if coalesce(p_price_paise, 0) <= 0 then raise exception 'PRICE_INVALID'; end if;
  if p_optin_close < p_optin_open then raise exception 'OPTIN_CLOSE_BEFORE_OPEN'; end if;
  if p_serve_end <= p_serve_start then raise exception 'SERVE_WINDOW_INVALID'; end if;
  -- (the table trigger also refuses an opt-in window that closes after the month starts)

  if v_id is null then
    if exists (select 1 from lunch_cycles where month = v_month) then raise exception 'CYCLE_EXISTS'; end if;
    insert into lunch_cycles (month, status, price_paise, weekdays, optin_opens_at, optin_closes_at, serve_start, serve_end)
    values (v_month, case when p_open then 'open' else 'draft' end::cycle_status, p_price_paise,
            (select array_agg(distinct d order by d) from unnest(p_weekdays) d), v_opens, v_closes, p_serve_start, p_serve_end)
    returning id into v_id;
  else
    select status into v_status from lunch_cycles where id = v_id for update;
    if not found then raise exception 'CYCLE_NOT_FOUND'; end if;
    if v_status in ('closed', 'locked') then raise exception 'CYCLE_CLOSED'; end if;
    if exists (select 1 from lunch_cycles where month = v_month and id <> v_id) then raise exception 'CYCLE_EXISTS'; end if;
    update lunch_cycles set month = v_month, price_paise = p_price_paise,
           weekdays = (select array_agg(distinct d order by d) from unnest(p_weekdays) d),
           optin_opens_at = v_opens, optin_closes_at = v_closes, serve_start = p_serve_start, serve_end = p_serve_end
     where id = v_id;
    -- holidays from another month no longer belong to this cycle
    delete from cycle_holidays where cycle_id = v_id and date_trunc('month', day)::date <> v_month;
  end if;

  return jsonb_build_object('id', v_id,
    'lunch_days', (select count(*) from v_lunch_days where cycle_id = v_id));
end $$;

revoke all on function public.admin_save_cycle(uuid, date, smallint[], integer, date, date, time, time, boolean) from public, anon;
grant execute on function public.admin_save_cycle(uuid, date, smallint[], integer, date, date, time, time, boolean) to authenticated;

-- One row per cycle for the Cycles screen. security_invoker: Admins see true counts;
-- an Employee querying it would only count their own enrollment (they don't use this view).
create or replace view public.v_cycle_overview with (security_invoker = true) as
select c.id, c.month, c.status, c.price_paise, c.weekdays, c.billing_basis,
       c.serve_start, c.serve_end, c.optin_opens_at, c.optin_closes_at,
       (c.optin_opens_at  at time zone private.tz())::date as optin_open_date,
       (c.optin_closes_at at time zone private.tz())::date as optin_close_date,
       (select count(*) from v_lunch_days d   where d.cycle_id = c.id)::int               as lunch_days,
       (select count(*) from cycle_holidays h where h.cycle_id = c.id)::int               as holidays,
       (select count(*) from enrollments e    where e.cycle_id = c.id and e.opted_in)::int as opted_in
from lunch_cycles c;

grant select on public.v_cycle_overview to authenticated;
