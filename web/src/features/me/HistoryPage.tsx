import { useState } from 'react'
import { Alert, Badge, Card, Chip, Group, Loader, ScrollArea, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { IconToolsKitchen2 } from '@tabler/icons-react'
import { errorMessage } from '../../lib/errors'
import { inr, monthLabel, parseYMD, WEEKDAYS_SHORT, weekdayOf, formatMoment } from '../../lib/dates'
import { useMyHistoryQuery, type DayKind } from './api'
import classes from './HistoryPage.module.css'

const KIND: Record<DayKind, { label: string; color: string }> = {
  served: { label: 'Served', color: 'green' },
  missed: { label: 'Not collected', color: 'red' },
  today: { label: 'Today', color: 'blue' },
  upcoming: { label: 'Upcoming', color: 'gray' },
  holiday: { label: 'Holiday', color: 'orange' },
  not_opted: { label: 'Not opted in', color: 'gray' },
}

export function HistoryPage() {
  const [cycleId, setCycleId] = useState<string | null>(null)   // null = latest month
  const { data, isLoading, error, isFetching } = useMyHistoryQuery(cycleId, { refetchOnMountOrArgChange: true })   // data keeps the previous month while the next loads
  const c = data?.cycle

  return (
    <Stack gap="md" maw={560} mx="auto">
      <div>
        <Title order={2}>Meal history</Title>
        <Text c="dimmed" size="sm">Your lunches and monthly bill</Text>
      </div>

      {isLoading && <Loader />}
      {error && <Alert color="red">{errorMessage(error)}</Alert>}
      {data && !c && <Card><Text c="dimmed" ta="center">No lunch months yet.</Text></Card>}

      {data && c && (
        <>
          {data.months.length > 1 && (
            <ScrollArea type="never" offsetScrollbars={false}>
              <Chip.Group value={c.cycle_id} onChange={(v) => setCycleId(v as string)}>
                <Group gap="xs" wrap="nowrap">
                  {data.months.map((m) => (
                    <Chip key={m.cycle_id} value={m.cycle_id} variant="filled">{monthLabel(m.month).slice(0, 3)} {parseYMD(m.month).y}</Chip>
                  ))}
                </Group>
              </Chip.Group>
            </ScrollArea>
          )}

          <Card style={{ opacity: isFetching ? 0.6 : 1 }}>
            <Text fw={700} mb="sm">{monthLabel(c.month)}</Text>
            <SimpleGrid cols={3} spacing="xs">
              <div className={classes.stat}><Text fz={22} fw={700}>{c.opted_days}</Text><Text size="xs" c="dimmed">Opted days</Text></div>
              <div className={classes.stat}><Text fz={22} fw={700}>{c.consumed_days}</Text><Text size="xs" c="dimmed">Eaten</Text></div>
              <div className={classes.stat}><Text fz={22} fw={700}>{inr(c.payable_paise)}</Text><Text size="xs" c="dimmed">Payable</Text></div>
            </SimpleGrid>
            <Text size="xs" c="dimmed" mt="sm">
              {!c.opted_in && c.consumed_days === 0 ? `You didn’t opt in for ${monthLabel(c.month)}.`
                : c.billing_basis === 'opted' ? `${c.opted_days} opted days × ${inr(c.price_paise)} · billed on opted days, holidays excluded`
                : `${c.consumed_days} meals × ${inr(c.price_paise)} · billed on meals eaten`}
              {c.status !== 'locked' && ' · not final until the month is locked'}
            </Text>
          </Card>

          <Card p={0}>
            <Text fw={600} px="md" pt="md" pb={4}>Daily log</Text>
            {c.opted_in || data.days.some((d) => d.kind === 'served') ? (
              data.days.map((d) => {
                const p = parseYMD(d.day)
                const k = KIND[d.kind]
                return (
                  <div key={d.day} className={classes.row} data-dim={d.kind === 'upcoming' || d.kind === 'not_opted' || undefined}>
                    <div className={classes.date}>
                      <Text fw={700} fz={18} lh={1.1}>{p.d}</Text>
                      <Text size="xs" c="dimmed">{WEEKDAYS_SHORT[weekdayOf(p.y, p.m, p.d)]}</Text>
                    </div>
                    <Text style={{ flex: 1 }} fw={500}>
                      {d.kind === 'served' && d.served_at ? formatMoment(d.served_at, data.tz, { hour: 'numeric', minute: '2-digit' }) : ''}
                    </Text>
                    <Badge color={k.color} variant="light">{k.label}</Badge>
                  </div>
                )
              })
            ) : (
              <Stack align="center" gap={6} py="xl" c="dimmed">
                <IconToolsKitchen2 size={28} />
                <Text size="sm">No lunches: you were opted out in {monthLabel(c.month)}.</Text>
              </Stack>
            )}
          </Card>
        </>
      )}
    </Stack>
  )
}
