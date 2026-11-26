import { SegmentedControl, Stack, Text, Title } from '@mantine/core'
import { useSearchParams } from 'react-router'
import { AuditLog } from './AuditLog'
import { SettingsPanel } from './SettingsPanel'

type Tab = 'audit' | 'settings'

/** Admin "More": the audit log and settings (US-025, F-006). The tab lives in the URL so links and Back work. */
export function MorePage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'settings' ? 'settings' : 'audit'
  return (
    <Stack gap="md">
      <div>
        <Title order={2}>{tab === 'audit' ? 'Audit log' : 'Settings'}</Title>
        <Text c="dimmed" size="sm">{tab === 'audit' ? 'Every change Admins make, with who, when and why' : 'Defaults for new months and scheduled jobs'}</Text>
      </div>
      <SegmentedControl w={{ base: '100%', xs: 320 }} value={tab} onChange={(v) => setParams(v === 'settings' ? { tab: 'settings' } : {}, { replace: true })}
        data={[{ value: 'audit', label: 'Audit log' }, { value: 'settings', label: 'Settings' }]} />
      {tab === 'audit' ? <AuditLog /> : <SettingsPanel />}
    </Stack>
  )
}
