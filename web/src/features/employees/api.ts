import type { QueryData } from '@supabase/supabase-js'
import { api, nullable, sb, sbJson } from '../../app/api'
import { supabase, type Enums } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'

export type AppRole = Enums<'app_role'>
export type EmployeeStatus = Enums<'employee_status'>

const employeesQuery = () => supabase
  .from('employees')
  .select('id, emp_code, name, email, department, status, user_roles(role)')
  .order('emp_code')
/** Row type inferred from the select above and the generated database types. */
export type EmployeeRow = QueryData<ReturnType<typeof employeesQuery>>[number]

export type EmployeeInput = {
  id: string | null; emp_code: string; name: string; email: string
  department: string; status: EmployeeStatus; roles: AppRole[]
}

/** Matches the jsonb returned by import_employees() */
export type ImportSummary = {
  dry_run: boolean; total: number; new: number; changed: number; unchanged: number
  error_count: number; errors: { row: number; code: string; name: string; error: string }[]
}

export const employeesApi = api.injectEndpoints({
  endpoints: (b) => ({
    employees: b.query<EmployeeRow[], void>({
      queryFn: () => sb(employeesQuery()),
      providesTags: ['Employee'],
    }),

    saveEmployee: b.mutation<{ id: string; emp_code: string }, EmployeeInput>({
      queryFn: (e) => sbJson<{ id: string; emp_code: string }>(supabase.rpc('admin_save_employee', {
        p_id: nullable(e.id), p_emp_code: e.emp_code, p_name: e.name, p_email: e.email,
        p_department: e.department, p_status: e.status, p_roles: e.roles,
      })),
      // Profile too: an Admin may have edited their own name or roles
      invalidatesTags: (_r, error) => (error ? [] : ['Employee', 'Profile', 'Audit']),
    }),

    importEmployees: b.mutation<ImportSummary, { rows: Json[]; dryRun: boolean }>({
      queryFn: ({ rows, dryRun }) => sbJson<ImportSummary>(supabase.rpc('import_employees', { p_rows: rows, p_dry_run: dryRun })),
      invalidatesTags: (r) => (r && !r.dry_run ? ['Employee', 'Audit'] : []),
    }),
  }),
})

export const { useEmployeesQuery, useSaveEmployeeMutation, useImportEmployeesMutation } = employeesApi
