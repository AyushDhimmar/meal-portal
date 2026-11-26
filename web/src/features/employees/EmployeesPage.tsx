import { useMemo, useState } from 'react'
import { Alert, Avatar, Badge, Button, Card, Chip, Group, Loader, Stack, Table, Text, TextInput, Title, UnstyledButton } from '@mantine/core'
import { IconPlus, IconSearch, IconUpload } from '@tabler/icons-react'
import { useAuth } from '../auth/useAuth'
import { initials } from '../../lib/format'
import { EmployeeForm } from './EmployeeForm'
import { ImportEmployeesModal } from './ImportEmployeesModal'
import { useEmployeesQuery, type EmployeeRow } from './api'
import classes from './EmployeesPage.module.css'

const FILTERS = ['All', 'Active', 'Inactive', 'Verifier', 'Admin'] as const
type Filter = (typeof FILTERS)[number]

function matches(e: EmployeeRow, f: Filter) {
  switch (f) {
    case 'Active': return e.status === 'active'
    case 'Inactive': return e.status === 'inactive'
    case 'Verifier': return e.user_roles.some((r) => r.role === 'verifier')
    case 'Admin': return e.user_roles.some((r) => r.role === 'admin')
    default: return true
  }
}

function RoleBadges({ e }: { e: EmployeeRow }) {
  return (
    <Group gap={4} wrap="nowrap">
      {e.user_roles.some((r) => r.role === 'admin') && <Badge variant="light">Admin</Badge>}
      {e.user_roles.some((r) => r.role === 'verifier') && <Badge variant="light" color="blue">Verifier</Badge>}
    </Group>
  )
}

function StatusBadge({ e }: { e: EmployeeRow }) {
  return e.status === 'active'
    ? <Badge variant="light" color="green">Active</Badge>
    : <Badge variant="light" color="red">Inactive</Badge>
}

export function EmployeesPage() {
  const { profile } = useAuth()
  const { data, isLoading, error } = useEmployeesQuery()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('All')
  // undefined = closed, null = adding, row = editing
  const [editing, setEditing] = useState<EmployeeRow | null | undefined>(undefined)
  const [importing, setImporting] = useState(false)

  const departments = useMemo(
    () => [...new Set((data ?? []).map((e) => e.department).filter((d): d is string => !!d))].sort(),
    [data],
  )
  const needle = q.trim().toLowerCase()
  const rows = (data ?? []).filter((e) => matches(e, filter) &&
    (!needle || e.name.toLowerCase().includes(needle) || e.emp_code.toLowerCase().includes(needle) || e.email.includes(needle)))

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Employees</Title>
          <Text c="dimmed" size="sm">{data ? `${data.length} in master list · ${data.filter((e) => e.status === 'active').length} active` : ' '}</Text>
        </div>
        <Group gap="xs">
          <Button variant="default" leftSection={<IconUpload size={18} />} onClick={() => setImporting(true)}>Import</Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing(null)}>Add employee</Button>
        </Group>
      </Group>

      <TextInput leftSection={<IconSearch size={18} />} placeholder="Search name, code or email" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
      <Chip.Group value={filter} onChange={(v) => setFilter(v as Filter)}>
        <Group gap="xs">{FILTERS.map((f) => <Chip key={f} value={f} variant="filled">{f}</Chip>)}</Group>
      </Chip.Group>

      {isLoading && <Loader />}
      {error && <Alert color="red">Could not load employees: {(error as Error).message}</Alert>}

      {data && rows.length === 0 && <Card><Text c="dimmed" ta="center">No employees match.</Text></Card>}

      {data && rows.length > 0 && (
        <>
          {/* Phones, tablets and narrow windows: tappable list */}
          <Card p={0} hiddenFrom="lg">
            {rows.map((e) => (
              <UnstyledButton key={e.id} className={classes.row} onClick={() => setEditing(e)}>
                <Avatar color="brand" radius="xl">{initials(e.name)}</Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={600} truncate>{e.name}</Text>
                  <Text size="xs" c="dimmed">{e.emp_code} · {e.department ?? 'No department'}</Text>
                </div>
                <Stack gap={4} align="end"><StatusBadge e={e} /><RoleBadges e={e} /></Stack>
              </UnstyledButton>
            ))}
          </Card>

          {/* Wide screens: table */}
          <Card p={0} visibleFrom="lg">
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
                <Table.Thead>
                  <Table.Tr><Table.Th>Code</Table.Th><Table.Th>Name</Table.Th><Table.Th>Email</Table.Th><Table.Th>Department</Table.Th><Table.Th>Roles</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((e) => (
                    <Table.Tr key={e.id} className={classes.clickable} onClick={() => setEditing(e)}>
                      <Table.Td fw={600}>{e.emp_code}</Table.Td>
                      <Table.Td>{e.name}</Table.Td>
                      <Table.Td c="dimmed">{e.email}</Table.Td>
                      <Table.Td>{e.department ?? '—'}</Table.Td>
                      <Table.Td><RoleBadges e={e} /></Table.Td>
                      <Table.Td><StatusBadge e={e} /></Table.Td>
                      <Table.Td><Button variant="subtle" size="xs">Edit</Button></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </>
      )}

      {editing !== undefined && profile && (
        <EmployeeForm employee={editing} departments={departments} selfId={profile.id} onClose={() => setEditing(undefined)} />
      )}
      {importing && <ImportEmployeesModal onClose={() => setImporting(false)} />}
    </Stack>
  )
}
