import { z } from 'zod'
import { isValidEmpCode, normalizeEmpCode } from '../../lib/empCode'

/** Same rules as admin_save_employee(); checked in the form before anything is sent. */
export const employeeSchema = z.object({
  emp_code: z.string().transform(normalizeEmpCode).refine(isValidEmpCode, 'Use the format 1R-0123 (you can type just 0123)'),
  name: z.string().trim().min(1, 'Enter a name').max(120, 'Keep the name under 120 characters'),
  email: z.string().trim().toLowerCase().regex(/^[^@\s]+@1rivet\.com$/, 'Must be a @1rivet.com email'),
  department: z.string().trim().max(80, 'Keep the department under 80 characters'),
  status: z.enum(['active', 'inactive']),
  roles: z.array(z.enum(['admin', 'verifier'])),
})

export type EmployeeFormValues = z.input<typeof employeeSchema>
