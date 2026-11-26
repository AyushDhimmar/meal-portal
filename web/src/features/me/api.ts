import { api, sbJson } from '../../app/api'
import { supabase } from '../../lib/supabase'

// Shapes of the jsonb returned by my_home() and my_history() (see the SQL migrations).

export type MyHome = {
  tz: string
  today: { date: string; is_lunch_day: boolean; opted_in: boolean; served_at: string | null; serve_start?: string; serve_end?: string }
  current: { cycle_id: string; month: string; status: string; opted_in: boolean; opted_days: number; consumed_days: number; payable_paise: number } | null
  next: {
    cycle_id: string; month: string; status: string; price_paise: number; weekdays: number[]; lunch_days: number; holidays: string[]
    optin_opens_at: string; optin_closes_at: string; serve_start: string; serve_end: string
    opted_in: boolean | null; source: 'self' | 'admin_override' | null; can_change: boolean
  } | null
}

export type DayKind = 'served' | 'missed' | 'today' | 'upcoming' | 'holiday' | 'not_opted'
export type MyHistory = {
  tz: string
  months: { cycle_id: string; month: string }[]
  cycle: {
    cycle_id: string; month: string; status: string; price_paise: number; billing_basis: 'opted' | 'consumed'
    opted_in: boolean; opted_days: number; consumed_days: number; payable_paise: number
  } | null
  days: { day: string; kind: DayKind; served_at: string | null }[]
}

export const meApi = api.injectEndpoints({
  endpoints: (b) => ({
    /** Today, this month and next month for the signed-in employee. */
    myHome: b.query<MyHome, void>({
      queryFn: () => sbJson<MyHome>(supabase.rpc('my_home')),
      providesTags: ['MyHome'],
    }),

    /** One month of meals and the bill (null = the latest month). */
    myHistory: b.query<MyHistory, string | null>({
      queryFn: (cycleId) => sbJson<MyHistory>(supabase.rpc('my_history', cycleId ? { p_cycle_id: cycleId } : {})),
      providesTags: ['MyHistory'],
    }),

    setMyEnrollment: b.mutation<{ opted_in: boolean; lunch_days: number; estimate_paise: number }, { cycleId: string; optedIn: boolean }>({
      queryFn: ({ cycleId, optedIn }) => sbJson<{ opted_in: boolean; lunch_days: number; estimate_paise: number }>(
        supabase.rpc('set_my_enrollment', { p_cycle_id: cycleId, p_opted_in: optedIn })),
      // Instant (after the confirmation): the card shows the new choice now; back if the server refuses
      async onQueryStarted({ cycleId, optedIn }, { dispatch, queryFulfilled }) {
        const patch = dispatch(meApi.util.updateQueryData('myHome', undefined, (h) => {
          if (h.next?.cycle_id === cycleId) { h.next.opted_in = optedIn; h.next.source = 'self' }
        }))
        try { await queryFulfilled } catch { patch.undo() }
      },
      invalidatesTags: (_r, e) => (e ? [] : ['MyHome', 'MyHistory', 'Cycle', 'Enrollment', 'Bill', 'Day']),
    }),
  }),
})

export const { useMyHomeQuery, useMyHistoryQuery, useSetMyEnrollmentMutation } = meApi
