/**
 * One error shape for the whole app. Database functions raise short codes (e.g. EMAIL_TAKEN);
 * toAppError turns any thrown value (Postgres, Auth, network, JS) into { code, message } where
 * message is a sentence people can act on. RTK Query endpoints return this as their `error`.
 */
export type AppError = { code: string; message: string; hint?: string }

const MESSAGES: Record<string, string> = {
  NETWORK: 'Can’t reach the server. Check your connection and try again.',
  FORBIDDEN: 'You do not have permission to do this.',
  NAME_REQUIRED: 'Enter the employee’s name.',
  EMAIL_DOMAIN: 'Email must be a @1rivet.com address.',
  EMAIL_TAKEN: 'Another employee already uses this email.',
  EMP_CODE_FORMAT: 'Employee code must look like 1R-0123.',
  EMP_CODE_TAKEN: 'This employee code is already in use.',
  EMPLOYEE_NOT_FOUND: 'This employee no longer exists. Refresh the list.',
  LAST_ADMIN: 'At least one active Admin must remain. Make someone else an Admin first.',
  FILE_EMPTY: 'The file has no employee rows.',
  FILE_TOO_LARGE: 'Import at most 5,000 rows at a time. Split the file and import each part.',
  DATES_REQUIRED: 'Choose the month and both opt-in dates.',
  WEEKDAYS_REQUIRED: 'Choose at least one lunch weekday.',
  PRICE_INVALID: 'Price per meal must be more than ₹0.',
  OPTIN_CLOSE_BEFORE_OPEN: 'Opt-in must close on or after the day it opens.',
  OPTIN_MUST_CLOSE_BEFORE_MONTH_STARTS: 'Opt-in must close before the lunch month starts.',
  SERVE_WINDOW_INVALID: 'Serving must end after it starts.',
  CYCLE_EXISTS: 'A cycle for this month already exists.',
  CYCLE_CLOSED: 'This cycle is closed. Changes now need a reason.',
  CYCLE_NOT_FOUND: 'This cycle no longer exists. Refresh the list.',
  INVALID_TRANSITION: 'That status change isn’t allowed. Cycles only move Draft → Open → Closed → Locked.',
  CUTOFF_PASSED: 'The opt-in window has closed. Ask an Admin if you need a change.',
  NOT_AN_EMPLOYEE: 'You are not on the lunch list. Ask an Admin to add you.',
  TODAY_ONLY: 'The counter can only serve today’s lunch.',
  REASON_REQUIRED: 'A reason of at least 5 characters is required.',
  SETTING_UNKNOWN: 'This setting can’t be changed here.',
  SETTING_INVALID: 'One of the values isn’t valid.',
  CATEGORY_UNKNOWN: 'Unknown audit log type.',
  MEAL_NOT_FOUND_OR_ALREADY_VOIDED: 'This meal was already voided or no longer exists.',
}
// longest first, so CYCLE_NOT_FOUND isn't mistaken for a shorter code it contains
const CODES = Object.keys(MESSAGES).sort((a, b) => b.length - a.length)

const isAppError = (e: unknown): e is AppError =>
  typeof e === 'object' && e !== null && 'code' in e && 'message' in e && (e as { __app?: true }).__app === true

export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e
  const obj = typeof e === 'object' && e !== null ? (e as Record<string, unknown>) : {}
  const text = e instanceof Error ? e.message : typeof obj.message === 'string' ? obj.message : String(e)
  const hint = typeof obj.hint === 'string' && obj.hint ? obj.hint : undefined
  const code = /failed to fetch|networkerror|load failed/i.test(text) ? 'NETWORK' : CODES.find((k) => text.includes(k))
  const message = code === 'SETTING_INVALID' && hint ? `${hint}.` : code ? MESSAGES[code] : text || 'Something went wrong.'
  return Object.assign({ code: code ?? (typeof obj.code === 'string' && obj.code ? obj.code : 'UNKNOWN'), message, hint }, { __app: true as const })
}

/** The sentence to show for any error (AppError, Postgres error, Error, string…). */
export const errorMessage = (e: unknown) => toAppError(e).message
