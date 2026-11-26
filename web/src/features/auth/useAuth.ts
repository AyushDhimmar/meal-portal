import { useCallback, useMemo } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectAuthStatus, selectAuthUser, selectCachedProfile, type AuthUser } from './authSlice'
import { authApi, type Profile } from './api'
import { workspacesFor, type Workspace } from './roles'
import { signInMethod } from './signInMethod'

export type AuthState = {
  user: AuthUser | null
  /** null = signed in but not on the employee list (or inactive) */
  profile: Profile | null
  loading: boolean
  /** Workspaces this person may open; the current one comes from the URL (see useWorkspace) */
  workspaces: Workspace[]
  signOut: () => Promise<void>
  /** true when the profile shown is the remembered one because the server can't be reached */
  offline: boolean
  /** the profile couldn't be loaded and nothing is remembered (not the same as "not on the list") */
  profileError: unknown
  retry: () => void
}

/**
 * Signed-in user (Redux) + their employee profile and roles (RTK Query).
 * Only reads: the profile request itself is owned by <AuthSync>, so screens mounting and
 * unmounting can't trigger extra requests (or a retry loop when offline).
 */
export function useAuth(): AuthState {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectAuthUser)
  const status = useAppSelector(selectAuthStatus)
  const cached = useAppSelector(selectCachedProfile)
  const selectProfile = useMemo(() => authApi.endpoints.profile.select(user?.id ?? skipToken), [user])
  const result = useAppSelector(selectProfile)

  const fresh = result.data
  const fallback = result.isError && cached && cached.userId === user?.id ? cached.profile : null
  const profile = fresh ?? fallback ?? null
  const workspaces = useMemo(() => (profile ? workspacesFor(profile.roles) : []), [profile])
  const signOut = useCallback(() => signInMethod.signOut(), [])
  const retry = useCallback(() => {
    if (user) dispatch(authApi.endpoints.profile.initiate(user.id, { forceRefetch: true, subscribe: false }))
  }, [dispatch, user])

  return {
    user,
    profile,
    loading: status === 'loading' || (!!user && fresh === undefined && !result.isError),
    workspaces,
    signOut,
    offline: !!fallback,
    profileError: result.isError && !fallback ? result.error : null,
    retry,
  }
}
