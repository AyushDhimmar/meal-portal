import { useState } from 'react'
import { ActionIcon, Alert, Badge, Button, Card, Group, Loader, Modal, SimpleGrid, Stack, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconChevronRight, IconClock, IconLock, IconQrcode, IconRefresh, IconToolsKitchen2 } from '@tabler/icons-react'
import { Link } from 'react-router'
import { useNow } from '../../hooks/useNow'
import { useAuth } from '../auth/useAuth'
import { LunchCalendar } from '../../components/LunchCalendar'
import { errorMessage } from '../../lib/errors'
import { inr, monthLabel, formatMoment, hhmm, timeLeft } from '../../lib/dates'
import { useMyHomeQuery, useSetMyEnrollmentMutation, type MyHome } from './api'
import classes from './EmployeeHome.module.css'

function Stat({ value, label, onDark }: { value: string | number; label: string; onDark?: boolean }) {
  return (
    <div className={onDark ? classes.statDark : classes.stat}>
      <Text fz={22} fw={700} lh={1.2}>{value}</Text>
      <Text size="xs" fw={500} className={classes.statLabel}>{label}</Text>
    </div>
  )
}

function TodayCard({ today }: { today: MyHome['today'] }) {
  if (!today.is_lunch_day || !today.opted_in) return null
  const served = !!today.served_at
  return (
    <Card>
      <Group wrap="nowrap">
        <ThemeIcon size={40} radius="md" color={served ? 'green' : 'brand'}>{served ? <IconCheck size={22} /> : <IconToolsKitchen2 size={22} />}</ThemeIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600}>{served ? 'Lunch served today' : 'Lunch today'}</Text>
          <Text size="sm" c="dimmed">{served ? 'Enjoy your meal!' : `${hhmm(today.serve_start ?? '12:30')}–${hhmm(today.serve_end ?? '14:30')} · show your code`}</Text>
        </div>
        {!served && <Button component={Link} to="/me/code" size="sm" leftSection={<IconQrcode size={16} />}>Code</Button>}
      </Group>
    </Card>
  )
}

function NextCycleCard({ next, tz }: { next: NonNullable<MyHome['next']>; tz: string }) {
  const [setChoice] = useSetMyEnrollmentMutation()
  const [confirm, setConfirm] = useState<boolean | null>(null)   // the choice being confirmed
  const [showCal, setShowCal] = useState(false)
  const estimate = next.lunch_days * next.price_paise
  const now = useNow()
  const notYet = new Date(next.optin_opens_at).getTime() > now
  const left = timeLeft(next.optin_closes_at, now)
  const closeText = formatMoment(next.optin_closes_at, tz, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

  // After Confirm the card changes at once (see setMyEnrollment); if the server refuses
  // (e.g. the cut-off passed a moment ago) it changes back and says why
  const [saving, setSaving] = useState(false)
  async function save(optedIn: boolean) {
    setConfirm(null)
    setSaving(true)
    try {
      await setChoice({ cycleId: next.cycle_id, optedIn }).unwrap()
      notifications.show({ color: 'green', icon: <IconCheck size={18} />,
        message: optedIn ? `You’re opted in for ${monthLabel(next.month)}` : `You’ve opted out of ${monthLabel(next.month)}` })
    } catch (e) {
      notifications.show({ color: 'red', icon: <IconAlertCircle size={18} />, message: `Not saved: ${errorMessage(e)}` })
    } finally {
      setSaving(false)
    }
  }

  const statusBadge = next.opted_in === true ? <Badge color="green" variant="light" size="lg">Opted in</Badge>
    : next.opted_in === false ? <Badge color="gray" variant="light" size="lg">Opted out</Badge>
    : <Badge color="orange" variant="light" size="lg">Not decided</Badge>

  return (
    <Card>
      <Group justify="space-between" wrap="nowrap" align="start">
        <div>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.05em' }}>Next month</Text>
          <Title order={3}>{monthLabel(next.month)}</Title>
        </div>
        <div style={{ flexShrink: 0 }}>{statusBadge}</div>
      </Group>

      <SimpleGrid cols={3} spacing="xs" mt="md">
        <Stat value={next.lunch_days} label="Lunch days" />
        <Stat value={inr(next.price_paise)} label="Per meal" />
        <Stat value={inr(estimate)} label="If opted in" />
      </SimpleGrid>

      {next.can_change ? (
        <Alert mt="md" color="blue" variant="light" icon={<IconClock size={18} />}>
          Opt-in closes <b>{closeText}</b>{left ? ` (${left})` : ''}
        </Alert>
      ) : notYet ? (
        <Alert mt="md" color="gray" variant="light" icon={<IconClock size={18} />}>
          Opt-in opens {formatMoment(next.optin_opens_at, tz, { weekday: 'short', day: 'numeric', month: 'short' })}
        </Alert>
      ) : (
        <Alert mt="md" color="orange" variant="light" icon={<IconLock size={18} />}>
          <b>Opt-in closed {formatMoment(next.optin_closes_at, tz, { day: 'numeric', month: 'short' })}.</b> Ask an Admin if you need a change.
        </Alert>
      )}
      {next.source === 'admin_override' && <Text size="xs" c="dimmed" mt={6}>Your choice was last set by an Admin.</Text>}

      <SimpleGrid cols={2} spacing="sm" mt="md">
        {[true, false].map((v) => {
          const selected = next.opted_in === v
          return (
            <UnstyledButton key={String(v)} className={classes.option} data-selected={selected || undefined} data-out={!v || undefined}
              disabled={!next.can_change || saving} onClick={() => !selected && setConfirm(v)}>
              <Group justify="space-between" wrap="nowrap"><Text fw={700}>{v ? 'Opt in' : 'Opt out'}</Text>{selected && <IconCheck size={18} />}</Group>
              <Text size="xs" c="dimmed" mt={4}>{v ? 'Lunch on every lunch day' : 'No lunch, no charge'}</Text>
            </UnstyledButton>
          )
        })}
      </SimpleGrid>

      <Button variant="subtle" fullWidth mt="xs" rightSection={<IconChevronRight size={16} />} onClick={() => setShowCal(true)}>View lunch calendar</Button>

      {confirm !== null && (
        <Modal opened onClose={() => setConfirm(null)} centered
          title={<Text fw={700}>{confirm ? `Opt in for ${monthLabel(next.month)}?` : `Opt out of ${monthLabel(next.month)}?`}</Text>}>
          <Stack>
            <Text size="sm">
              {confirm
                ? <>You’ll be billed <b>{inr(estimate)}</b> for {next.lunch_days} lunch days ({inr(next.price_paise)} each), deducted at month end.</>
                : <>You won’t get subsidised lunch in {monthLabel(next.month)}. You can change this until {closeText}.</>}
            </Text>
            <Button size="lg" fullWidth color={confirm ? undefined : 'gray'} onClick={() => save(confirm)}>
              {confirm ? 'Confirm opt in' : 'Confirm opt out'}
            </Button>
            <Button variant="subtle" onClick={() => setConfirm(null)}>Cancel</Button>
          </Stack>
        </Modal>
      )}
      {showCal && (
        <Modal opened onClose={() => setShowCal(false)} centered title={<Text fw={700}>{monthLabel(next.month)} lunch calendar</Text>}>
          <LunchCalendar month={next.month} weekdays={next.weekdays} holidays={next.holidays} />
          <Text size="sm" mt="md"><b>{next.lunch_days}</b> lunch days · serving {hhmm(next.serve_start)}–{hhmm(next.serve_end)}</Text>
        </Modal>
      )}
    </Card>
  )
}

function ThisMonthCard({ current }: { current: NonNullable<MyHome['current']> }) {
  return (
    <Card className={classes.hero}>
      <Group justify="space-between">
        <div>
          <Text size="sm" className={classes.heroMuted}>This month</Text>
          <Title order={3} c="white">{monthLabel(current.month)}</Title>
        </div>
        <Button component={Link} to="/me/history" size="sm" variant="white" color="brand" rightSection={<IconChevronRight size={16} />}>History</Button>
      </Group>
      <SimpleGrid cols={3} spacing="xs" mt="md">
        <Stat onDark value={current.opted_days} label="Opted days" />
        <Stat onDark value={current.consumed_days} label="Eaten" />
        <Stat onDark value={inr(current.payable_paise)} label="Payable" />
      </SimpleGrid>
    </Card>
  )
}

export function EmployeeHome() {
  const { profile } = useAuth()
  // No automatic refresh: fresh data each time the screen is opened, or when the refresh button is tapped
  const { data, isLoading, isFetching, error, refetch } = useMyHomeQuery(undefined, { refetchOnMountOrArgChange: true })
  if (!profile) return null
  return (
    <Stack gap="md" maw={560} mx="auto">
      <Group justify="space-between" align="end">
        <div>
          <Text c="dimmed">Welcome,</Text>
          <Title order={2}>{profile.name.split(' ')[0]}</Title>
        </div>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Refresh" loading={isFetching && !isLoading} onClick={() => refetch()}>
          <IconRefresh size={20} />
        </ActionIcon>
      </Group>
      {isLoading && <Loader />}
      {error && <Alert color="red">{errorMessage(error)}</Alert>}
      {data && (
        <>
          <TodayCard today={data.today} />
          {data.next
            ? <NextCycleCard next={data.next} tz={data.tz} />
            : <Card><Text fw={600}>Next month isn’t open for opt-in yet</Text><Text size="sm" c="dimmed">You’ll be able to choose here once an Admin opens it, usually from the 15th.</Text></Card>}
          {data.current && <ThisMonthCard current={data.current} />}
        </>
      )}
    </Stack>
  )
}
