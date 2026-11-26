import {
  IconCalendar, IconHistory, IconHome, IconQrcode, IconUser, IconUsers, type Icon,
} from '@tabler/icons-react'
import type { Workspace } from '../features/auth/roles'

export type NavItem = { to: string; label: string; icon: Icon; end?: boolean }

// Same menus as the prototype
export const NAV: Record<Workspace, NavItem[]> = {
  employee: [
    { to: '/me', label: 'Home', icon: IconHome, end: true },
    { to: '/me/history', label: 'History', icon: IconHistory },
    { to: '/me/code', label: 'My code', icon: IconQrcode },
    { to: '/account', label: 'Account', icon: IconUser },
  ],
  verifier: [
    { to: '/account', label: 'Account', icon: IconUser },
  ],
  admin: [
    { to: '/admin/cycles', label: 'Cycles', icon: IconCalendar },
    { to: '/admin/employees', label: 'Employees', icon: IconUsers },
  ],
}
