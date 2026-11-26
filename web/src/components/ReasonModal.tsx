import type { ReactNode } from 'react'
import { Alert, Button, Chip, Group, Modal, Stack, Text, Textarea } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { IconAlertCircle } from '@tabler/icons-react'
import { z } from 'zod'
import { reasonSchema } from '../lib/schemas'

const COMMON = ['New joiner', 'On leave', 'Holiday declared', 'Entered by mistake', 'Vendor price change']
const schema = z.object({ reason: reasonSchema })

type Props = {
  title: string
  /** what will happen, in one sentence */
  summary: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: (reason: string) => void
  onCancel: () => void
}

/** Asks for the mandatory reason (≥ 5 characters) that the audit log records with a change. */
export function ReasonModal({ title, summary, confirmLabel, danger, busy, error, onConfirm, onCancel }: Props) {
  const form = useForm({ initialValues: { reason: '' }, validate: schemaResolver(schema, { sync: true }), validateInputOnChange: true })
  const reason = form.getValues().reason
  return (
    <Modal opened onClose={onCancel} centered title={<Text fw={700}>{title}</Text>} zIndex={300}>
      <form onSubmit={form.onSubmit((v) => onConfirm(schema.parse(v).reason))} noValidate>
        <Stack>
          <Text size="sm">{summary}</Text>
          {error && <Alert color="red" icon={<IconAlertCircle size={18} />}>{error}</Alert>}
          <Chip.Group value={reason} onChange={(v) => form.setFieldValue('reason', v as string)}>
            <Group gap={6}>{COMMON.map((r) => <Chip key={r} value={r} size="sm">{r}</Chip>)}</Group>
          </Chip.Group>
          <Textarea label="Reason" description="Saved in the audit log with your name" autosize minRows={2} data-autofocus
            {...form.getInputProps('reason')} error={reason.length > 0 ? form.errors.reason : null} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onCancel}>Cancel</Button>
            <Button type="submit" color={danger ? 'red' : undefined} disabled={!form.isValid()} loading={busy}>{confirmLabel}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
