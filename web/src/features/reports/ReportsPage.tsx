import { useMemo, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { Alert, Badge, Button, Card, Group, Loader, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core'
import { IconAlertTriangle, IconDownload, IconFileSpreadsheet, IconSearch } from '@tabler/icons-react'
import { inr, monthLabel, todayIn } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { downloadCsv } from '../../lib/download'
import { downloadXlsx } from '../../lib/excel'
import { useCyclesQuery } from '../cycles/api'
import { useMonthlyBillQuery, type BillRow } from './api'
import classes from './ReportsPage.module.css'

type Sort = 'name' | 'code' | 'payable'
const missed = (r: BillRow) => Math.max(0, r.opted_days_to_date - r.consumed_days)
const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`
const rupees = (paise: number) => Math.round(paise) / 100

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <Card padding="md"><Text size="sm" c="dimmed">{label}</Text><Text fz={26} fw={700} lh={1.2}>{value}</Text>{hint && <Text size="xs" c="dimmed">{hint}</Text>}</Card>
}

/** Monthly bill per employee with filters and Excel/CSV export (US-028, US-026, US-029). */
export function ReportsPage() {
  const cycles = useCyclesQuery()
  const months = (cycles.data ?? []).filter((c) => c.status !== 'draft')
  const [picked, setPicked] = useState<string | null>(null)
  // default: the latest month that has started (or the newest non-draft one)
  const [now] = useState(() => todayIn().slice(0, 7))
  const cycle = months.find((c) => c.id === picked) ?? months.find((c) => c.month.slice(0, 7) <= now) ?? months[0]
  const bill = useMonthlyBillQuery(cycle?.id ?? skipToken, { refetchOnMountOrArgChange: true })

  const [dept, setDept] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [everyone, setEveryone] = useState(false)

  const all = useMemo(() => bill.data ?? [], [bill.data])
  const departments = useMemo(() => [...new Set(all.map((r) => r.department).filter((d): d is string => !!d))].sort(), [all])
  const needle = q.trim().toLowerCase()
  const rows = all
    .filter((r) => everyone || r.payable_paise > 0 || r.consumed_days > 0)
    .filter((r) => !dept || r.department === dept)
    .filter((r) => !needle || r.name.toLowerCase().includes(needle) || r.emp_code.toLowerCase().includes(needle))
    .sort((a, b) => sort === 'payable' ? b.payable_paise - a.payable_paise : sort === 'code' ? a.emp_code.localeCompare(b.emp_code) : a.name.localeCompare(b.name))

  const t = rows.reduce((s, r) => ({ opted: s.opted + r.opted_days, eaten: s.eaten + r.consumed_days, missed: s.missed + missed(r), pay: s.pay + r.payable_paise, billed: s.billed + (r.payable_paise > 0 ? 1 : 0) }),
    { opted: 0, eaten: 0, missed: 0, pay: 0, billed: 0 })
  const final = cycle?.status === 'locked'
  const fileBase = cycle ? `meal-report-${cycle.month.slice(0, 7)}${dept ? '-' + dept.toLowerCase().replace(/\W+/g, '-') : ''}` : 'meal-report'

  const header = ['Employee code', 'Name', 'Department', 'Status', 'Opted days', 'Meals eaten', 'Not collected so far', 'Price per meal (₹)', 'Payable (₹)']
  const toRow = (r: BillRow) => [r.emp_code, r.name, r.department ?? '', r.status, r.opted_days, r.consumed_days, missed(r), rupees(r.price_paise), rupees(r.payable_paise)]
  const totalRow = ['TOTAL', people(rows.length), '', '', t.opted, t.eaten, t.missed, null, rupees(t.pay)]

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Monthly report</Title>
          <Text c="dimmed" size="sm">Opted days, meals eaten and amount payable per employee</Text>
        </div>
        <Group gap="xs">
          <Button variant="default" leftSection={<IconDownload size={18} />} disabled={!rows.length}
            onClick={() => downloadCsv(`${fileBase}.csv`, [header, ...rows.map(toRow), totalRow])}>CSV</Button>
          <Button leftSection={<IconFileSpreadsheet size={18} />} disabled={!rows.length}
            onClick={() => downloadXlsx(`${fileBase}.xlsx`, header, [...rows.map(toRow), totalRow], [14, 26, 18, 10, 11, 12, 13, 16, 13], cycle ? monthLabel(cycle.month) : 'Report')}>Excel</Button>
        </Group>
      </Group>

      {cycles.isLoading && <Loader />}
      {cycles.data && months.length === 0 && <Card><Text c="dimmed" ta="center">No lunch months yet. Open a cycle first.</Text></Card>}

      {cycle && (
        <>
          <Group gap="sm" align="end" wrap="wrap">
            <Select label="Month" w={{ base: '100%', sm: 250 }} allowDeselect={false} value={cycle.id} onChange={setPicked}
              data={months.map((c) => ({ value: c.id, label: `${monthLabel(c.month)}${c.status === 'locked' ? '' : ' · ' + c.status}` }))} />
            <Select label="Department" w={{ base: '100%', sm: 210 }} clearable placeholder="All departments" data={departments} value={dept} onChange={setDept} />
            <TextInput label="Employee" placeholder="Name or code" leftSection={<IconSearch size={16} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} style={{ flex: 1, minWidth: 180 }} />
            <Select label="Sort by" w={150} allowDeselect={false} value={sort} onChange={(v) => setSort(v as Sort)}
              data={[{ value: 'name', label: 'Name' }, { value: 'code', label: 'Code' }, { value: 'payable', label: 'Amount' }]} />
          </Group>

          {!final && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
              {monthLabel(cycle.month)} is <b>{cycle.status}</b>, so these numbers can still change. Lock the month on the Cycles page before sending it to Finance.
            </Alert>
          )}
          {bill.error && <Alert color="red">{errorMessage(bill.error)}</Alert>}

          <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
            <Kpi label="People billed" value={t.billed} />
            <Kpi label="Opted meal-days" value={t.opted} />
            <Kpi label="Meals eaten" value={t.eaten} hint={t.opted ? `${Math.round((t.eaten / t.opted) * 100)}% of opted` : undefined} />
            <Kpi label="Not collected so far" value={t.missed} hint="Past lunch days only" />
            <Kpi label="Total payable" value={inr(t.pay)} hint={`${inr(cycle.price_paise)} per meal · billed on ${all[0]?.billing_basis === 'consumed' ? 'meals eaten' : 'opted days'}`} />
          </SimpleGrid>

          <Switch label="Include people with nothing to bill" checked={everyone} onChange={(e) => setEveryone(e.currentTarget.checked)} />

          {bill.isLoading && <Loader />}
          {bill.data && rows.length === 0 && <Card><Text c="dimmed" ta="center">Nobody to show for these filters.</Text></Card>}

          {rows.length > 0 && (
            <>
              <Card p={0} hiddenFrom="lg">
                {rows.map((r) => (
                  <div key={r.employee_id} className={classes.row}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={600} truncate>{r.name}</Text>
                      <Text size="xs" c="dimmed">{r.emp_code} · {r.opted_days} opted · {r.consumed_days} eaten · {missed(r)} missed</Text>
                    </div>
                    <Text fw={700}>{inr(r.payable_paise)}</Text>
                  </div>
                ))}
                <div className={classes.row} data-total><Text fw={700} style={{ flex: 1 }}>Total · {people(rows.length)}</Text><Text fw={800}>{inr(t.pay)}</Text></div>
              </Card>

              <Card p={0} visibleFrom="lg">
                <Table.ScrollContainer minWidth={760}>
                  <Table verticalSpacing="sm" horizontalSpacing="md" striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Code</Table.Th><Table.Th>Employee</Table.Th><Table.Th>Department</Table.Th>
                        <Table.Th ta="right">Opted days</Table.Th><Table.Th ta="right">Eaten</Table.Th><Table.Th ta="right">Not collected</Table.Th><Table.Th ta="right">Payable</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.map((r) => (
                        <Table.Tr key={r.employee_id}>
                          <Table.Td fw={600}>{r.emp_code}</Table.Td>
                          <Table.Td>{r.name}{r.status === 'inactive' && <Badge ml={6} size="xs" color="red" variant="light">Inactive</Badge>}</Table.Td>
                          <Table.Td c="dimmed">{r.department ?? '—'}</Table.Td>
                          <Table.Td ta="right" className={classes.num}>{r.opted_days}</Table.Td>
                          <Table.Td ta="right" className={classes.num}>{r.consumed_days}</Table.Td>
                          <Table.Td ta="right" className={classes.num}>{missed(r)}</Table.Td>
                          <Table.Td ta="right" className={classes.num} fw={700}>{inr(r.payable_paise)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                    <Table.Tfoot>
                      <Table.Tr className={classes.totals}>
                        <Table.Td fw={700} colSpan={3}>Total · {people(rows.length)}</Table.Td>
                        <Table.Td ta="right" fw={700} className={classes.num}>{t.opted}</Table.Td>
                        <Table.Td ta="right" fw={700} className={classes.num}>{t.eaten}</Table.Td>
                        <Table.Td ta="right" fw={700} className={classes.num}>{t.missed}</Table.Td>
                        <Table.Td ta="right" fw={800} className={classes.num}>{inr(t.pay)}</Table.Td>
                      </Table.Tr>
                    </Table.Tfoot>
                  </Table>
                </Table.ScrollContainer>
              </Card>
            </>
          )}
          <Text size="xs" c="dimmed">No payroll integration: download the file and share it with Finance.</Text>
        </>
      )}
    </Stack>
  )
}
