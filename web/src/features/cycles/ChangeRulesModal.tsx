import { useState } from 'react'
import { Button, Group, Modal, NumberInput, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { ReasonModal } from '../../components/ReasonModal'
import { errorMessage } from '../../lib/errors'
import { hhmm, inr, lunchDays, monthLabel } from '../../lib/dates'
import { toPaise } from '../../lib/schemas'
import { useUpdateClosedCycleMutation, type CycleRow, type RuleChanges } from './api'
import { rulesSchema, type RulesFormValues } from './schema'
import { WeekdayChips } from './WeekdayChips'

const LABEL: Record<keyof RuleChanges, string> = { price_paise: 'price', weekdays: 'lunch weekdays', serve_start: 'serving start', serve_end: 'serving end' }

/** Price, weekdays and serving times of a closed or locked cycle. These change bills, so a reason is required. */
export function ChangeRulesModal({ cycle, onClose }: { cycle: CycleRow; onClose: () => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [update, updating] = useUpdateClosedCycleMutation()
  const [asking, setAsking] = useState(false)
  const form = useForm<RulesFormValues>({
    initialValues: { weekdays: [...cycle.weekdays].sort(), price: cycle.price_paise / 100, serve_start: hhmm(cycle.serve_start), serve_end: hhmm(cycle.serve_end) },
    validate: schemaResolver(rulesSchema, { sync: true }),
    validateInputOnChange: true,
  })

  // only what actually changed is sent (and named in the audit log)
  const v = form.getValues()
  const changes: RuleChanges = {}
  if (toPaise(v.price) !== cycle.price_paise) changes.price_paise = toPaise(v.price)
  if (v.weekdays.join() !== [...cycle.weekdays].sort().join()) changes.weekdays = v.weekdays
  if (v.serve_start !== hhmm(cycle.serve_start)) changes.serve_start = v.serve_start
  if (v.serve_end !== hhmm(cycle.serve_end)) changes.serve_end = v.serve_end
  const changed = Object.keys(changes).length > 0
  const days = lunchDays(cycle.month, v.weekdays).length

  async function save(reason: string) {
    try {
      await update({ id: cycle.id, changes, reason }).unwrap()
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, message: `${monthLabel(cycle.month)} updated · reason recorded` })
      onClose()
    } catch { /* shown in the reason dialog */ }
  }

  return (
    <>
      <Modal opened onClose={onClose} fullScreen={mobile} centered size="lg"
        title={<Text fw={700} size="lg">Change rules · {monthLabel(cycle.month)}</Text>}>
        <form onSubmit={form.onSubmit(() => setAsking(true))} noValidate>
          <Stack>
            <Text size="sm" c="dimmed">This cycle is {cycle.status}. Changes affect everyone’s bill for the month, so you’ll be asked for a reason.</Text>
            <WeekdayChips value={v.weekdays} onChange={(w) => form.setFieldValue('weekdays', w)} error={form.errors.weekdays} />
            <NumberInput label="Price per meal" prefix="₹" min={1} max={1000} decimalScale={2} {...form.getInputProps('price')} />
            <SimpleGrid cols={2}>
              <TextInput type="time" label="Serving starts" {...form.getInputProps('serve_start')} />
              <TextInput type="time" label="Serving ends" {...form.getInputProps('serve_end')} />
            </SimpleGrid>
            {form.isValid() && (
              <Paper bg="gray.0" p="md" radius="md">
                <Text size="sm">Before: {cycle.lunch_days} lunch days at {inr(cycle.price_paise)}. After: about {days - cycle.holidays} lunch days at {inr(toPaise(v.price))}.</Text>
              </Paper>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={!changed}>Save with reason</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      {asking && (
        <ReasonModal title="Why are the rules changing?" confirmLabel="Save changes" busy={updating.isLoading}
          error={updating.error ? errorMessage(updating.error) : null}
          summary={<>Changing {(Object.keys(changes) as (keyof RuleChanges)[]).map((k) => LABEL[k]).join(', ')} for {monthLabel(cycle.month)}.</>}
          onConfirm={save} onCancel={() => { setAsking(false); updating.reset() }} />
      )}
    </>
  )
}
