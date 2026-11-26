-- =====================================================================
-- Meal Portal — fix found in manual testing: "Not collected" counted future days
-- Runs after 20261125190000_admin_dashboard.sql.
-- v_monthly_bill gains opted_days_to_date: the opted lunch days up to and including today
-- (all of them for a past month, none for a future one). The report shows
-- "not collected so far" = opted_days_to_date − consumed_days.
-- Columns can only be added at the end of a view, so the existing ones keep their order.
-- =====================================================================

-- the view runs as the caller (security_invoker), so callers need these two date helpers
grant execute on function private.local_now(), private.today() to authenticated;

create or replace view public.v_monthly_bill with (security_invoker = true) as
with days as (
  select cycle_id, count(*)::int as lunch_days,
         count(*) filter (where day <= private.today())::int as lunch_days_to_date
  from v_lunch_days group by cycle_id
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
             else coalesce(ml.consumed_days, 0) end) * c.price_paise as payable_paise,
       case when coalesce(en.opted_in, false) then coalesce(d.lunch_days_to_date, 0) else 0 end as opted_days_to_date
from lunch_cycles c
join employees e on true
left join enrollments en on en.cycle_id = c.id and en.employee_id = e.id
left join days  d  on d.cycle_id = c.id
left join meals ml on ml.cycle_id = c.id and ml.employee_id = e.id
where e.status = 'active' or en.employee_id is not null or ml.employee_id is not null;
