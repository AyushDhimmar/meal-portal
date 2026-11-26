import type { ReactNode } from 'react'
import { Alert, Badge, Button, Card, Group, Loader, NumberInput, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput, Title } from '@mantine/core'
import { schemaResolver, useForm, type UseFormReturnType } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconInfoCircle, IconLock } from '@tabler/icons-react'
import type { z } from 'zod'
import { errorMessage } from '../../lib/errors'
import { formatMoment } from '../../lib/dates'
import { WeekdayChips } from '../cycles/WeekdayChips'
import { useSaveSettingMutation, useSettingsQuery, type EditableKey, type Settings } from './api'
import { cycleDefaultsSchema, jobsSchema, monthlyEmailSchema } from './schema'

function Section({ title, hint, badge, children }: { title: string; hint: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <Card padding="lg">
      <Group justify="space-between" align="start" mb="md" wrap="nowrap">
        <div><Title order={4}>{title}</Title><Text size="sm" c="dimmed">{hint}</Text></div>
        {badge}
      </Group>
      {children}
    </Card>
  )
}

/** One editable settings section: a Mantine form checked with its Zod schema, saved on its own and audited. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mantine's form values constraint
function SettingForm<V extends Record<string, any>>({ settingKey, schema, initial, s, render }: {
  settingKey: EditableKey
  schema: z.ZodType<Record<string, unknown>, V>
  initial: V
  s: Settings
  render: (form: UseFormReturnType<V>) => ReactNode
}) {
  const [save, saving] = useSaveSettingMutation()
  const form = useForm<V>({ initialValues: initial, validate: schemaResolver(schema, { sync: true }), validateInputOnChange: true })
  const submit = form.onSubmit(async (values) => {
    try {
      await save({ key: settingKey, value: schema.parse(values) }).unwrap()
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, message: 'Settings saved. The change is in the audit log.' })
    } catch { /* shown below */ }
  })
  return (
    <form onSubmit={submit} noValidate>
      {render(form)}
      <Stack gap="xs" mt="md">
        {saving.error && <Alert color="red" py="xs">{errorMessage(saving.error)}</Alert>}
        <Group justify="space-between">
          <Text size="xs" c="dimmed">Last changed {formatMoment(s.updated_at[settingKey], s.timezone, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</Text>
          <Group gap="xs">
            {form.isDirty() && <Button variant="subtle" color="gray" onClick={() => { form.reset(); saving.reset() }}>Undo</Button>}
            <Button type="submit" disabled={!form.isDirty() || !form.isValid()} loading={saving.isLoading}>Save</Button>
          </Group>
        </Group>
      </Stack>
    </form>
  )
}

function CycleDefaults({ s }: { s: Settings }) {
  const d = s.cycle_defaults
  return (
    <Section title="New month defaults" hint="Pre-filled when you create a month. Months already created keep their own rules.">
      <SettingForm settingKey="cycle_defaults" schema={cycleDefaultsSchema} s={s}
        initial={{ ...d, weekdays: [...d.weekdays], price: d.price_paise / 100 }}
        render={(form) => (
          <Stack gap="md">
            <WeekdayChips label="Lunch days" value={form.getValues().weekdays} onChange={(w) => form.setFieldValue('weekdays', w)} error={form.errors.weekdays} />
            <SimpleGrid cols={{ base: 1, xs: 2 }}>
              <NumberInput label="Price per meal" prefix="₹" min={1} max={1000} decimalScale={2} {...form.getInputProps('price')} />
              <div>
                <Text size="sm" fw={500} mb={4}>Bill on</Text>
                <SegmentedControl fullWidth value={form.getValues().billing_basis} onChange={(x) => form.setFieldValue('billing_basis', x as 'opted' | 'consumed')}
                  data={[{ value: 'opted', label: 'Opted days' }, { value: 'consumed', label: 'Meals eaten' }]} />
              </div>
              <NumberInput label="Opt-in opens on day" description="of the month before" min={1} max={28} allowDecimal={false} {...form.getInputProps('optin_open_day')} />
              <NumberInput label="Opt-in closes on day" description="of the month before" min={1} max={28} allowDecimal={false} {...form.getInputProps('optin_close_day')} />
              <TextInput label="Serving starts" type="time" {...form.getInputProps('serve_start')} />
              <TextInput label="Serving ends" type="time" {...form.getInputProps('serve_end')} />
            </SimpleGrid>
            <Switch label="Only serve during serving hours" description="When off, the counter can serve at any time on a lunch day."
              {...form.getInputProps('enforce_serving_window', { type: 'checkbox' })} />
          </Stack>
        )} />
    </Section>
  )
}

const notLive = <Badge variant="light" color="orange" style={{ flexShrink: 0 }}>Starts after go-live</Badge>

function MonthlyEmail({ s }: { s: Settings }) {
  return (
    <Section title="Monthly report email" hint="Emails last month’s report (Excel) to all Admins." badge={notLive}>
      <SettingForm settingKey="monthly_email" schema={monthlyEmailSchema} s={s} initial={{ ...s.monthly_email }}
        render={(form) => {
          const on = form.getValues().enabled
          return (
            <Stack gap="md">
              <Switch label="Send the report automatically" {...form.getInputProps('enabled', { type: 'checkbox' })} />
              <SimpleGrid cols={2}>
                <NumberInput label="Day of month" min={1} max={28} allowDecimal={false} disabled={!on} {...form.getInputProps('day')} />
                <TextInput label="Time" type="time" disabled={!on} {...form.getInputProps('time')} />
              </SimpleGrid>
            </Stack>
          )
        }} />
    </Section>
  )
}

function Jobs({ s }: { s: Settings }) {
  return (
    <Section title="Daily jobs" hint="Paper fallback list for the counter, and database backups." badge={notLive}>
      <SettingForm settingKey="jobs" schema={jobsSchema} s={s} initial={{ ...s.jobs }}
        render={(form) => (
          <SimpleGrid cols={{ base: 1, xs: 3 }}>
            <TextInput label="Paper list ready at" type="time" {...form.getInputProps('fallback_list_time')} />
            <TextInput label="Nightly backup at" type="time" {...form.getInputProps('nightly_backup_time')} />
            <NumberInput label="Keep backups for" suffix=" days" min={7} max={365} allowDecimal={false} {...form.getInputProps('backup_retention_days')} />
          </SimpleGrid>
        )} />
    </Section>
  )
}

/** Admin-editable rules and automation (F-006). Each section saves on its own and is audited. */
export function SettingsPanel() {
  const settings = useSettingsQuery(undefined, { refetchOnMountOrArgChange: true })
  if (settings.isLoading) return <Loader />
  if (settings.error || !settings.data) return <Alert color="red">{errorMessage(settings.error)}</Alert>
  const s = settings.data
  // key = prefix + updated_at: after a save the section starts again from the saved (normalised) value.
  // (prefix: the seed gives all rows the same timestamp, and sibling keys must differ)
  return (
    <Stack gap="md">
      <CycleDefaults key={'cd' + s.updated_at.cycle_defaults} s={s} />
      <MonthlyEmail key={'me' + s.updated_at.monthly_email} s={s} />
      <Jobs key={'jb' + s.updated_at.jobs} s={s} />
      <Section title="Fixed settings" hint="Changed by a developer, because changing them affects existing data." badge={<IconLock size={18} color="var(--mantine-color-dimmed)" />}>
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <div><Text size="sm" c="dimmed">Time zone</Text><Text fw={600}>{s.timezone}</Text></div>
          <div><Text size="sm" c="dimmed">Sign-in email domain</Text><Text fw={600}>@{s.allowed_domain}</Text></div>
        </SimpleGrid>
      </Section>
      <Alert variant="light" color="blue" icon={<IconInfoCircle size={18} />}>
        Scheduled email and backups are saved now and start running once the app is deployed online.
      </Alert>
    </Stack>
  )
}
