import { Alert, Autocomplete, Button, Chip, Group, Modal, SegmentedControl, Stack, Text, TextInput } from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { errorMessage } from '../../lib/errors'
import { normalizeEmpCode } from '../../lib/empCode'
import { useSaveEmployeeMutation, type AppRole, type EmployeeRow, type EmployeeStatus } from './api'
import { employeeSchema, type EmployeeFormValues } from './schema'

type Props = {
  /** null = add new employee */
  employee: EmployeeRow | null
  departments: string[]
  /** the signed-in Admin's employee id, to stop them locking themselves out */
  selfId: string
  onClose: () => void
}

export function EmployeeForm({ employee, departments, selfId, onClose }: Props) {
  const isNew = employee === null
  const isSelf = employee?.id === selfId
  const mobile = useMediaQuery('(max-width: 48em)')
  const [save, saving] = useSaveEmployeeMutation()

  const form = useForm<EmployeeFormValues>({
    initialValues: {
      emp_code: employee?.emp_code ?? '', name: employee?.name ?? '', email: employee?.email ?? '',
      department: employee?.department ?? '', status: employee?.status ?? 'active',
      roles: employee?.user_roles.map((r) => r.role) ?? [],
    },
    validate: schemaResolver(employeeSchema, { sync: true }),
    validateInputOnBlur: true,
  })

  const submit = form.onSubmit(async (values) => {
    const v = employeeSchema.parse(values)   // trimmed, lower-cased email, normalised code
    try {
      const res = await save({ id: employee?.id ?? null, ...v }).unwrap()
      notifications.show({ color: 'green', icon: <IconCheck size={18} />, message: isNew ? `${v.name} added as ${res.emp_code}` : 'Changes saved' })
      onClose()
    } catch { /* shown from saving.error */ }
  })

  return (
    <Modal opened onClose={onClose} fullScreen={mobile} centered size="lg"
      title={<Text fw={700} size="lg">{isNew ? 'Add employee' : employee.name}</Text>}>
      <form onSubmit={submit} noValidate>
        <Stack>
          {saving.error && <Alert color="red" icon={<IconAlertCircle size={18} />}>{errorMessage(saving.error)}</Alert>}

          <Group grow align="start">
            <TextInput label="Employee code" placeholder="1R-0123" disabled={!isNew} required={isNew}
              description={isNew ? undefined : 'Codes can’t change after creation'}
              {...form.getInputProps('emp_code')}
              onBlur={(e) => { const c = form.getValues().emp_code; if (c) form.setFieldValue('emp_code', normalizeEmpCode(c)); form.getInputProps('emp_code').onBlur?.(e) }} />
            <SegmentedControl mt={26} value={form.getValues().status} onChange={(v) => form.setFieldValue('status', v as EmployeeStatus)}
              disabled={isSelf} data={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          </Group>
          <TextInput label="Full name" required {...form.getInputProps('name')} />
          <TextInput label="Work email" type="email" placeholder="name@1rivet.com" required {...form.getInputProps('email')} />
          <Autocomplete label="Department" data={departments} placeholder="e.g. Engineering" {...form.getInputProps('department')} />

          <div>
            <Text size="sm" fw={500} mb={6}>Roles</Text>
            <Group gap="xs">
              <Chip checked readOnly disabled>Employee</Chip>
              <Chip.Group multiple value={form.getValues().roles} onChange={(v) => form.setFieldValue('roles', v as AppRole[])}>
                <Chip value="verifier">Verifier</Chip>
                <Chip value="admin" disabled={isSelf && form.getValues().roles.includes('admin')}>Admin</Chip>
              </Chip.Group>
            </Group>
            <Text size="xs" c="dimmed" mt={6}>
              Everyone is an Employee. Verifier: lunch counter only. Admin: full access.
              {isSelf && ' You can’t remove your own Admin role or deactivate yourself.'}
            </Text>
          </div>

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving.isLoading}>{isNew ? 'Add employee' : 'Save changes'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
