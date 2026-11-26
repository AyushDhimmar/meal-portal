import { ActionIcon, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'

/** Screens don't refresh by themselves; this loads the latest data on request. */
export function RefreshButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Tooltip label="Refresh">
      <ActionIcon variant="default" size="lg" radius="md" aria-label="Refresh" loading={busy} onClick={onClick}>
        <IconRefresh size={18} />
      </ActionIcon>
    </Tooltip>
  )
}
