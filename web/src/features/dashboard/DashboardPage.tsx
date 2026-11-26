import { useState } from 'react'
import { ActionIcon, Alert, Avatar, Badge, Button, Card, Group, Loader, Menu, Progress, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconDots, IconFileSpreadsheet, IconPrinter, IconSearch, IconToolsKitchen2, IconTrash } from '@tabler/icons-react'
import { Link } from 'react-router'
import { ReasonModal } from '../../components/ReasonModal'
import { APP_TZ, formatMoment, longDate, monthLabel, shortDate, todayIn } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { downloadXlsx } from '../../lib/excel'
import { initials } from '../../lib/format'
import { useCyclesQuery } from '../cycles/api'
import { useDayCountsQuery, useDayListQuery, useRecordMealMutation, useVoidMealMutation, type DayRow } from './api'
import { RefreshButton } from '../../components/RefreshButton'
import classes from './DashboardPage.module.css'

const time = (iso: string) => formatMoment(iso, APP_TZ, { hour: 'numeric', minute: '2-digit' })
const METHOD: Record<string, string> = { code: 'Code', scan: 'Scan', name: 'Name search', paper: 'Paper list' }

function Kpi({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return <Card padding="md"><Text size="sm" c="dimmed">{label}</Text><Text fz={30} fw={700} c={color} lh={1.2}>{value}</Text></Card>
}

/** Served vs expected for any day (loads on open; Refresh button), with corrections (US-022, US-004, US-029) and the paper list (US-009). */
export function DashboardPage() {
  const today = todayIn()
  const [day, setDay] = useState(today)
  const live = day === today
  const counts = useDayCountsQuery(day, { refetchOnMountOrArgChange: true })
  const list = useDayListQuery(day, { refetchOnMountOrArgChange: true })
  const cycles = useCyclesQuery()
  const [voidMeal, voiding] = useVoidMealMutation()
  const [record, recording] = useRecordMealMutation()
  const [tab, setTab] = useState<'served' | 'pending'>('served')
  const [q, setQ] = useState('')
  const [action, setAction] = useState<{ kind: 'void' | 'record'; row: DayRow } | null>(null)

  const c = counts.data
  const rows = list.data ?? []
  const served = rows.filter((r) => r.served_at).sort((a, b) => (b.served_at! > a.served_at! ? 1 : -1))
  const pending = rows.filter((r) => r.expected && !r.served_at)
  const needle = q.trim().toLowerCase()
  const shown = (tab === 'served' ? served : pending).filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.emp_code.toLowerCase().includes(needle))
  const pct = c && c.expected ? Math.round((c.served_expected / c.expected) * 100) : 0
  const openCycle = cycles.data?.find((x) => x.status === 'open')

  async function confirm(reason: string) {
    if (!action) return
    try {
      if (action.kind === 'void') await voidMeal({ mealId: action.row.meal_id!, reason }).unwrap()
      else {
        const r = await record({ code: action.row.emp_code, day, reason }).unwrap()
        if (r.result !== 'SERVED') { notifications.show({ color: 'orange', message: `Not recorded: ${r.result.replace(/_/g, ' ').toLowerCase()}` }); setAction(null); return }
      }
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, message: `${action.row.name}: meal ${action.kind === 'void' ? 'voided' : 'recorded'} · reason saved` })
      setAction(null)
    } catch { /* shown in the dialog */ }
  }

  async function excel() {
    const expected = rows.filter((r) => r.expected)
    await downloadXlsx(`lunch-list-${day}.xlsx`, ['Code', 'Name', 'Department', 'Served at', 'Tick'],
      expected.map((r) => [r.emp_code, r.name, r.department, r.served_at ? time(r.served_at) : null, null]), [12, 28, 18, 12, 8], 'Lunch list')
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed" size="sm">{live ? `Today · ${longDate(day)}` : longDate(day)}</Text>
        </div>
        <Group gap="xs">
          <TextInput type="date" value={day} max={today} onChange={(e) => e.currentTarget.value && setDay(e.currentTarget.value)} aria-label="Date" w={170} />
          {!live && <Button variant="subtle" onClick={() => setDay(today)}>Today</Button>}
          <RefreshButton busy={counts.isFetching || list.isFetching} onClick={() => { counts.refetch(); list.refetch() }} />
        </Group>
      </Group>

      {(counts.error || list.error) && <Alert color="red">{errorMessage(counts.error ?? list.error)}</Alert>}
      {c && !c.is_lunch_day && <Alert color="gray">{live ? 'Today is' : `${shortDate(day)} was`} not a lunch day.</Alert>}

      {c && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Kpi label="Expected" value={c.expected} />
            <Kpi label="Served" value={c.served_expected} color="green.7" />
            <Kpi label={live ? 'Still to come' : 'Not collected'} value={c.expected - c.served_expected} />
            <Kpi label="Not on list" value={c.unplanned} color={c.unplanned ? 'orange.7' : undefined} />
          </SimpleGrid>
          <Progress value={pct} size="lg" radius="xl" />
        </>
      )}

      <div className={classes.layout}>
        <Card p={0}>
          <Stack p="md" gap="sm">
            <SegmentedControl fullWidth value={tab} onChange={(v) => setTab(v as 'served' | 'pending')}
              data={[{ value: 'served', label: `Served (${served.length})` }, { value: 'pending', label: `${live ? 'Still to come' : 'Not collected'} (${pending.length})` }]} />
            <TextInput leftSection={<IconSearch size={18} />} placeholder="Search name or code" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
          </Stack>
          {list.isLoading && <Loader m="md" />}
          {shown.map((r) => (
            <div key={r.emp_code} className={classes.row}>
              <Avatar radius="xl" color="brand">{initials(r.name)}</Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text fw={600} truncate>{r.name}</Text>
                <Text size="xs" c="dimmed">{r.emp_code}{r.department ? ` · ${r.department}` : ''}{r.method ? ` · ${METHOD[r.method] ?? r.method}` : ''}</Text>
                {r.served_at && !r.expected && <Badge size="xs" variant="light" color="orange" mt={2}>Not on list</Badge>}
              </div>
              {r.served_at ? (
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" c="dimmed">{time(r.served_at)}</Text>
                  <Menu position="bottom-end">
                    <Menu.Target><ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${r.name}`}><IconDots size={18} /></ActionIcon></Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => { voiding.reset(); setAction({ kind: 'void', row: r }) }}>Void this meal</Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              ) : (
                <Button size="xs" variant="light" leftSection={<IconToolsKitchen2 size={14} />} onClick={() => { recording.reset(); setAction({ kind: 'record', row: r }) }}>Record meal</Button>
              )}
            </div>
          ))}
          {list.data && shown.length === 0 && (
            <Text c="dimmed" ta="center" py="lg">{needle ? 'Nobody matches.' : tab === 'served' ? 'No meals served.' : 'Everyone expected was served.'}</Text>
          )}
        </Card>

        <Stack gap="md">
          <Card>
            <Text fw={600}>Paper fallback list</Text>
            <Text size="sm" c="dimmed" mb="sm">Everyone expected on {live ? 'today' : shortDate(day)}, with a tick column, in case the system is down at lunch.</Text>
            <Group grow>
              <Button component={Link} to={`/admin/print/fallback?date=${day}`} target="_blank" variant="light" leftSection={<IconPrinter size={18} />}>PDF</Button>
              <Button variant="default" leftSection={<IconFileSpreadsheet size={18} />} onClick={excel} disabled={!rows.length}>Excel</Button>
            </Group>
          </Card>
          {openCycle && (
            <Card>
              <Group justify="space-between"><Text fw={600}>{monthLabel(openCycle.month)}</Text><Badge color="green" variant="light">Open</Badge></Group>
              <Text size="sm" c="dimmed" mt={4}><b>{openCycle.opted_in}</b> opted in · opt-in closes {shortDate(openCycle.optin_close_date)}</Text>
              <Button component={Link} to="/admin/cycles" variant="subtle" size="xs" mt="xs" px={0}>Manage cycles</Button>
            </Card>
          )}
        </Stack>
      </div>

      {action && (
        <ReasonModal
          title={action.kind === 'void' ? 'Void this meal?' : 'Record a meal?'}
          confirmLabel={action.kind === 'void' ? 'Void meal' : 'Record meal'} danger={action.kind === 'void'}
          busy={voiding.isLoading || recording.isLoading}
          error={(voiding.error || recording.error) ? errorMessage(voiding.error ?? recording.error) : null}
          summary={action.kind === 'void'
            ? <>The meal for <b>{action.row.name}</b> on {shortDate(day)} at {time(action.row.served_at!)} will be removed from their bill. The record stays in the audit log.</>
            : <><b>{action.row.name}</b> will be recorded as served on {shortDate(day)}, e.g. from the paper list.</>}
          onConfirm={confirm} onCancel={() => setAction(null)} />
      )}
    </Stack>
  )
}
