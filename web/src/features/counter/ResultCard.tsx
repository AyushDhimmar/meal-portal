import { Avatar, Button, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconAlertTriangle, IconCheck, IconScan, IconToolsKitchen2, IconX } from '@tabler/icons-react'
import { initials } from '../../lib/format'
import type { VerifyResult } from './api'
import classes from './CounterPage.module.css'

const time = (iso?: string) => iso ? new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : ''

/** Big, colour-coded outcome of one verification (US-016) with the person's details (US-017). */
export function ResultCard({ r, onServe, serving, onNext }: { r: VerifyResult | null; onServe: () => void; serving: boolean; onNext: () => void }) {
  if (!r) {
    return (
      <div className={classes.result} data-tone="idle">
        <ThemeIcon size={56} radius="xl" variant="light" color="gray"><IconScan size={30} /></ThemeIcon>
        <Text fw={600} mt="sm">Ready for the next person</Text>
        <Text size="sm" c="dimmed">Type the 4 digits, scan, or search by name</Text>
      </div>
    )
  }
  const first = r.employee?.name.split(' ')[0] ?? ''
  const view: Record<VerifyResult['result'], { tone: 'ok' | 'bad' | 'warn'; title: string; detail: string }> = {
    SERVED: { tone: 'ok', title: 'Served', detail: `Recorded at ${time(r.served_at)}` },
    ELIGIBLE: { tone: 'ok', title: 'Eligible', detail: 'Opted in · no meal yet today' },
    ALREADY_SERVED: { tone: 'bad', title: 'Already served', detail: `${first} had lunch at ${time(r.served_at)}. One meal per day.` },
    NOT_OPTED_IN: { tone: 'bad', title: 'Not opted in', detail: `${first} didn’t opt in for this month.` },
    INACTIVE: { tone: 'bad', title: 'Not eligible', detail: 'This employee is marked inactive.' },
    NOT_FOUND: { tone: 'bad', title: 'Code not recognised', detail: `No employee with code ${r.code ?? ''}. Check the code or search by name.` },
    NOT_LUNCH_DAY: { tone: 'warn', title: 'No lunch today', detail: 'Today is not a lunch day in this month’s cycle.' },
    OUTSIDE_SERVING_WINDOW: { tone: 'warn', title: 'Outside serving hours', detail: 'Meals can only be served during the serving window.' },
  }
  const v = view[r.result]
  const Icon = v.tone === 'ok' ? IconCheck : v.tone === 'warn' ? IconAlertTriangle : IconX
  return (
    <div className={classes.result} data-tone={v.tone} role="status" aria-live="assertive">
      <Group wrap="nowrap" w="100%">
        <ThemeIcon size={60} radius="xl" color={v.tone === 'ok' ? 'green' : v.tone === 'warn' ? 'orange' : 'red'}><Icon size={34} /></ThemeIcon>
        <div style={{ minWidth: 0 }}>
          <Text fz={28} fw={800} lh={1.1} className={classes.resultTitle}>{v.title}</Text>
          <Text size="sm">{v.detail}</Text>
        </div>
      </Group>
      {r.employee && (
        <Group wrap="nowrap" w="100%" mt="md" className={classes.person}>
          <Avatar size={52} radius="xl" color="brand">{initials(r.employee.name)}</Avatar>
          <div style={{ minWidth: 0 }}>
            <Text fw={700} fz={20} truncate>{r.employee.name}</Text>
            <Text c="dimmed">{r.employee.emp_code}{r.employee.department ? ` · ${r.employee.department}` : ''}</Text>
          </div>
        </Group>
      )}
      <Stack w="100%" gap="xs" mt="auto" pt="md">
        {r.result === 'ELIGIBLE' && (
          <Button size="xl" h={64} fullWidth leftSection={<IconToolsKitchen2 size={24} />} loading={serving} onClick={onServe}>Mark served</Button>
        )}
        <Button size="lg" variant="default" fullWidth onClick={onNext}>Next person</Button>
      </Stack>
    </div>
  )
}
