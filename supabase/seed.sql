-- =====================================================================
-- Local development data only.
-- Runs automatically after the migrations on `npx supabase db reset`.
-- It is NOT sent to the online project by `supabase db push`.
-- =====================================================================

-- Test Admin (a made-up address: nothing is ever emailed locally)
insert into public.employees (emp_code, name, email, department)
values ('1R-9000', 'Test Admin', 'test.admin@1rivet.com', 'Administration');
insert into public.user_roles (employee_id, role)
select id, 'admin' from public.employees where emp_code = '1R-9000';

-- Test people for trying the Verifier and Employee screens (clearly fake addresses)
insert into public.employees (emp_code, name, email, department) values
  ('1R-9001', 'Test Verifier', 'test.verifier@1rivet.com', 'Operations'),
  ('1R-9002', 'Test Employee', 'test.employee@1rivet.com', 'Engineering');
insert into public.user_roles (employee_id, role)
select id, 'verifier' from public.employees where emp_code = '1R-9001';
