import { useState } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, Select, Stack, Text, TextInput, ThemeIcon } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconCalendarEvent, IconDownload, IconSearch, IconSettings, IconToolsKitchen2, IconUserCheck, IconUsers } from '@tabler/icons-react'
import { errorMessage } from '../../lib/errors'
import { downloadCsv } from '../../lib/download'
import { addDays, dayOf, formatMoment, longDate, todayIn } from '../../lib/dates'
import { describe, type Described } from './auditText'
import { useAuditLogInfiniteQuery, useTimeZone, type AuditCategory, type AuditEntry } from './api'
import classes from './MorePage.module.css'

const CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: 'people', label: 'People and roles' },
  { value: 'cycles', label: 'Months and holidays' },
  { value: 'enrollments', label: 'Opt-in changes' },
  { value: 'meals', label: 'Meals' },
  { value: 'settings', label: 'Settings' },
]
const LOOK: Record<Described['category'], { color: string; icon: typeof IconUsers }> = {
  people: { color: 'blue', icon: IconUsers },
  cycles: { color: 'teal', icon: IconCalendarEvent },
  enrollments: { color: 'grape', icon: IconUserCheck },
  meals: { color: 'orange', icon: IconToolsKitchen2 },
  settings: { color: 'gray', icon: IconSettings },
  other: { color: 'gray', icon: IconSettings },
}


function dayHeading(day: string, today: string) {
  if (day === today) return 'Today'
  return day === addDays(today, -1) ? 'Yesterday' : longDate(day)
}

function Entry({ e, tz }: { e: AuditEntry; tz: string }) {
  const d = describe(e, tz)
  const look = LOOK[d.category]
  const Icon = look.icon
  return (
    <div className={classes.entry}>
      <ThemeIcon variant="light" color={look.color} radius="xl" size={34}><Icon size={18} /></ThemeIcon>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text fw={600} size="sm">{d.title}</Text>
        <Text size="xs" c="dimmed">
          {formatMoment(e.at, tz, { hour: '2-digit', minute: '2-digit', hour12: false })} · by {e.actor_name}{e.actor_code ? ` (${e.actor_code})` : ''}
        </Text>
        {e.reason && <Text size="sm" className={classes.reason}>“{e.reason}”</Text>}
        {d.changes.length > 0 && (
          <div className={classes.changes}>
            {d.changes.map((c) => (
              <Text key={c.label} size="xs"><Text span c="dimmed">{c.label}: </Text><s className={classes.from}>{c.from}</s> → <b>{c.to}</b></Text>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Who changed what, when and why — newest first (US-025). */
export function AuditLog() {
  const tz = useTimeZone()
  const [category, setCategory] = useState<AuditCategory | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [dq] = useDebouncedValue(q, 300)
  const log = useAuditLogInfiniteQuery({ category, from: from || null, to: to || null, q: dq }, { refetchOnMountOrArgChange: true })

  const entries = log.data?.pages.flat() ?? []
  const today = todayIn(tz)
  const groups: { day: string; items: AuditEntry[] }[] = []
  for (const e of entries) {
    const day = dayOf(e.at, tz)
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] })
    groups.at(-1)!.items.push(e)
  }
  const filtered = !!(category || from || to || dq.trim())

  function exportCsv() {
    downloadCsv(`audit-log-${today}.csv`, [
      ['When', 'By', 'What happened', 'Changes', 'Reason'],
      ...entries.map((e) => {
        const d = describe(e, tz)
        return [
          formatMoment(e.at, tz, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
          e.actor_name + (e.actor_code ? ` (${e.actor_code})` : ''), d.title,
          d.changes.map((c) => `${c.label}: ${c.from} → ${c.to}`).join('; '), e.reason ?? '',
        ]
      }),
    ])
  }

  return (
    <Stack gap="md">
      <Group gap="sm" align="end" wrap="wrap">
        <TextInput label="Search" placeholder="Employee, Admin or reason" leftSection={<IconSearch size={16} />}
          value={q} onChange={(ev) => setQ(ev.currentTarget.value)} style={{ flex: 1, minWidth: 200 }} />
        <Select label="Type" placeholder="Everything" clearable w={{ base: '100%', xs: 210 }} data={CATEGORIES}
          value={category} onChange={(v) => setCategory(v as AuditCategory | null)} />
        <Group gap="sm" wrap="nowrap" w={{ base: '100%', xs: 'auto' }}>
          <TextInput label="From" type="date" value={from} max={to || today} onChange={(ev) => setFrom(ev.currentTarget.value)} style={{ flex: 1 }} />
          <TextInput label="To" type="date" value={to} min={from || undefined} max={today} onChange={(ev) => setTo(ev.currentTarget.value)} style={{ flex: 1 }} />
        </Group>
      </Group>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {log.isLoading ? 'Loading…' : `${entries.length}${log.hasNextPage ? '+' : ''} ${entries.length === 1 ? 'entry' : 'entries'}`}
          {filtered && <Button variant="subtle" size="compact-sm" ml="xs" onClick={() => { setCategory(null); setFrom(''); setTo(''); setQ('') }}>Clear filters</Button>}
        </Text>
        <Button variant="default" size="xs" leftSection={<IconDownload size={16} />} disabled={!entries.length} onClick={exportCsv}>CSV</Button>
      </Group>

      {log.error && <Alert color="red">{errorMessage(log.error)}</Alert>}
      {log.isLoading && <Loader />}
      {log.data && entries.length === 0 && <Card><Text c="dimmed" ta="center">{filtered ? 'Nothing matches these filters.' : 'No changes recorded yet.'}</Text></Card>}

      {groups.map((g) => (
        <div key={g.day}>
          <Group gap={8} mb={6}><Text size="sm" fw={700}>{dayHeading(g.day, today)}</Text><Badge size="sm" variant="light" color="gray">{g.items.length}</Badge></Group>
          <Card p={0}>{g.items.map((e) => <Entry key={e.id} e={e} tz={tz} />)}</Card>
        </div>
      ))}

      {log.hasNextPage && (
        <Button variant="default" loading={log.isFetchingNextPage} onClick={() => log.fetchNextPage()} style={{ alignSelf: 'center' }}>Load older entries</Button>
      )}
      <Text size="xs" c="dimmed" ta="center">Entries can’t be edited or deleted, not even by Admins.</Text>
    </Stack>
  )
}
