import { Button, Center, Loader, Stack, Text, Title } from '@mantine/core'
import { errorMessage } from '../lib/errors'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { WORKSPACE_HOME, workspaceOfPath } from '../features/auth/roles'
import { AppLayout } from '../layout/AppLayout'
import { AccountPage } from '../features/auth/AccountPage'
import { LoginPage } from '../features/auth/LoginPage'
import { NotOnListPage } from '../features/auth/NotOnListPage'
import { EmployeeHome } from '../features/me/EmployeeHome'
import { MyCodePage } from '../features/me/MyCodePage'
import { HistoryPage } from '../features/me/HistoryPage'
import { CounterPage } from '../features/counter/CounterPage'
import { TodayPage } from '../features/counter/TodayPage'
import { EmployeesPage } from '../features/employees/EmployeesPage'
import { CyclesPage } from '../features/cycles/CyclesPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ReportsPage } from '../features/reports/ReportsPage'
import { FallbackPrintPage } from '../features/dashboard/FallbackPrintPage'

function ServerUnreachable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Center mih="100vh" p="md">
      <Stack align="center" maw={380} ta="center">
        <Title order={3}>Can’t load your profile</Title>
        <Text c="dimmed" size="sm">{errorMessage(error)}</Text>
        <Button onClick={onRetry}>Try again</Button>
      </Stack>
    </Center>
  )
}

function FullPageLoader() {
  return <Center mih="100vh"><Loader /></Center>
}

/** Signed in + on the employee list + allowed into this part of the app (Admin, Verifier, Employee). */
function Protected({ children }: { children: ReactNode }) {
  const { user, profile, loading, workspaces, profileError, retry } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (profileError) return <ServerUnreachable error={profileError} onRetry={retry} />
  if (!profile) return <NotOnListPage />
  if (pathname !== '/account' && !workspaces.includes(workspaceOfPath(pathname))) {
    return <Navigate to={WORKSPACE_HOME[workspaces[0]]} replace />   // e.g. an Employee opening /admin
  }
  return <>{children}</>
}

function Home() {
  const { workspaces } = useAuth()
  return <Navigate to={WORKSPACE_HOME[workspaces[0] ?? 'employee']} replace />
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  return user ? <Navigate to="/" replace /> : <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route index element={<Home />} />
        {/* Employee */}
        <Route path="me" element={<EmployeeHome />} />
        <Route path="me/history" element={<HistoryPage />} />
        <Route path="me/code" element={<MyCodePage />} />
        {/* Verifier */}
        <Route path="counter" element={<CounterPage />} />
        <Route path="counter/today" element={<TodayPage />} />
        {/* Admin */}
        <Route path="admin" element={<DashboardPage />} />
        <Route path="admin/cycles" element={<CyclesPage />} />
        <Route path="admin/employees" element={<EmployeesPage />} />
        <Route path="admin/reports" element={<ReportsPage />} />
        {/* Everyone */}
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="/admin/print/fallback" element={<Protected><FallbackPrintPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
