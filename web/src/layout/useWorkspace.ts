import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { workspaceOfPath, type Workspace } from '../features/auth/roles'

const KEY = 'meal-portal:last-workspace'
// Pages shared by all roles keep the menu of the role you came from
const SHARED = ['/account']

function readLast(): Workspace | null {
  try { return sessionStorage.getItem(KEY) as Workspace | null } catch { return null }
}

export function useWorkspace(allowed: Workspace[]): Workspace {
  const { pathname } = useLocation()
  const shared = SHARED.some((p) => pathname.startsWith(p))
  const last = readLast()
  const ws: Workspace = shared && last && allowed.includes(last) ? last : workspaceOfPath(pathname)

  useEffect(() => {
    if (!shared) {
      try { sessionStorage.setItem(KEY, ws) } catch { /* private mode: fine */ }
    }
  }, [shared, ws])

  return ws
}
