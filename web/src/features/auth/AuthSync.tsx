import { useEffect } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { api } from '../../app/api'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { supabase } from '../../lib/supabase'
import { profileLoaded, selectAuthUser, selectCachedProfile, sessionChanged, writeCachedProfile } from './authSlice'
import { useProfileQuery } from './api'

/**
 * Mounted once at the top of the app:
 *  - keeps the Redux auth state in step with Supabase Auth, and clears all cached data on sign-out;
 *  - owns the one subscription to the signed-in person's profile, and remembers the latest one
 *    (used by useAuth only when the server can't be reached).
 */
export function AuthSync() {
  const dispatch = useAppDispatch()
  useEffect(() => {
    let current: string | null | undefined
    const apply = (user: { id: string; email?: string | null } | null | undefined) => {
      const id = user?.id ?? null
      if (id === current) return            // token refreshes fire too; only react to a different person
      current = id
      if (!id) { dispatch(api.util.resetApiState()); writeCachedProfile(null) }
      dispatch(sessionChanged(user ? { id: user.id, email: user.email ?? null } : null))
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user))
    return () => sub.subscription.unsubscribe()
  }, [dispatch])

  const user = useAppSelector(selectAuthUser)
  const cached = useAppSelector(selectCachedProfile)
  const { data: fresh } = useProfileQuery(user?.id ?? skipToken)
  useEffect(() => {
    if (!user || !fresh) return
    if (cached?.userId === user.id && JSON.stringify(cached.profile) === JSON.stringify(fresh)) return
    const c = { userId: user.id, profile: fresh }
    dispatch(profileLoaded(c))
    writeCachedProfile(c)
  }, [user, fresh, cached, dispatch])
  return null
}
