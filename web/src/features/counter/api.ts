import { api, sb, sbJson } from '../../app/api'
import { supabase, type Enums } from '../../lib/supabase'

/** Matches the jsonb returned by verify_and_serve() */
export type VerifyResult = {
  result: 'SERVED' | 'ELIGIBLE' | 'ALREADY_SERVED' | 'NOT_OPTED_IN' | 'INACTIVE' | 'NOT_FOUND' | 'NOT_LUNCH_DAY' | 'OUTSIDE_SERVING_WINDOW'
  code?: string
  employee?: { emp_code: string; name: string; department: string | null }
  served_at?: string
}
export type Method = Extract<Enums<'serve_method'>, 'code' | 'scan' | 'name'>

/** Matches the jsonb returned by counter_counts() */
export type CounterCounts = {
  day: string; is_lunch_day: boolean
  expected: number          // opted in, active, today is a lunch day
  served_expected: number   // of those, already served (drives progress)
  unplanned: number         // meals for people not on today's list (e.g. Admin-recorded)
  served: number            // all meals today
}

/*
 * No automatic refresh (agreed): counts and lists load when a counter screen is opened,
 * after every serve at this counter, and when the Refresh button is tapped. Serves at
 * another counter show up here on the next refresh.
 */
export const counterApi = api.injectEndpoints({
  endpoints: (b) => ({
    /** Look up a code and (mark = true) serve. The result is shown only after the database confirms. */
    verify: b.mutation<VerifyResult, { code: string; mark: boolean; method: Method }>({
      queryFn: ({ code, mark, method }) => sbJson<VerifyResult>(supabase.rpc('verify_and_serve', { p_emp_code: code, p_mark: mark, p_method: method })),
      invalidatesTags: (r) => (r?.result === 'SERVED' ? ['Counter', 'Day', 'MyHome', 'MyHistory', 'Bill'] : []),
    }),

    counterCounts: b.query<CounterCounts, void>({
      queryFn: () => sbJson<CounterCounts>(supabase.rpc('counter_counts', {})),
      providesTags: ['Counter'],
    }),

    counterRecent: b.query<{ emp_code: string; name: string; department: string; served_at: string }[], void>({
      queryFn: () => sb(supabase.rpc('counter_recent', { p_limit: 5 })),
      providesTags: ['Counter'],
    }),

    counterSearch: b.query<{ emp_code: string; name: string; department: string; eligible: boolean; served: boolean }[], string>({
      queryFn: (term) => sb(supabase.rpc('search_employees_for_counter', { p_q: term })),
      providesTags: ['Counter'],
      keepUnusedDataFor: 5,
    }),

    counterToday: b.query<TodayRow[], void>({
      queryFn: () => sb(supabase.rpc('counter_today', {})),
      providesTags: ['Counter'],
    }),
  }),
})

export type TodayRow = { emp_code: string; name: string; department: string | null; expected: boolean; served_at: string | null; meal_id: string | null; method: string | null }

export const { useVerifyMutation, useCounterCountsQuery, useCounterRecentQuery, useCounterSearchQuery, useCounterTodayQuery } = counterApi
