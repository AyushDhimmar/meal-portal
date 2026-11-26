import { useState } from 'react'
import { Alert, Avatar, Badge, Card, Group, Loader, Progress, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { errorMessage } from '../../lib/errors'
import { RefreshButton } from '../../components/RefreshButton'
import { initials } from '../../lib/format'
import { APP_TZ, formatMoment } from '../../lib/dates'
import { useCounterCountsQuery, useCounterTodayQuery } from './api'
import classes from './TodayPage.module.css'

const time = (iso: string) => formatMoment(iso, APP_TZ, { hour: 'numeric', minute: '2-digit' })

function Kpi({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return <Card padding="md"><Text size="sm" c="dimmed">{label}</Text><Text fz={30} fw={700} c={color} lh={1.2}>{value}</Text></Card>
}

/** Served vs expected for today (US-019). Loads when opened; Refresh button for updates from other counters. */
export function TodayPage() {
  const counts = useCounterCountsQuery(undefined, { refetchOnMountOrArgChange: true })
  const list = useCounterTodayQuery(undefined, { refetchOnMountOrArgChange: true })
  const [tab, setTab] = useState<'pending' | 'served'>('pending')
  const [q, setQ] = useState('')

  const c = counts.data
  const rows = list.data ?? []
  const pending = rows.filter((r) => r.expected && !r.served_at)
  const served = rows.filter((r) => r.served_at).sort((a, b) => (b.served_at! > a.served_at! ? 1 : -1))
  const needle = q.trim().toLowerCase()
  const shown = (tab === 'pending' ? pending : served)
    .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.emp_code.toLowerCase().includes(needle))
  const pct = c && c.expected ? Math.round((c.served_expected / c.expected) * 100) : 0

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Today</Title>
          <Text c="dimmed" size="sm">{c ? new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(c.day + 'T00:00:00')) : ' '}</Text>
        </div>
        <RefreshButton busy={counts.isFetching || list.isFetching} onClick={() => { counts.refetch(); list.refetch() }} />
      </Group>
      {(counts.error || list.error) && <Alert color="red">{errorMessage(counts.error ?? list.error)}</Alert>}
      {c && !c.is_lunch_day && <Alert color="gray">Today is not a lunch day.</Alert>}

      {c && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <Kpi label="Expected" value={c.expected} />
            <Kpi label="Served" value={c.served_expected} color="green.7" />
            <Kpi label="Still to come" value={c.expected - c.served_expected} />
            <Kpi label="Progress" value={`${pct}%`} />
          </SimpleGrid>
          <Progress value={pct} size="lg" radius="xl" />
          {c.unplanned > 0 && <Text size="sm" c="dimmed">+{c.unplanned} meal{c.unplanned > 1 ? 's' : ''} for people not on today’s list (recorded by an Admin).</Text>}
        </>
      )}

      <Card p={0}>
        <Stack p="md" gap="sm">
          <SegmentedControl fullWidth value={tab} onChange={(v) => setTab(v as 'pending' | 'served')}
            data={[{ value: 'pending', label: `Still to come (${pending.length})` }, { value: 'served', label: `Served (${served.length})` }]} />
          <TextInput leftSection={<IconSearch size={18} />} placeholder="Search name or code" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
        </Stack>
        {list.isLoading && <Loader m="md" />}
        {shown.map((r) => (
          <div key={r.emp_code} className={classes.row}>
            <Avatar radius="xl" color="brand">{initials(r.name)}</Avatar>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} truncate>{r.name}</Text>
              <Text size="xs" c="dimmed">{r.emp_code}{r.department ? ` · ${r.department}` : ''}</Text>
            </div>
            {r.served_at
              ? <Group gap={6}>{!r.expected && <Badge size="sm" variant="light" color="orange">Not on list</Badge>}<Text size="sm" c="dimmed">{time(r.served_at)}</Text></Group>
              : <Badge variant="light" color="gray">Waiting</Badge>}
          </div>
        ))}
        {list.data && shown.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">{needle ? 'Nobody matches.' : tab === 'pending' ? 'Everyone expected has been served.' : 'No meals served yet today.'}</Text>
        )}
      </Card>
    </Stack>
  )
}
