export type Workspace = 'employee' | 'verifier' | 'admin'

export const WORKSPACE_LABEL: Record<Workspace, string> = {
  employee: 'Employee',
  verifier: 'Verifier',
  admin: 'Admin',
}

export const WORKSPACE_HOME: Record<Workspace, string> = {
  employee: '/me',
  verifier: '/counter',
  admin: '/admin',
}

/** Everyone is an Employee; Verifier and Admin are extra roles from user_roles. */
export function workspacesFor(roles: string[]): Workspace[] {
  const list: Workspace[] = []
  if (roles.includes('admin')) list.push('admin')
  if (roles.includes('verifier')) list.push('verifier')
  list.push('employee')
  return list
}

/** The workspace a path belongs to: /admin/... → admin, /counter/... → verifier, else employee. */
export function workspaceOfPath(pathname: string): Workspace {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/counter')) return 'verifier'
  return 'employee'
}
