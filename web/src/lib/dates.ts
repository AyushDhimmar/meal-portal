// Calendar dates travel as 'YYYY-MM-DD' strings. These helpers never go through the browser's
// time zone, so a laptop set to the wrong zone (or a user abroad) can't shift a lunch day.
// "Today" always means today in the canteen's time zone (APP_TZ, same as app_settings.timezone).

export const APP_TZ = 'Asia/Kolkata'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type YMD = { y: number; m: number; d: number }   // m: 1-12
export const parseYMD = (s: string): YMD => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return { y, m, d } }
export const toYMD = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
export const weekdayOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()   // 0 = Sun

/** Today's date in the canteen's time zone as 'YYYY-MM-DD'. */
export function todayIn(tz = APP_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export const addDays = (s: string, n: number) => { const { y, m, d } = parseYMD(s); const t = new Date(Date.UTC(y, m - 1, d + n)); return toYMD(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()) }
export const addMonths = (s: string, n: number) => { const { y, m } = parseYMD(s); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return toYMD(t.getUTCFullYear(), t.getUTCMonth() + 1, 1) }
export const firstOfThisMonth = (tz = APP_TZ) => todayIn(tz).slice(0, 8) + '01'

export const monthLabel = (s: string) => { const { y, m } = parseYMD(s); return `${MONTHS[m - 1]} ${y}` }
/** "24 Nov", or "24 Nov 2025" when it isn't this year */
export const shortDate = (s: string, tz = APP_TZ) => { const { y, m, d } = parseYMD(s); return `${d} ${MONTHS[m - 1].slice(0, 3)}${String(y) !== todayIn(tz).slice(0, 4) ? ' ' + y : ''}` }
export const longDate = (s: string) => { const { y, m, d } = parseYMD(s); return `${WEEKDAYS_SHORT[weekdayOf(y, m, d)]}, ${d} ${MONTHS[m - 1]} ${y}` }

/** Lunch days in a month for the given weekdays, minus holidays (mirrors v_lunch_days). */
export function lunchDays(month: string, weekdays: number[], holidays: string[] = []) {
  const { y, m } = parseYMD(month)
  const out: string[] = []
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const day = toYMD(y, m, d)
    if (weekdays.includes(weekdayOf(y, m, d)) && !holidays.includes(day)) out.push(day)
  }
  return out
}

// ---------- exact moments (timestamps from the server) ----------

/** Formats a timestamp in the canteen's time zone, not the laptop's. */
export function formatMoment(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts }).format(new Date(iso))
}
/** The canteen-time-zone date of a timestamp, as 'YYYY-MM-DD'. */
export const dayOf = (iso: string, tz = APP_TZ) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso))

/** "1 day left", "5 hours left", "40 minutes left" */
export function timeLeft(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const h = ms / 3_600_000
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} day${d > 1 ? 's' : ''} left` }
  if (h >= 1) { const n = Math.floor(h); return `${n} hour${n > 1 ? 's' : ''} left` }
  const m = Math.max(1, Math.floor(ms / 60_000)); return `${m} minute${m > 1 ? 's' : ''} left`
}

export const hhmm = (t: string) => t.slice(0, 5)
export const inr = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
