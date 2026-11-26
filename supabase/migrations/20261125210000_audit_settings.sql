-- =====================================================================
-- Meal Portal — Sprint 4, piece 3: audit log and settings (US-025, F-006)
-- Runs after 20261125200000_report_not_collected.sql.
--
--   admin_audit_log(...)      newest-first audit entries with readable names, filters, "load more"
--   admin_save_setting(k, v)  validated save of cycle_defaults / monthly_email / jobs
--   admin_record_meal         now keeps the day in the audit entry and only audits a real serve
-- =====================================================================

-- ---------- Audit log --------------------------------------------------
-- p_category: null | 'people' (employees + roles) | 'cycles' (cycles + holidays)
--             | 'enrollments' | 'meals' | 'settings'
-- p_before_id: keyset paging — pass the smallest id you already have to get the next page
create or replace function admin_audit_log(
  p_category  text   default null,
  p_from      date   default null,
  p_to        date   default null,
  p_q         text   default null,
  p_before_id bigint default null,
  p_limit     int    default 50)
returns table (
  id bigint, at timestamptz, action text, entity text, entity_id text,
  actor_name text, actor_code text,
  subject_name text, subject_code text, cycle_month date,
  before jsonb, after jsonb, reason text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_tz  text := private.tz();
  v_q   text := nullif(trim(p_q), '');
  v_ent text[] := case p_category
                    when 'people'      then array['employees','user_roles']
                    when 'cycles'      then array['lunch_cycles','cycle_holidays']
                    when 'enrollments' then array['enrollments']
                    when 'meals'       then array['meal_logs']
                    when 'settings'    then array['app_settings']
                    else null end;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_category is not null and v_ent is null then raise exception 'CATEGORY_UNKNOWN'; end if;

  return query
  with page as (
    -- PK index, newest first; stops after p_limit unless a text search has to look further
    select a.* from audit_log a
     where (p_before_id is null or a.id < p_before_id)
       and (v_ent is null or a.entity = any (v_ent))
       and (p_from is null or a.at >= (p_from::timestamp at time zone v_tz))
       and (p_to   is null or a.at <  ((p_to + 1)::timestamp at time zone v_tz))
     order by a.id desc
     limit case when v_q is null then least(greatest(p_limit, 1), 200) end
  ), resolved as (
    select p.*,
           case
             when p.entity = 'employees' then p.entity_id::uuid
             when p.entity in ('user_roles', 'enrollments')
               then coalesce(p.after->>'employee_id', p.before->>'employee_id', p.entity_id)::uuid
             when p.entity = 'meal_logs' and p.action = 'void_meal' then (p.before->>'employee_id')::uuid
           end as emp_id,
           case when p.entity = 'meal_logs' and p.action = 'record_meal' then p.entity_id end as emp_code_ref,
           coalesce(p.after->>'cycle_id', p.before->>'cycle_id')::uuid as cyc_id
      from page p
  )
  select r.id, r.at, r.action, r.entity, r.entity_id,
         coalesce(act.name, 'System'), act.emp_code,
         coalesce(s1.name, s2.name, r.after->>'name', r.before->>'name'),
         coalesce(s1.emp_code, s2.emp_code, r.after->>'emp_code', r.before->>'emp_code'),
         coalesce(lc.month, (coalesce(r.after->>'month', r.before->>'month'))::date),
         r.before, r.after, r.reason
    from resolved r
    left join employees act on act.id = r.actor_id
    left join employees s1  on s1.id = r.emp_id
    left join employees s2  on s2.emp_code = r.emp_code_ref
    left join lunch_cycles lc on lc.id = r.cyc_id
   where v_q is null
      or coalesce(s1.name, s2.name, r.after->>'name', r.before->>'name', '') ilike '%' || v_q || '%'
      or coalesce(s1.emp_code, s2.emp_code, r.after->>'emp_code', r.before->>'emp_code', '') ilike '%' || v_q || '%'
      or coalesce(act.name, '') ilike '%' || v_q || '%'
      or coalesce(r.reason, '') ilike '%' || v_q || '%'
   order by r.id desc
   limit least(greatest(p_limit, 1), 200);
end $$;

revoke all on function admin_audit_log(text, date, date, text, bigint, int) from public, anon;
grant execute on function admin_audit_log(text, date, date, text, bigint, int) to authenticated;

-- ---------- Settings ---------------------------------------------------
create or replace function private.setting_invalid(p_msg text) returns void
language plpgsql set search_path = public, pg_temp as $$
begin raise exception 'SETTING_INVALID' using errcode = 'P0001', hint = p_msg; end $$;

create or replace function admin_save_setting(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v jsonb; v_old jsonb; t1 time; t2 time;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  select value into v_old from app_settings where key = p_key for update;
  if not found or p_key not in ('cycle_defaults', 'monthly_email', 'jobs') then
    raise exception 'SETTING_UNKNOWN' using hint = coalesce(p_key, 'null');
  end if;
  if jsonb_typeof(p_value) <> 'object' then perform private.setting_invalid('Value must be an object'); end if;
  v := v_old || p_value;                                   -- partial updates keep the other fields

  begin
    if p_key = 'cycle_defaults' then
      if jsonb_typeof(v->'weekdays') <> 'array' or jsonb_array_length(v->'weekdays') = 0
         or exists (select 1 from jsonb_array_elements(v->'weekdays') x
                     where jsonb_typeof(x) <> 'number' or x::int not between 0 and 6) then
        perform private.setting_invalid('Pick at least one lunch day');
      end if;
      v := jsonb_set(v, '{weekdays}', (select jsonb_agg(d order by d) from (select distinct x::int d from jsonb_array_elements(v->'weekdays') x) s));
      if (v->>'price_paise')::int not between 100 and 100000 then perform private.setting_invalid('Price must be between ₹1 and ₹1,000'); end if;
      if (v->>'optin_open_day')::int not between 1 and 28 or (v->>'optin_close_day')::int not between 1 and 28 then
        perform private.setting_invalid('Opt-in days must be between 1 and 28');
      end if;
      if (v->>'optin_close_day')::int <= (v->>'optin_open_day')::int then
        perform private.setting_invalid('Opt-in must close after it opens');
      end if;
      t1 := (v->>'serve_start')::time; t2 := (v->>'serve_end')::time;
      if t2 <= t1 then perform private.setting_invalid('Serving must end after it starts'); end if;
      if jsonb_typeof(v->'enforce_serving_window') <> 'boolean' then perform private.setting_invalid('enforce_serving_window must be true or false'); end if;
      if v->>'billing_basis' not in ('opted', 'consumed') then perform private.setting_invalid('Billing must be opted or consumed'); end if;
      v := jsonb_set(jsonb_set(v, '{serve_start}', to_jsonb(to_char(t1, 'HH24:MI'))), '{serve_end}', to_jsonb(to_char(t2, 'HH24:MI')));
    elsif p_key = 'monthly_email' then
      if jsonb_typeof(v->'enabled') <> 'boolean' then perform private.setting_invalid('enabled must be true or false'); end if;
      if (v->>'day')::int not between 1 and 28 then perform private.setting_invalid('Day must be between 1 and 28'); end if;
      v := jsonb_set(v, '{time}', to_jsonb(to_char((v->>'time')::time, 'HH24:MI')));
    elsif p_key = 'jobs' then
      v := jsonb_set(v, '{fallback_list_time}', to_jsonb(to_char((v->>'fallback_list_time')::time, 'HH24:MI')));
      v := jsonb_set(v, '{nightly_backup_time}', to_jsonb(to_char((v->>'nightly_backup_time')::time, 'HH24:MI')));
      if (v->>'backup_retention_days')::int not between 7 and 365 then
        perform private.setting_invalid('Keep backups between 7 and 365 days');
      end if;
    end if;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow
      or numeric_value_out_of_range or null_value_not_allowed then
      perform private.setting_invalid('A value has the wrong format');
  end;
  -- a null from a missing/invalid field slips past "not between"; catch it here
  if p_key = 'cycle_defaults' and (v->>'price_paise' is null or v->>'optin_open_day' is null or v->>'optin_close_day' is null) then
    perform private.setting_invalid('A value is missing');
  end if;

  if v is distinct from v_old then
    update app_settings set value = v where key = p_key;    -- audit trigger records before/after
  end if;
  return v;
end $$;

revoke all on function admin_save_setting(text, jsonb) from public, anon;
grant execute on function admin_save_setting(text, jsonb) to authenticated;

-- settings change only through the validated function now
revoke update on app_settings from authenticated;
drop policy if exists upd on app_settings;

-- ---------- Paper-meal audit entry: keep the day, skip failed attempts --------------
create or replace function admin_record_meal(p_emp_code text, p_day date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform private.require_reason(p_reason);
  r := verify_and_serve(p_emp_code, p_day, true, 'paper');
  if r->>'result' = 'SERVED' then
    perform private.write_audit('record_meal', 'meal_logs', private.normalize_emp_code(p_emp_code), null,
                                r || jsonb_build_object('day', p_day), p_reason);
  end if;
  return r;
end $$;

-- ---------- New months pick up billing basis and serving-window rule from the defaults ----------
-- (admin_save_cycle sets weekdays, price, dates and times itself; these two had fixed column defaults)
create or replace function private.default_billing_basis() returns public.billing_basis
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (value->>'billing_basis')::public.billing_basis from public.app_settings where key = 'cycle_defaults'), 'opted')
$$;
create or replace function private.default_enforce_window() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select (value->>'enforce_serving_window')::boolean from public.app_settings where key = 'cycle_defaults'), false)
$$;
alter table lunch_cycles alter column billing_basis set default private.default_billing_basis();
alter table lunch_cycles alter column enforce_serving_window set default private.default_enforce_window();
