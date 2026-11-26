import { Group, Text } from '@mantine/core'
import { daysInMonth, parseYMD, toYMD, weekdayOf } from '../lib/dates'
import classes from './LunchCalendar.module.css'

/** Read-only month grid: lunch days, holidays and non-lunch days. */
export function LunchCalendar({ month, weekdays, holidays }: { month: string; weekdays: number[]; holidays: string[] }) {
  const { y, m } = parseYMD(month)
  const hol = new Set(holidays.map((h) => h.slice(0, 10)))
  const cells: (string | null)[] = Array((weekdayOf(y, m, 1) + 6) % 7).fill(null)
  for (let d = 1; d <= daysInMonth(y, m); d++) cells.push(toYMD(y, m, d))
  return (
    <div>
      <div className={classes.grid}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((h, i) => <div key={i} className={classes.head}>{h}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const p = parseYMD(day)
          const kind = !weekdays.includes(weekdayOf(p.y, p.m, p.d)) ? 'off' : hol.has(day) ? 'holiday' : 'lunch'
          return <div key={day} className={classes.day} data-kind={kind}>{p.d}</div>
        })}
      </div>
      <Group gap="lg" mt="sm">
        <Group gap={6}><span className={classes.key} data-kind="lunch" /><Text size="xs" c="dimmed">Lunch day</Text></Group>
        <Group gap={6}><span className={classes.key} data-kind="holiday" /><Text size="xs" c="dimmed">Holiday (not billed)</Text></Group>
      </Group>
    </div>
  )
}
