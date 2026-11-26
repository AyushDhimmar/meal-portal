import {
  IconUser, type Icon,
} from '@tabler/icons-react'
import type { Workspace } from '../features/auth/roles'

export type NavItem = { to: string; label: string; icon: Icon; end?: boolean }

// Same menus as the prototype
export const NAV: Record<Workspace, NavItem[]> = {
  employee: [
    { to: '/account', label: 'Account', icon: IconUser },
  ],
  verifier: [
    { to: '/account', label: 'Account', icon: IconUser },
  ],
  admin: [
  ],
}
