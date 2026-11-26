import { api, sb, sbJson } from '../../app/api'
import { supabase } from '../../lib/supabase'
import { APP_TZ } from '../../lib/dates'

// ---------- Audit log ----------

export type AuditCategory = 'people' | 'cycles' | 'enrollments' | 'meals' | 'settings'
/** Row of admin_audit_log(); names are null for system changes or deleted rows. */
export type AuditEntry = {
  id: number; at: string; action: string; entity: string; entity_id: string | null
  actor_name: string; actor_code: string | null
  subject_name: string | null; subject_code: string | null; cycle_month: string | null
  before: Record<string, unknown> | null; after: Record<string, unknown> | null; reason: string | null
}
export type AuditFilters = { category: AuditCategory | null; from: string | null; to: string | null; q: string }

const PAGE = 50

// ---------- Settings ----------

export type CycleDefaultsSetting = {
  weekdays: number[]; price_paise: number; optin_open_day: number; optin_close_day: number
  serve_start: string; serve_end: string; enforce_serving_window: boolean; billing_basis: 'opted' | 'consumed'
}
export type MonthlyEmailSetting = { enabled: boolean; day: number; time: string; recipients: string }
export type JobsSetting = { fallback_list_time: string; nightly_backup_time: string; backup_retention_days: number }
export type Settings = {
  timezone: string; allowed_domain: string
  cycle_defaults: CycleDefaultsSetting; monthly_email: MonthlyEmailSetting; jobs: JobsSetting
  updated_at: Record<string, string>
}
export type EditableKey = 'cycle_defaults' | 'monthly_email' | 'jobs'

export const moreApi = api.injectEndpoints({
  endpoints: (b) => ({
    /** Newest first, 50 at a time; "Load older entries" asks for the page below the last id (keyset paging). */
    auditLog: b.infiniteQuery<AuditEntry[], AuditFilters, number | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].id : undefined),
      },
      queryFn: ({ queryArg: f, pageParam }) => sbJson<AuditEntry[]>(supabase.rpc('admin_audit_log', {
        ...(f.category ? { p_category: f.category } : {}), ...(f.from ? { p_from: f.from } : {}), ...(f.to ? { p_to: f.to } : {}),
        ...(f.q.trim() ? { p_q: f.q.trim() } : {}), ...(pageParam ? { p_before_id: pageParam } : {}), p_limit: PAGE,
      })),
      providesTags: ['Audit'],
    }),

    settings: b.query<Settings, void>({
      queryFn: async () => {
        const res = await sb(supabase.from('app_settings').select('key, value, updated_at'))
        if (res.error) return { error: res.error }
        const s = Object.fromEntries(res.data.map((r) => [r.key, r.value])) as Omit<Settings, 'updated_at'>
        return { data: { ...s, updated_at: Object.fromEntries(res.data.map((r) => [r.key, r.updated_at])) } }
      },
      providesTags: ['Setting'],
    }),

    /** Validated and audited by admin_save_setting(); returns the saved (normalised) value. */
    saveSetting: b.mutation<unknown, { key: EditableKey; value: Record<string, unknown> }>({
      queryFn: ({ key, value }) => sbJson<unknown>(supabase.rpc('admin_save_setting', { p_key: key, p_value: value as never })),
      // 'Setting' also refreshes the new-cycle form's defaults (cycleDefaults provides it)
      invalidatesTags: (_r, e) => (e ? [] : ['Setting', 'Audit']),
    }),
  }),
})

export const { useAuditLogInfiniteQuery, useSettingsQuery, useSaveSettingMutation } = moreApi

/** The canteen's time zone from settings (falls back to IST until they load). */
export function useTimeZone() {
  return useSettingsQuery().data?.timezone ?? APP_TZ
}
