import { inr, monthLabel, shortDate, WEEKDAYS_SHORT, formatMoment } from '../../lib/dates'
import type { AuditCategory, AuditEntry } from './api'

/** Turns raw audit rows (table, before/after JSON) into sentences an Admin can read. */

export type Change = { label: string; from: string; to: string }
export type Described = { title: string; category: AuditCategory | 'other'; changes: Change[] }

type Row = Record<string, unknown>
const IGNORE = new Set(['id', 'created_at', 'updated_at', 'auth_user_id', 'cycle_id', 'employee_id'])
const ROLE: Record<string, string> = { admin: 'Admin', verifier: 'Verifier', employee: 'Employee' }
const STATUS_VERB: Record<string, string> = { open: 'Opened', closed: 'Closed opt-in for', locked: 'Locked' }
const SETTING: Record<string, string> = {
  cycle_defaults: 'new-month defaults', monthly_email: 'monthly report email', jobs: 'scheduled jobs',
  timezone: 'time zone', allowed_domain: 'allowed email domain',
}

const LABEL: Record<string, string> = {
  emp_code: 'Code', name: 'Name', email: 'Email', department: 'Department', status: 'Status',
  price_paise: 'Price per meal', weekdays: 'Lunch days', serve_start: 'Serving starts', serve_end: 'Serving ends',
  optin_opens_at: 'Opt-in opens', optin_closes_at: 'Opt-in closes', enforce_serving_window: 'Only serve in the serving window',
  billing_basis: 'Bill on', label: 'Holiday name', opted_in: 'Opted in', source: 'Changed by', month: 'Month',
  optin_open_day: 'Opt-in opens (day of month before)', optin_close_day: 'Opt-in closes (day of month before)',
  enabled: 'Send the email', day: 'Day of month', time: 'Time', recipients: 'Recipients',
  fallback_list_time: 'Paper list time', nightly_backup_time: 'Backup time', backup_retention_days: 'Keep backups (days)',
}

function formatValue(key: string, v: unknown, tz: string): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (key === 'price_paise') return inr(Number(v))
  if (key === 'weekdays' && Array.isArray(v)) return [1, 2, 3, 4, 5, 6, 0].filter((d) => v.includes(d)).map((d) => WEEKDAYS_SHORT[d]).join(', ')
  if (key === 'optin_opens_at' || key === 'optin_closes_at') return formatMoment(String(v), tz, { day: 'numeric', month: 'short', year: 'numeric' })
  if (key === 'serve_start' || key === 'serve_end') return String(v).slice(0, 5)
  if (key === 'month') return monthLabel(String(v))
  if (key === 'billing_basis') return v === 'consumed' ? 'Meals eaten' : 'Opted days'
  if (key === 'source') return v === 'admin_override' ? 'Admin' : 'Employee'
  if (key === 'recipients') return v === 'all_admins' ? 'All Admins' : String(v)
  if (key === 'status') return String(v).charAt(0).toUpperCase() + String(v).slice(1)
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Field-by-field differences, skipping bookkeeping columns. */
function diff(before: Row | null, after: Row | null, tz: string): Change[] {
  if (!before || !after) return []
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !IGNORE.has(k))
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ label: LABEL[k] ?? k, from: formatValue(k, before[k], tz), to: formatValue(k, after[k], tz) }))
}

const who = (e: AuditEntry) => e.subject_name ? `${e.subject_name}${e.subject_code ? ` (${e.subject_code})` : ''}` : 'an employee'
const month = (e: AuditEntry) => e.cycle_month ? monthLabel(e.cycle_month) : 'a month'
const day = (v: unknown) => (typeof v === 'string' && v ? shortDate(v) : null)

export function describe(e: AuditEntry, tz: string): Described {
  const b = e.before, a = e.after
  switch (e.entity) {
    case 'employees': {
      if (e.action === 'insert') return { category: 'people', title: `Added ${who(e)}`, changes: [] }
      if (e.action === 'delete') return { category: 'people', title: `Removed ${who(e)}`, changes: [] }
      const changes = diff(b, a, tz)
      if (!changes.length && b?.auth_user_id == null && a?.auth_user_id != null)
        return { category: 'people', title: `${who(e)} signed in for the first time`, changes: [] }
      if (b?.status !== a?.status && changes.length === 1)
        return { category: 'people', title: `${a?.status === 'inactive' ? 'Deactivated' : 'Reactivated'} ${who(e)}`, changes: [] }
      return { category: 'people', title: `Updated ${who(e)}`, changes }
    }
    case 'user_roles': {
      const role = ROLE[String((a ?? b)?.role)] ?? String((a ?? b)?.role)
      return e.action === 'delete'
        ? { category: 'people', title: `Removed the ${role} role from ${who(e)}`, changes: [] }
        : { category: 'people', title: `Gave ${who(e)} the ${role} role`, changes: [] }
    }
    case 'lunch_cycles': {
      if (e.action === 'insert') return { category: 'cycles', title: `Created ${month(e)}${a?.status === 'open' ? ' and opened it for opt-in' : ' as a draft'}`, changes: [] }
      if (e.action === 'delete') return { category: 'cycles', title: `Deleted ${month(e)}`, changes: [] }
      const changes = diff(b, a, tz)
      const status = changes.find((c) => c.label === 'Status')
      if (status && changes.length === 1) {
        const verb = STATUS_VERB[String(a?.status)] ?? 'Changed status of'
        return { category: 'cycles', title: `${verb} ${month(e)}${a?.status === 'open' ? ' for opt-in' : a?.status === 'locked' ? ' for billing' : ''}`, changes: [] }
      }
      return { category: 'cycles', title: `Changed the rules of ${month(e)}`, changes }
    }
    case 'cycle_holidays': {
      const d = day((a ?? b)?.day) ?? 'a day'
      const label = (a ?? b)?.label ? ` (${(a ?? b)?.label})` : ''
      if (e.action === 'delete') return { category: 'cycles', title: `Removed the holiday on ${d}`, changes: [] }
      return { category: 'cycles', title: `${e.action === 'update' ? 'Renamed the holiday on' : 'Marked'} ${d}${e.action === 'update' ? '' : ' as a holiday'}${label}`, changes: e.action === 'update' ? diff(b, a, tz) : [] }
    }
    case 'enrollments':
      return { category: 'enrollments', title: `Opted ${who(e)} ${a?.opted_in ? 'in to' : 'out of'} ${month(e)}`, changes: [] }
    case 'meal_logs': {
      if (e.action === 'void_meal') return { category: 'meals', title: `Voided the meal of ${who(e)}${day(b?.served_on) ? ` on ${day(b?.served_on)}` : ''}`, changes: [] }
      if (e.action === 'record_meal') return { category: 'meals', title: `Recorded a paper-list meal for ${who(e)}${day(a?.day) ? ` on ${day(a?.day)}` : ''}`, changes: [] }
      return { category: 'meals', title: `${e.action} meal for ${who(e)}`, changes: [] }
    }
    case 'app_settings': {
      const name = SETTING[e.entity_id ?? ''] ?? e.entity_id ?? 'a setting'
      const bv = b?.value, av = a?.value
      const changes = bv && av && typeof bv === 'object' && typeof av === 'object'
        ? diff(bv as Row, av as Row, tz)
        : [{ label: 'Value', from: formatValue('', bv, tz), to: formatValue('', av, tz) }]
      return { category: 'settings', title: `${e.action === 'insert' ? 'Added' : 'Changed'} ${name}`, changes }
    }
    default:
      return { category: 'other', title: `${e.action} ${e.entity}`, changes: diff(b, a, tz) }
  }
}
