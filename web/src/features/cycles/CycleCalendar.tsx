import { useState } from 'react'
import { Alert, Badge, Group, Loader, Modal, Stack, Text, UnstyledButton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconLock } from '@tabler/icons-react'
import { ReasonModal } from '../../components/ReasonModal'
import { errorMessage } from '../../lib/errors'
import { daysInMonth, monthLabel, parseYMD, shortDate, toYMD, weekdayOf } from '../../lib/dates'
import { useHolidaysQuery, useSetHolidayMutation, type CycleRow } from './api'
import classes from './CycleCalendar.module.css'

/** Month grid: tap a lunch day to make it a holiday (removed from billing), tap again to undo. */
export function CycleCalendar({ cycle, onClose }: { cycle: CycleRow; onClose: () => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const { data: holidays, isLoading } = useHolidaysQuery(cycle.id)
  const [setHoliday, holidayState] = useSetHolidayMutation()
  // days with a save in flight: the grid already shows the new state (optimistic), but the same
  // day can't be tapped again until the server has answered
  const [saving, setSaving] = useState<Set<string>>(new Set())
  // draft/open: tap to toggle. closed/locked: the change alters bills, so each tap asks for a reason
  const needsReason = cycle.status === 'closed' || cycle.status === 'locked'
  const [pendingDay, setPendingDay] = useState<string | null>(null)

  const { y, m } = parseYMD(cycle.month)
  const hol = new Set((holidays ?? []).map((h) => h.day))
  const lead = (weekdayOf(y, m, 1) + 6) % 7            // Monday-first grid
  const cells: (string | null)[] = [...Array(lead).fill(null)]
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push(toYMD(y, m, d))

  const isLunchWeekday = (day: string) => { const p = parseYMD(day); return cycle.weekdays.includes(weekdayOf(p.y, p.m, p.d)) }
  const lunchCount = cells.filter((c) => c && isLunchWeekday(c) && !hol.has(c)).length

  async function apply(day: string, reason: string | null) {
    const makeHoliday = !hol.has(day)
    setPendingDay(null)
    setSaving((s) => new Set(s).add(day))
    try {
      await setHoliday({ cycleId: cycle.id, day, isHoliday: makeHoliday, reason }).unwrap()
      if (reason) notifications.show({ color: 'green', message: `${shortDate(day)} ${makeHoliday ? 'marked as a holiday' : 'is a lunch day again'} · reason recorded` })
    } catch (e) {
      // the day has already flipped back (see setHoliday in api.ts); say why
      notifications.show({ color: 'red', message: `${shortDate(day)} not changed: ${errorMessage(e)}` })
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(day); return n })
    }
  }

  function toggle(day: string) {
    if (!isLunchWeekday(day) || saving.has(day)) return
    if (needsReason) setPendingDay(day)
    else apply(day, null)
  }

  return (
    <Modal opened onClose={onClose} fullScreen={mobile} centered size="md"
      title={<Text fw={700} size="lg">{monthLabel(cycle.month)} calendar</Text>}>
      <Stack>
        {needsReason
          ? <Alert color="orange" variant="light" icon={<IconLock size={18} />}>This cycle is {cycle.status}. Tap a day to change it; you’ll be asked for a reason because it changes everyone’s bill.</Alert>
          : <Text size="sm" c="dimmed">Tap a lunch day to mark it as a holiday. Holidays are not served or billed.</Text>}

        {isLoading ? <Loader /> : (
          <div className={classes.grid} aria-busy={saving.size > 0}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((h, i) => <div key={i} className={classes.head}>{h}</div>)}
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const lunch = isLunchWeekday(day)
              const kind = !lunch ? 'off' : hol.has(day) ? 'holiday' : 'lunch'
              return (
                <UnstyledButton key={day} className={classes.day} data-kind={kind} disabled={!lunch}
                  aria-label={`${shortDate(day)}: ${kind === 'off' ? 'no lunch' : kind}`} aria-pressed={kind === 'holiday'}
                  onClick={() => toggle(day)}>
                  {parseYMD(day).d}
                </UnstyledButton>
              )
            })}
          </div>
        )}

        <Group gap="lg">
          <Group gap={6}><span className={classes.key} data-kind="lunch" />  <Text size="xs" c="dimmed">Lunch day</Text></Group>
          <Group gap={6}><span className={classes.key} data-kind="holiday" /><Text size="xs" c="dimmed">Holiday</Text></Group>
        </Group>

        <Group justify="space-between">
          <Text fw={600}>{lunchCount} lunch days</Text>
          <Group gap={4}>{(holidays ?? []).map((h) => <Badge key={h.day} variant="light" color="orange">{shortDate(h.day)}</Badge>)}</Group>
        </Group>
      </Stack>
      {pendingDay && (
        <ReasonModal title={hol.has(pendingDay) ? 'Make this a lunch day again?' : 'Mark as a holiday?'}
          confirmLabel={hol.has(pendingDay) ? 'Make lunch day' : 'Mark holiday'}
          summary={<>{shortDate(pendingDay)} will {hol.has(pendingDay) ? 'be served and billed again' : 'not be served or billed'} for everyone opted in to {monthLabel(cycle.month)}.</>}
          onConfirm={(r) => apply(pendingDay, r)} onCancel={() => { setPendingDay(null); holidayState.reset() }} />
      )}
    </Modal>
  )
}
