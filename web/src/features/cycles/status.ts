import type { Enums } from '../../lib/supabase'

export type CycleStatus = Enums<'cycle_status'>

export const STATUS: Record<CycleStatus, { label: string; color: string; hint: string }> = {
  draft: { label: 'Draft', color: 'gray', hint: 'Not visible to employees yet' },
  open: { label: 'Open', color: 'green', hint: 'Employees can opt in or out' },
  closed: { label: 'Closed', color: 'orange', hint: 'Opt-in has ended' },
  locked: { label: 'Locked', color: 'blue', hint: 'Final for billing' },
}

/** The only forward move from each status (draft → open → closed → locked). */
export const NEXT: Partial<Record<CycleStatus, { to: CycleStatus; action: string; explain: string }>> = {
  draft: { to: 'open', action: 'Open for opt-in', explain: 'Employees can opt in or out until the opt-in window closes.' },
  open: { to: 'closed', action: 'Close opt-in', explain: 'Employees can no longer change their choice. Admins can still change it, with a reason.' },
  closed: { to: 'locked', action: 'Lock for billing', explain: 'The month becomes final for billing. Any later change needs a reason and is audited.' },
}
