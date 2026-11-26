import { useState } from 'react'
import { Alert, Button, FileButton, Group, Loader, Modal, SimpleGrid, Stack, Table, Text, ThemeIcon } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconAlertCircle, IconCheck, IconDownload, IconFileSpreadsheet, IconUpload } from '@tabler/icons-react'
import { errorMessage } from '../../lib/errors'
import { downloadCsv } from '../../lib/download'
import { parseEmployeeFile, TEMPLATE, type ImportRow } from './parseEmployeeFile'
import { useImportEmployeesMutation, type ImportSummary } from './api'
import classes from './ImportEmployeesModal.module.css'

type Step =
  | { kind: 'choose'; error?: string }
  | { kind: 'checking'; fileName: string }
  | { kind: 'preview'; fileName: string; rows: ImportRow[]; summary: ImportSummary; ignored: string[] }

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className={classes.stat}>
      <Text fz={26} fw={700} c={color}>{value}</Text>
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
    </div>
  )
}

export function ImportEmployeesModal({ onClose }: { onClose: () => void }) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const [importEmployees, importing] = useImportEmployeesMutation()
  const [step, setStep] = useState<Step>({ kind: 'choose' })

  async function choose(file: File | null) {
    if (!file) return
    setStep({ kind: 'checking', fileName: file.name })
    try {
      const parsed = await parseEmployeeFile(file)
      if (parsed.missingColumns.length) {
        setStep({ kind: 'choose', error: `Missing column${parsed.missingColumns.length > 1 ? 's' : ''}: ${parsed.missingColumns.join(', ')}. Download the template to see the expected headers.` })
        return
      }
      if (parsed.rows.length === 0) { setStep({ kind: 'choose', error: 'The file has no employee rows.' }); return }
      const summary = await importEmployees({ rows: parsed.rows, dryRun: true }).unwrap()   // check only, writes nothing
      setStep({ kind: 'preview', fileName: file.name, rows: parsed.rows, summary, ignored: parsed.ignoredColumns })
    } catch (e) {
      setStep({ kind: 'choose', error: errorMessage(e) })
    }
  }

  async function runImport() {
    if (step.kind !== 'preview') return
    try {
      const res = await importEmployees({ rows: step.rows, dryRun: false }).unwrap()
      notifications.show({
        color: 'green', icon: <IconCheck size={18} />,
        message: `Imported: ${res.new} added, ${res.changed} updated${res.error_count ? `, ${res.error_count} skipped` : ''}`,
      })
      onClose()
    } catch (e) {
      notifications.show({ color: 'red', message: errorMessage(e) })
    }
  }

  const toWrite = step.kind === 'preview' ? step.summary.new + step.summary.changed : 0

  return (
    <Modal opened onClose={onClose} fullScreen={mobile} centered size="lg"
      title={<Text fw={700} size="lg">Import employees</Text>}>
      {step.kind === 'choose' && (
        <Stack>
          {step.error && <Alert color="red" icon={<IconAlertCircle size={18} />}>{step.error}</Alert>}
          <div className={classes.drop}>
            <ThemeIcon size={48} radius="xl" variant="light"><IconFileSpreadsheet size={26} /></ThemeIcon>
            <Text fw={600} mt="sm">Choose a .csv or .xlsx file</Text>
            <Text size="sm" c="dimmed" mb="md">Columns: emp_code, name, email, department, status. First row = headers.</Text>
            <Group justify="center">
              <FileButton onChange={choose} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
                {(props) => <Button {...props} leftSection={<IconUpload size={18} />}>Choose file</Button>}
              </FileButton>
              <Button variant="default" leftSection={<IconDownload size={18} />} onClick={() => downloadCsv('employee-import-template.csv', TEMPLATE)}>
                Template
              </Button>
            </Group>
          </div>
          <Text size="xs" c="dimmed">
            Nothing is saved until you confirm. Existing employees are matched by code and updated; codes can be
            written as 1R-0123 or just 0123. Roles are not imported — set them on each employee.
          </Text>
        </Stack>
      )}

      {step.kind === 'checking' && (
        <Stack align="center" py="xl"><Loader /><Text c="dimmed">Checking {step.fileName}…</Text></Stack>
      )}

      {step.kind === 'preview' && (
        <Stack>
          <Group gap="xs"><IconFileSpreadsheet size={18} /><Text fw={600}>{step.fileName}</Text><Text c="dimmed" size="sm">· {step.summary.total} rows checked</Text></Group>
          <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="xs">
            <Stat label="New" value={step.summary.new} color="brand.7" />
            <Stat label="Updates" value={step.summary.changed} />
            <Stat label="No change" value={step.summary.unchanged} color="dimmed" />
            <Stat label="Errors" value={step.summary.error_count} color={step.summary.error_count ? 'red' : 'dimmed'} />
          </SimpleGrid>

          {step.ignored.length > 0 && (
            <Text size="xs" c="dimmed">Ignored columns: {step.ignored.join(', ')}</Text>
          )}

          {step.summary.error_count > 0 && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}
              title={`${step.summary.error_count} row${step.summary.error_count > 1 ? 's' : ''} will be skipped`}>
              <Table.ScrollContainer minWidth={0} mah={220}>
                <Table fz="sm" verticalSpacing={4}>
                  <Table.Thead><Table.Tr><Table.Th>Line</Table.Th><Table.Th>Code</Table.Th><Table.Th>Problem</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {step.summary.errors.slice(0, 100).map((e) => (
                      <Table.Tr key={e.row}><Table.Td>{step.rows[e.row - 1]?.line ?? e.row}</Table.Td><Table.Td>{e.code || '—'}</Table.Td><Table.Td>{e.error}</Table.Td></Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              <Button variant="subtle" size="xs" mt="xs" leftSection={<IconDownload size={14} />}
                onClick={() => downloadCsv('import-errors.csv', [['line', 'emp_code', 'name', 'problem'], ...step.summary.errors.map((e) => [step.rows[e.row - 1]?.line ?? e.row, e.code, e.name, e.error])])}>
                Download error list
              </Button>
            </Alert>
          )}

          <Group justify="space-between" mt="sm">
            <Button variant="default" onClick={() => setStep({ kind: 'choose' })}>Choose another file</Button>
            <Button onClick={runImport} loading={importing.isLoading} disabled={toWrite === 0}>
              {toWrite === 0 ? 'Nothing to import' : `Import ${toWrite} row${toWrite > 1 ? 's' : ''}`}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
