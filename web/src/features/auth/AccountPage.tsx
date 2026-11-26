import { Avatar, Badge, Button, Card, Group, Stack, Table, Text, Title } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { useAuth } from './useAuth'
import { WORKSPACE_HOME, WORKSPACE_LABEL } from './roles'
import { initials } from '../../lib/format'

export function AccountPage() {
  const { profile, workspaces, signOut } = useAuth()
  const navigate = useNavigate()
  if (!profile) return null
  return (
    <Stack gap="md" maw={560}>
      <Title order={2}>Account</Title>
      <Card>
        <Group>
          <Avatar size="lg" radius="xl" color="brand">{initials(profile.name)}</Avatar>
          <div>
            <Text fw={700} size="lg">{profile.name}</Text>
            <Text c="dimmed" size="sm">{profile.email}</Text>
          </div>
        </Group>
      </Card>
      <Card>
        <Table>
          <Table.Tbody>
            <Table.Tr><Table.Td c="dimmed">Employee code</Table.Td><Table.Td fw={600}>{profile.emp_code}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td c="dimmed">Department</Table.Td><Table.Td fw={600}>{profile.department ?? '—'}</Table.Td></Table.Tr>
            <Table.Tr>
              <Table.Td c="dimmed">Roles</Table.Td>
              <Table.Td><Group gap={6}>{workspaces.map((w) => <Badge key={w} variant="light">{WORKSPACE_LABEL[w]}</Badge>)}</Group></Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>
      {workspaces.length > 1 && (
        <Card>
          <Text fw={600} mb="sm">Switch workspace</Text>
          <Group>
            {workspaces.map((w) => (
              <Button key={w} variant="light" onClick={() => navigate(WORKSPACE_HOME[w])}>{WORKSPACE_LABEL[w]}</Button>
            ))}
          </Group>
        </Card>
      )}
      <Button variant="default" color="red" leftSection={<IconLogout size={18} />} onClick={signOut}>Sign out</Button>
    </Stack>
  )
}
