import { api, sbView, type NotNull } from '../../app/api'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../lib/database.types'

type BillView = Tables<'v_monthly_bill'>
/** One row per employee for a cycle (v_monthly_bill). Department may be empty; every other column is filled. */
export type BillRow = NotNull<Pick<BillView, 'employee_id' | 'emp_code' | 'name' | 'status' | 'opted_days' | 'consumed_days' |
  'price_paise' | 'payable_paise' | 'billing_basis' | 'opted_days_to_date'>> & { department: string | null }
// opted_days_to_date: opted lunch days up to today — "not collected" must never count days still to come

export const reportsApi = api.injectEndpoints({
  endpoints: (b) => ({
    monthlyBill: b.query<BillRow[], string>({
      queryFn: async (cycleId) => {
        const res = await sbView(supabase.from('v_monthly_bill')
          .select('employee_id, emp_code, name, department, status, opted_days, opted_days_to_date, consumed_days, price_paise, payable_paise, billing_basis')
          .eq('cycle_id', cycleId)
          .order('emp_code'))
        return res.error ? { error: res.error } : { data: res.data as BillRow[] }   // department: see BillRow
      },
      providesTags: ['Bill'],
    }),
  }),
})

export const { useMonthlyBillQuery } = reportsApi
