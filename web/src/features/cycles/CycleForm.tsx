import { Alert, Button, Group, Modal, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { errorMessage } from '../../lib/errors'
import { addMonths, firstOfThisMonth, hhmm, inr, lunchDays, monthLabel, parseYMD, toYMD } from '../../lib/dates'
import { toPaise } from '../../lib/schemas'
import { useCycleDefaultsQuery, useSaveCycleMutation, type CycleDefaults, type CycleRow } from './api'
import { cycleSchema, type CycleFormValues } from './schema'
import { WeekdayChips } from './WeekdayChips'

const FALLBACK: CycleDefaults = {
  weekdays: [1, 2, 3, 4], price_paise: 5000, optin_open_day: 15, optin_close_day: 25,
  serve_start: '12:30', serve_end: '14:30', enforce_serving_window: false, billing_basis: 'opted',
}

/** Opt-in window in the month before `month`, on the default days (clamped to that month's length). */
function defaultWindow(month: string, openDay: number, closeDay: number) {
  const prev = parseYMD(addMonths(month, -1))
  const last = new Date(Date.UTC(prev.y, prev.m, 0)).getUTCDate()
  return { open: toYMD(prev.y, prev.m, Math.min(openDay, last)), close: toYMD(prev.y, prev.m, Math.min(closeDay, last)) }
}

/** Same day number n months later, clamped to the month's length (31 Jan + 1 → 28/29 Feb). */
function shiftDate(day: string, n: number) {
  const { d } = parseYMD(day)
  const t = parseYMD(addMonths(day, n))
  return toYMD(t.y, t.m, Math.min(d, new Date(Date.UTC(t.y, t.m, 0)).getUTCDate()))
}

type Props = { cycle: CycleRow | null; existing: CycleRow[]; onClose: () => void }

/** Wrapper: waits for the defaults (More → Settings) so a new month starts from them. */
export function CycleForm(props: Props) {
  // always re-read: Settings may have changed since this screen opened
  const defaults = useCycleDefaultsQuery(undefined, { refetchOnMountOrArgChange: true })
  if (props.cycle === null && defaults.isFetching && !defaults.data) return null
  return <CycleFormInner {...props} defaults={{ ...FALLBACK, ...(defaults.data ?? {}) }} />
}

function CycleFormInner({ cycle, existing, onClose, defaults: d }: Props & { defaults: CycleDefaults }) {
  const isNew = cycle === null
  const mobile = useMediaQuery('(max-width: 48em)')
  const [save, saving] = useSaveCycleMutation()

  const taken = new Set(existing.filter((c) => c.id !== cycle?.id).map((c) => c.month.slice(0, 10)))
  const monthOptions: { value: string; label: string }[] = []
  for (let i = 0; i < 13; i++) {
    const m = addMonths(firstOfThisMonth(), i)
    if (!taken.has(m)) monthOptions.push({ value: m, label: monthLabel(m) })
  }
  // Suggest the first free month after the latest cycle; with no cycles, next month (this one has already started)
  const after = existing[0]?.month.slice(0, 10) ?? firstOfThisMonth()
  const startMonth = cycle?.month.slice(0, 10) ?? monthOptions.find((o) => o.value > after)?.value ?? monthOptions[0]?.value ?? ''
  const win = defaultWindow(startMonth, d.optin_open_day, d.optin_close_day)

  const form = useForm<CycleFormValues>({
    initialValues: {
      month: startMonth,
      weekdays: cycle?.weekdays ?? d.weekdays,
      price: (cycle?.price_paise ?? d.price_paise) / 100,
      optin_open: cycle?.optin_open_date ?? win.open,
      optin_close: cycle?.optin_close_date ?? win.close,
      serve_start: hhmm(cycle?.serve_start ?? d.serve_start),
      serve_end: hhmm(cycle?.serve_end ?? d.serve_end),
    },
    validate: schemaResolver(cycleSchema, { sync: true }),
    validateInputOnChange: true,
  })
  const v = form.getValues()

  // Changing the month moves the opt-in window by the same number of months (New and Edit)
  function changeMonth(next: string | null) {
    if (!next || next === v.month) return
    const a = parseYMD(v.month), b = parseYMD(next)
    const shift = (b.y - a.y) * 12 + (b.m - a.m)
    form.setValues({ month: next, optin_open: shiftDate(v.optin_open, shift), optin_close: shiftDate(v.optin_close, shift) })
  }

  async function submit(open: boolean) {
    const r = form.validate()
    if (r.hasErrors) return
    const c = cycleSchema.parse(form.getValues())
    try {
      const res = await save({ id: cycle?.id ?? null, month: c.month, weekdays: c.weekdays, price_paise: c.price,
        optin_open: c.optin_open, optin_close: c.optin_close, serve_start: c.serve_start, serve_end: c.serve_end, open }).unwrap()
      notifications.show({ color: 'green', icon: <IconCheck size={18} />,
        message: isNew ? `${monthLabel(c.month)} created${open ? ' and open for opt-in' : ' as a draft'} · ${res.lunch_days} lunch days` : 'Cycle saved' })
      onClose()
    } catch { /* shown below */ }
  }

  const days = v.month ? lunchDays(v.month, v.weekdays).length : 0
  const openingNow = saving.isLoading && saving.originalArgs?.open
  return (
    <Modal opened onClose={onClose} fullScreen={mobile} centered size="lg"
      title={<Text fw={700} size="lg">{isNew ? 'New lunch cycle' : `Edit ${monthLabel(cycle.month)}`}</Text>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(false) }} noValidate>
        <Stack>
          {saving.error && <Alert color="red" icon={<IconAlertCircle size={18} />}>{errorMessage(saving.error)}</Alert>}
          {isNew && <Text size="sm" c="dimmed">Pre-filled from More → Settings → New month defaults.</Text>}

          <Select label="Month" data={monthOptions} value={v.month} onChange={changeMonth} allowDeselect={false}
            error={form.errors.month} nothingFoundMessage="Every month in the next year already has a cycle" />
          <WeekdayChips value={v.weekdays} onChange={(w) => form.setFieldValue('weekdays', w)} error={form.errors.weekdays} />
          <NumberInput label="Price per meal" prefix="₹" min={1} max={1000} decimalScale={2} {...form.getInputProps('price')} />

          <SimpleGrid cols={2}>
            <TextInput type="date" label="Opt-in opens" {...form.getInputProps('optin_open')} />
            <TextInput type="date" label="Opt-in closes" title="Closes at the end of this day" {...form.getInputProps('optin_close')} />
            <TextInput type="time" label="Serving starts" {...form.getInputProps('serve_start')} />
            <TextInput type="time" label="Serving ends" {...form.getInputProps('serve_end')} />
          </SimpleGrid>

          {form.isValid() && (
            <Paper bg="brand.0" p="md" radius="md">
              <Text size="sm"><b>{days} lunch days</b> in {monthLabel(v.month)} · <b>{inr(days * toPaise(v.price))}</b> per person if opted in. Mark holidays on the calendar after saving.</Text>
            </Paper>
          )}

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            {isNew ? (
              <>
                <Button variant="light" type="submit" loading={saving.isLoading && !openingNow} disabled={!form.isValid()}>Save draft</Button>
                <Button onClick={() => submit(true)} loading={!!openingNow} disabled={!form.isValid()}>Create &amp; open</Button>
              </>
            ) : (
              <Button type="submit" loading={saving.isLoading} disabled={!form.isValid()}>Save changes</Button>
            )}
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
