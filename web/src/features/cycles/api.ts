import type { QueryData } from '@supabase/supabase-js'
import { api, nullable, sb, sbJson, sbView, type NotNull } from '../../app/api'
import type { Tables } from '../../lib/database.types'
import { supabase } from '../../lib/supabase'
import type { CycleStatus } from './status'

// ---------- types ----------

const CYCLE_COLUMNS = 'id, month, status, price_paise, weekdays, serve_start, serve_end, optin_open_date, optin_close_date, lunch_days, holidays, opted_in'
const cyclesQuery = () => supabase.from('v_cycle_overview').select(CYCLE_COLUMNS).order('month', { ascending: false })
/** One row of v_cycle_overview, as selected above (every column is filled for a real cycle). */
export type CycleRow = NotNull<Pick<Tables<'v_cycle_overview'>,
  'id' | 'month' | 'status' | 'price_paise' | 'weekdays' | 'serve_start' | 'serve_end' |
  'optin_open_date' | 'optin_close_date' | 'lunch_days' | 'holidays' | 'opted_in'>>

const enrollmentsQuery = (cycleId: string) => supabase.from('employees')
  .select('id, emp_code, name, department, status, enrollments(opted_in, source)')
  .eq('enrollments.cycle_id', cycleId)   // embedded rows filtered to this cycle; people without one keep []
  .order('name')
export type EnrollmentRow = QueryData<ReturnType<typeof enrollmentsQuery>>[number]

export type Holiday = { day: string; label: string | null }

/** app_settings.cycle_defaults (see More → Settings) */
export type CycleDefaults = {
  weekdays: number[]; price_paise: number; optin_open_day: number; optin_close_day: number
  serve_start: string; serve_end: string; enforce_serving_window: boolean; billing_basis: 'opted' | 'consumed'
}

export type CycleInput = {
  id: string | null; month: string; weekdays: number[]; price_paise: number
  optin_open: string; optin_close: string; serve_start: string; serve_end: string; open: boolean
}
export type RuleChanges = Partial<{ price_paise: number; weekdays: number[]; serve_start: string; serve_end: string }>

/** Everything a lunch-day or opt-in change can affect: counts, bills, home screens, the audit log. */
const AFFECTS_BILLS = ['Cycle', 'Bill', 'Day', 'MyHome', 'MyHistory', 'Audit'] as const

// ---------- endpoints ----------

export const cyclesApi = api.injectEndpoints({
  endpoints: (b) => ({
    cycles: b.query<CycleRow[], void>({
      queryFn: () => sbView(cyclesQuery()),
      providesTags: ['Cycle'],
    }),

    cycleDefaults: b.query<CycleDefaults | null, void>({
      queryFn: async () => {
        const res = await sb(supabase.from('app_settings').select('value').eq('key', 'cycle_defaults').maybeSingle())
        return res.error ? { error: res.error } : { data: (res.data?.value ?? null) as CycleDefaults | null }
      },
      providesTags: ['CycleDefaults', 'Setting'],
    }),

    saveCycle: b.mutation<{ id: string; lunch_days: number }, CycleInput>({
      queryFn: (c) => sbJson<{ id: string; lunch_days: number }>(supabase.rpc('admin_save_cycle', {
        p_id: nullable(c.id), p_month: c.month, p_weekdays: c.weekdays, p_price_paise: c.price_paise,
        p_optin_open: c.optin_open, p_optin_close: c.optin_close, p_serve_start: c.serve_start, p_serve_end: c.serve_end, p_open: c.open,
      })),
      invalidatesTags: (_r, e) => (e ? [] : [...AFFECTS_BILLS, 'Holiday']),
    }),

    setCycleStatus: b.mutation<void, { id: string; status: CycleStatus }>({
      queryFn: ({ id, status }) => sbJson<void>(supabase.rpc('set_cycle_status', { p_cycle_id: id, p_status: status })),
      invalidatesTags: (_r, e) => (e ? [] : [...AFFECTS_BILLS]),
    }),

    updateClosedCycle: b.mutation<void, { id: string; changes: RuleChanges; reason: string }>({
      queryFn: ({ id, changes, reason }) => sbJson<void>(supabase.rpc('admin_update_cycle', { p_cycle_id: id, p_changes: changes, p_reason: reason })),
      invalidatesTags: (_r, e) => (e ? [] : [...AFFECTS_BILLS]),
    }),

    holidays: b.query<Holiday[], string>({
      queryFn: (cycleId) => sb(supabase.from('cycle_holidays').select('day, label').eq('cycle_id', cycleId).order('day')),
      providesTags: (_r, _e, cycleId) => [{ type: 'Holiday', id: cycleId }],
    }),

    setHoliday: b.mutation<void, { cycleId: string; day: string; isHoliday: boolean; label?: string | null; reason?: string | null }>({
      queryFn: ({ cycleId, day, isHoliday, label, reason }) => sbJson<void>(supabase.rpc('admin_set_holiday', {
        p_cycle_id: cycleId, p_day: day, p_is_holiday: isHoliday, p_label: nullable(label ?? null), p_reason: nullable(reason ?? null),
      })),
      // Instant: flip the day and the month's counts now; put them back if the server says no
      async onQueryStarted({ cycleId, day, isHoliday, label }, { dispatch, queryFulfilled }) {
        const patches = [
          dispatch(cyclesApi.util.updateQueryData('holidays', cycleId, (list) => {
            const i = list.findIndex((h) => h.day === day)
            if (isHoliday && i < 0) { list.push({ day, label: label ?? null }); list.sort((a, b) => a.day.localeCompare(b.day)) }
            if (!isHoliday && i >= 0) list.splice(i, 1)
          })),
          dispatch(cyclesApi.util.updateQueryData('cycles', undefined, (list) => {
            const c = list.find((x) => x.id === cycleId)
            if (c) { c.holidays += isHoliday ? 1 : -1; c.lunch_days += isHoliday ? -1 : 1 }
          })),
        ]
        try { await queryFulfilled } catch { patches.forEach((p) => p.undo()) }
      },
      invalidatesTags: (_r, e, { cycleId }) => (e ? [] : [...AFFECTS_BILLS, { type: 'Holiday', id: cycleId }]),
    }),

    cycleEnrollments: b.query<EnrollmentRow[], string>({
      queryFn: (cycleId) => sb(enrollmentsQuery(cycleId)),
      providesTags: (_r, _e, cycleId) => [{ type: 'Enrollment', id: cycleId }],
    }),

    overrideEnrollment: b.mutation<void, { cycleId: string; employeeId: string; optedIn: boolean; reason: string }>({
      queryFn: ({ cycleId, employeeId, optedIn, reason }) => sbJson<void>(supabase.rpc('admin_override_enrollment', {
        p_employee_id: employeeId, p_cycle_id: cycleId, p_opted_in: optedIn, p_reason: reason,
      })),
      async onQueryStarted({ cycleId, employeeId, optedIn }, { dispatch, queryFulfilled }) {
        let was: boolean | null = null
        const patches = [
          dispatch(cyclesApi.util.updateQueryData('cycleEnrollments', cycleId, (list) => {
            const e = list.find((x) => x.id === employeeId)
            if (!e) return
            was = e.enrollments[0]?.opted_in ?? false
            e.enrollments = [{ opted_in: optedIn, source: 'admin_override' }]
          })),
          dispatch(cyclesApi.util.updateQueryData('cycles', undefined, (list) => {
            const c = list.find((x) => x.id === cycleId)
            if (c && was !== null && was !== optedIn) c.opted_in += optedIn ? 1 : -1
          })),
        ]
        try { await queryFulfilled } catch { patches.forEach((p) => p.undo()) }
      },
      invalidatesTags: (_r, e, { cycleId }) => (e ? [] : [...AFFECTS_BILLS, { type: 'Enrollment', id: cycleId }]),
    }),
  }),
})

export const {
  useCyclesQuery, useCycleDefaultsQuery, useSaveCycleMutation, useSetCycleStatusMutation, useUpdateClosedCycleMutation,
  useHolidaysQuery, useSetHolidayMutation, useCycleEnrollmentsQuery, useOverrideEnrollmentMutation,
} = cyclesApi
