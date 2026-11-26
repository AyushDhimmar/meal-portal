-- =====================================================================
-- Meal Portal — advisor fixes (runs after 20261125000000_meal_portal_schema.sql)
-- Fixes the Security Advisor "Function Search Path Mutable" warning and the
-- Performance Advisor "Unindexed foreign keys" suggestions.
-- =====================================================================

-- Security: pin the search path like every other function
alter function private.audit_immutable() set search_path = public, pg_temp;

-- Performance: cover the remaining foreign keys
-- (also serve "what did this Admin change" and "which Verifier served whom")
create index audit_log_actor     on public.audit_log (actor_id, at desc);
create index meal_logs_served_by on public.meal_logs (served_by);
create index meal_logs_voided_by on public.meal_logs (voided_by);
