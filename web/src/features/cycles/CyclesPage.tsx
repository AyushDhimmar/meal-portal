import { useState } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Modal, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAdjustments, IconArrowRight, IconCalendar, IconCalendarPlus, IconCheck, IconEdit, IconUsers } from '@tabler/icons-react'
import { errorMessage } from '../../lib/errors'
import { inr, monthLabel, shortDate, WEEKDAYS_SHORT } from '../../lib/dates'
import { CycleCalendar } from './CycleCalendar'
import { ChangeRulesModal } from './ChangeRulesModal'
import { CycleForm } from './CycleForm'
import { EnrollmentsModal } from './EnrollmentsModal'
import { useCyclesQuery, useSetCycleStatusMutation, type CycleRow } from './api'
import { NEXT, STATUS } from './status'

const weekdayText = (w: number[]) => {
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => w.includes(d))
  const contiguous = order.length > 1 && order.every((d, i) => i === 0 || [1, 2, 3, 4, 5, 6, 0].indexOf(d) === [1, 2, 3, 4, 5, 6, 0].indexOf(order[i - 1]) + 1)
  return contiguous ? `${WEEKDAYS_SHORT[order[0]]}–${WEEKDAYS_SHORT[order[order.length - 1]]}` : order.map((d) => WEEKDAYS_SHORT[d]).join(', ')
}

type CardActions = { onEdit: () => void; onCalendar: () => void; onRules: () => void; onEnrollments: () => void; onAdvance: () => void }

function CycleCard({ c, onEdit, onCalendar, onRules, onEnrollments, onAdvance }: { c: CycleRow } & CardActions) {
  const st = STATUS[c.status]
  const editable = c.status === 'draft' || c.status === 'open'
  const next = NEXT[c.status]
  return (
    <Card>
      <Group justify="space-between" align="start" wrap="nowrap">
        <Group wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={42} radius="md" variant="light"><IconCalendar size={22} /></ThemeIcon>
          <div>
            <Text fw={700} size="lg">{monthLabel(c.month)}</Text>
            <Text size="sm" c="dimmed">{st.hint}</Text>
          </div>
        </Group>
        <Badge color={st.color} variant="light" size="lg" style={{ flexShrink: 0, overflow: 'visible' }}>{st.label}</Badge>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs" mt="md">
        <div><Text fz={22} fw={700}>{c.lunch_days}</Text><Text size="xs" c="dimmed">Lunch days ({weekdayText(c.weekdays)})</Text></div>
        <div><Text fz={22} fw={700}>{inr(c.price_paise)}</Text><Text size="xs" c="dimmed">Per meal</Text></div>
        <div><Text fz={22} fw={700}>{c.opted_in}</Text><Text size="xs" c="dimmed">Opted in</Text></div>
        <div><Text fz={22} fw={700}>{c.holidays}</Text><Text size="xs" c="dimmed">Holidays</Text></div>
      </SimpleGrid>
      <Text size="sm" c="dimmed" mt="sm">Opt-in {shortDate(c.optin_open_date)} – {shortDate(c.optin_close_date)} · Serving {c.serve_start.slice(0, 5)}–{c.serve_end.slice(0, 5)}</Text>

      <Group gap="xs" mt="md">
        {next && <Button leftSection={<IconArrowRight size={18} />} onClick={onAdvance}>{next.action}</Button>}
        <Button variant="light" leftSection={<IconUsers size={18} />} onClick={onEnrollments}>Enrollments</Button>
        <Button variant="light" leftSection={<IconCalendar size={18} />} onClick={onCalendar}>Calendar</Button>
        {editable
          ? <Button variant="default" leftSection={<IconEdit size={18} />} onClick={onEdit}>Edit</Button>
          : <Button variant="default" leftSection={<IconAdjustments size={18} />} onClick={onRules}>Change rules</Button>}
      </Group>
    </Card>
  )
}

export function CyclesPage() {
  const { data, isLoading, error } = useCyclesQuery()
  const [editing, setEditing] = useState<CycleRow | null | undefined>(undefined)
  // open dialogs hold an id; rows are looked up fresh so counts update while they're open
  const [dialog, setDialog] = useState<{ kind: 'calendar' | 'rules' | 'enrollments' | 'advance'; id: string } | null>(null)
  const row = dialog ? data?.find((c) => c.id === dialog.id) ?? null : null
  const [setStatus, statusState] = useSetCycleStatusMutation()

  async function advance(c: CycleRow) {
    const next = NEXT[c.status]
    if (!next) return
    try {
      await setStatus({ id: c.id, status: next.to }).unwrap()
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, message: `${monthLabel(c.month)} is now ${STATUS[next.to].label.toLowerCase()}` })
      setDialog(null)
    } catch { /* shown in the dialog */ }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Lunch cycles</Title>
          <Text c="dimmed" size="sm">One per month: lunch days, price and the opt-in window</Text>
        </div>
        <Button leftSection={<IconCalendarPlus size={18} />} onClick={() => setEditing(null)}>New cycle</Button>
      </Group>

      {isLoading && <Loader />}
      {error && <Alert color="red">Could not load cycles: {errorMessage(error)}</Alert>}
      {data && data.length === 0 && (
        <Card ta="center" py="xl">
          <Text fw={600}>No lunch cycles yet</Text>
          <Text c="dimmed" size="sm" mb="md">Create next month’s cycle so employees can opt in.</Text>
          <Group justify="center"><Button onClick={() => setEditing(null)}>Create the first cycle</Button></Group>
        </Card>
      )}
      {data?.map((c) => (
        <CycleCard key={c.id} c={c} onEdit={() => setEditing(c)}
          onCalendar={() => setDialog({ kind: 'calendar', id: c.id })} onRules={() => setDialog({ kind: 'rules', id: c.id })}
          onEnrollments={() => setDialog({ kind: 'enrollments', id: c.id })} onAdvance={() => { statusState.reset(); setDialog({ kind: 'advance', id: c.id }) }} />
      ))}

      {editing !== undefined && data && <CycleForm cycle={editing} existing={data} onClose={() => setEditing(undefined)} />}
      {row && dialog?.kind === 'calendar' && <CycleCalendar cycle={row} onClose={() => setDialog(null)} />}
      {row && dialog?.kind === 'rules' && <ChangeRulesModal cycle={row} onClose={() => setDialog(null)} />}
      {row && dialog?.kind === 'enrollments' && <EnrollmentsModal cycle={row} onClose={() => setDialog(null)} />}
      {row && dialog?.kind === 'advance' && NEXT[row.status] && (
        <Modal opened onClose={() => setDialog(null)} centered title={<Text fw={700}>{NEXT[row.status]!.action}: {monthLabel(row.month)}?</Text>}>
          <Stack>
            <Text size="sm">{NEXT[row.status]!.explain}</Text>
            {row.status === 'open' && <Text size="sm" c="dimmed">{row.opted_in} people have opted in so far.</Text>}
            <Text size="xs" c="dimmed">This can’t be undone: cycles only move forward (Draft → Open → Closed → Locked).</Text>
            {statusState.error && <Alert color="red">{errorMessage(statusState.error)}</Alert>}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDialog(null)}>Cancel</Button>
              <Button loading={statusState.isLoading} onClick={() => advance(row)}>{NEXT[row.status]!.action}</Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </Stack>
  )
}
