import { api, sb, sbJson } from '../../app/api'
import { supabase } from '../../lib/supabase'
import type { CounterCounts, TodayRow, VerifyResult } from '../counter/api'

export type DayRow = TodayRow

/*
 * Any day's counts and list for Admins. No automatic refresh (agreed): data loads when the
 * screen opens or the day changes, after a correction, and on the Refresh button.
 */
export const dashboardApi = api.injectEndpoints({
  endpoints: (b) => ({
    dayCounts: b.query<CounterCounts, string>({
      queryFn: (day) => sbJson<CounterCounts>(supabase.rpc('counter_counts', { p_day: day })),
      providesTags: ['Day'],
    }),
    dayList: b.query<DayRow[], string>({
      queryFn: (day) => sb(supabase.rpc('counter_today', { p_day: day })),
      providesTags: ['Day'],
    }),
    voidMeal: b.mutation<void, { mealId: string; reason: string }>({
      queryFn: ({ mealId, reason }) => sbJson<void>(supabase.rpc('admin_void_meal', { p_meal_id: mealId, p_reason: reason })),
      invalidatesTags: (_r, e) => (e ? [] : ['Day', 'Counter', 'Bill', 'MyHome', 'MyHistory', 'Audit']),
    }),
    recordMeal: b.mutation<VerifyResult, { code: string; day: string; reason: string }>({
      queryFn: ({ code, day, reason }) => sbJson<VerifyResult>(supabase.rpc('admin_record_meal', { p_emp_code: code, p_day: day, p_reason: reason })),
      invalidatesTags: (r) => (r?.result === 'SERVED' ? ['Day', 'Counter', 'Bill', 'MyHome', 'MyHistory', 'Audit'] : []),
    }),
  }),
})

export const { useDayCountsQuery, useDayListQuery, useVoidMealMutation, useRecordMealMutation } = dashboardApi
