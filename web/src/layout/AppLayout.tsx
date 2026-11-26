import { AppShell, Avatar, Badge, Group, Menu, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconLogout, IconSwitchHorizontal, IconToolsKitchen2, IconUser } from '@tabler/icons-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useAuth } from '../features/auth/useAuth'
import { WORKSPACE_HOME, WORKSPACE_LABEL } from '../features/auth/roles'
import { NAV } from './nav'
import { useWorkspace } from './useWorkspace'
import classes from './AppLayout.module.css'
import { initials } from '../lib/format'

export function AppLayout() {
  const { profile, workspaces, signOut } = useAuth()
  const ws = useWorkspace(workspaces)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const desktop = useMediaQuery('(min-width: 62em)', true)
  const items = NAV[ws]

  if (!profile) return null

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'md', collapsed: { mobile: true } }}
      footer={{ height: 64, collapsed: desktop }}
      padding="md"
    >
      <AppShell.Header className={classes.header}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon size={30} radius="md"><IconToolsKitchen2 size={18} /></ThemeIcon>
            <Text fw={700}>Meal Portal</Text>
            <Badge variant="light" radius="xl">{WORKSPACE_LABEL[ws]}</Badge>
          </Group>

          <Menu position="bottom-end" width={240} shadow="md">
            <Menu.Target>
              <UnstyledButton aria-label="Account menu">
                <Avatar color="brand" radius="xl">{initials(profile.name)}</Avatar>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>
                {profile.name} · {profile.emp_code}
              </Menu.Label>
              {workspaces.length > 1 && workspaces.filter((w) => w !== ws).map((w) => (
                <Menu.Item key={w} leftSection={<IconSwitchHorizontal size={16} />} onClick={() => navigate(WORKSPACE_HOME[w])}>
                  Switch to {WORKSPACE_LABEL[w]}
                </Menu.Item>
              ))}
              <Menu.Item leftSection={<IconUser size={16} />} onClick={() => navigate('/account')}>Account</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={signOut}>Sign out</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={classes.sideLink}>
              <item.icon size={20} stroke={1.8} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        {/* key: moving to another screen clears a crash on the previous one */}
        <ErrorBoundary key={pathname}><Outlet /></ErrorBoundary>
      </AppShell.Main>

      <AppShell.Footer className={classes.tabbar}>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={classes.tab}>
            <item.icon size={24} stroke={1.8} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </AppShell.Footer>
    </AppShell>
  )
}
