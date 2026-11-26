import { Badge, Card, Center, Stack, Text, Title } from '@mantine/core'
import { useAuth } from '../auth/useAuth'
import { Barcode, QrCode } from '../../components/CodeImages'
import { useWakeLock } from '../../hooks/useWakeLock'
import { formatMoment } from '../../lib/dates'
import { useMyHomeQuery } from './api'

function TodayBadge() {
  const { data } = useMyHomeQuery()
  if (!data) return null
  const t = data.today
  if (t.served_at) return <Badge color="green" variant="light" size="lg">Served today at {formatMoment(t.served_at, data.tz, { hour: 'numeric', minute: '2-digit' })}</Badge>
  if (!t.is_lunch_day) return <Badge color="gray" variant="light" size="lg">No lunch today</Badge>
  if (!t.opted_in) return <Badge color="gray" variant="light" size="lg">Not opted in this month</Badge>
  return <Badge color="green" variant="light" size="lg">Eligible for lunch today</Badge>
}

export function MyCodePage() {
  const { profile, offline } = useAuth()
  useWakeLock()
  if (!profile) return null
  return (
    <Stack gap="md" maw={420} mx="auto">
      <div>
        <Title order={2}>My lunch code</Title>
        <Text c="dimmed" size="sm">Show this at the counter</Text>
      </div>
      <Card ta="center" py="xl">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.08em' }}>Employee code</Text>
        <Text fz={38} fw={800} style={{ letterSpacing: '0.06em' }} mb="md">{profile.emp_code}</Text>
        <Center>
          <div style={{ padding: 12, border: '1px solid var(--mantine-color-gray-3)', borderRadius: 16, background: '#fff' }}>
            <QrCode value={profile.emp_code} size={200} />
          </div>
        </Center>
        <Center mt="lg"><Barcode value={profile.emp_code} height={64} /></Center>
        <Text fw={600} mt="lg">{profile.name}</Text>
        <Text size="sm" c="dimmed" mb="md">{profile.department}</Text>
        <Center>{offline ? <Badge color="orange" variant="light" size="lg">Offline · saved code</Badge> : <TodayBadge />}</Center>
      </Card>
      <Text size="xs" c="dimmed" ta="center">Turn your screen brightness up for faster scanning. The screen stays on while this page is open.</Text>
    </Stack>
  )
}
