import { Chip, Group, Input } from '@mantine/core'
import { WEEKDAYS_SHORT } from '../../lib/dates'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]   // Monday first

/** Lunch weekdays as chips; the value is 0–6 (0 = Sunday), like the database. */
export function WeekdayChips({ value, onChange, error, label = 'Lunch weekdays' }: { value: number[]; onChange: (v: number[]) => void; error?: React.ReactNode; label?: string }) {
  return (
    <Input.Wrapper label={label} error={error}>
      <Chip.Group multiple value={value.map(String)} onChange={(v) => onChange(v.map(Number).sort((a, b) => a - b))}>
        <Group gap={6} mt={6}>{WEEK_ORDER.map((n) => <Chip key={n} value={String(n)}>{WEEKDAYS_SHORT[n]}</Chip>)}</Group>
      </Chip.Group>
    </Input.Wrapper>
  )
}
