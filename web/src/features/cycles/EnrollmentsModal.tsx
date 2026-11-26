import { useState } from 'react'
import { Alert, Badge, Chip, Group, Loader, Modal, Stack, Switch, Text, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconSearch } from '@tabler/icons-react'
import { ReasonModal } from '../../components/ReasonModal'
import { errorMessage } from '../../lib/errors'
import { monthLabel } from '../../lib/dates'
import { useCycleEnrollmentsQuery, useOverrideEnrollmentMutation, type CycleRow, type EnrollmentRow } from './api'
import classes from './EnrollmentsModal.module.css'

type Filter = 'all' | 'in' | 'out'
const optedIn = (e: EnrollmentRow) => e.enrollments[0]?.opted_in === true

/** Who is in for the month, and the Admin override (with a reason) for anyone who needs changing. */
export function EnrollmentsModal({ cycle, onClose }: { cycle: CycleRow; onClose: () => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const { data, isLoading, error } = useCycleEnrollmentsQuery(cycle.id)
  const [override] = useOverrideEnrollmentMutation()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [pending, setPending] = useState<{ e: EnrollmentRow; to: boolean } | null>(null)

  // inactive people only matter if they have a choice recorded for this month
  const people = (data ?? []).filter((e) => e.status === 'active' || e.enrollments.length > 0)
  const inCount = people.filter(optedIn).length
  const needle = q.trim().toLowerCase()
  const rows = people.filter((e) =>
    (filter === 'all' || (filter === 'in') === optedIn(e)) &&
    (!needle || e.name.toLowerCase().includes(needle) || e.emp_code.toLowerCase().includes(needle)))

  // Instant: the switch flips as soon as the reason is given; it flips back if the server says no
  async function confirm(reason: string) {
    if (!pending) return
    const { e, to } = pending
    setPending(null)
    try {
      await override({ cycleId: cycle.id, employeeId: e.id, optedIn: to, reason }).unwrap()
      notifications.show({ color: 'green', icon: <IconCheck size={18} />,
        message: `${e.name} ${to ? 'opted in' : 'opted out'} for ${monthLabel(cycle.month)}` })
    } catch (err) {
      notifications.show({ color: 'red', message: `${e.name} not changed: ${errorMessage(err)}` })
    }
  }

  return (
    <>
      <Modal opened onClose={onClose} fullScreen={mobile} centered size="lg"
        title={<Text fw={700} size="lg">Enrollments · {monthLabel(cycle.month)}</Text>}>
        <Stack>
          <Text size="sm" c="dimmed">
            <b>{inCount}</b> of {people.length} opted in. Switching someone records an Admin override with your reason.
          </Text>
          <TextInput leftSection={<IconSearch size={18} />} placeholder="Search name or code" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
          <Chip.Group value={filter} onChange={(v) => setFilter(v as Filter)}>
            <Group gap="xs">
              <Chip value="all" variant="filled">All {people.length}</Chip>
              <Chip value="in" variant="filled">Opted in {inCount}</Chip>
              <Chip value="out" variant="filled">Not in {people.length - inCount}</Chip>
            </Group>
          </Chip.Group>
          {isLoading && <Loader />}
          {error && <Alert color="red">{errorMessage(error)}</Alert>}
          <div>
            {rows.map((e) => {
              const enr = e.enrollments[0]
              return (
                <div key={e.id} className={classes.row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} truncate>{e.name}</Text>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed">{e.emp_code}{e.department ? ` · ${e.department}` : ''}</Text>
                      {!enr && <Badge size="xs" variant="light" color="gray">No choice yet</Badge>}
                      {enr?.source === 'admin_override' && <Badge size="xs" variant="light" color="orange">Set by Admin</Badge>}
                      {e.status === 'inactive' && <Badge size="xs" variant="light" color="red">Inactive</Badge>}
                    </Group>
                  </div>
                  <Switch size="lg" checked={optedIn(e)} aria-label={`${e.name} opted in`}
                    onChange={(ev) => setPending({ e, to: ev.currentTarget.checked })} />
                </div>
              )
            })}
            {data && rows.length === 0 && <Text c="dimmed" ta="center" py="md">Nobody matches.</Text>}
          </div>
        </Stack>
      </Modal>
      {pending && (
        <ReasonModal title={pending.to ? 'Opt in on their behalf?' : 'Opt out on their behalf?'}
          confirmLabel={pending.to ? 'Opt in' : 'Opt out'} danger={!pending.to}
          summary={<><b>{pending.e.name}</b> ({pending.e.emp_code}) will be {pending.to ? 'opted in' : 'opted out'} for {monthLabel(cycle.month)}. This changes their bill.</>}
          onConfirm={confirm} onCancel={() => setPending(null)} />
      )}
    </>
  )
}
