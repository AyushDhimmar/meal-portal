import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Profile } from './api'

/** Who is signed in (from Supabase Auth). The employee profile and roles come from authApi. */
export type AuthUser = { id: string; email: string | null }

/**
 * The last profile loaded for this user. Used only when the profile can't be fetched (no
 * connection at the counter), so "My code" and the menus still work. Kept in localStorage so
 * it survives a reload; cleared on sign-out. Holds no secrets (name, code, department, roles);
 * the database still checks every request.
 */
type CachedProfile = { userId: string; profile: Profile }

type AuthState = { status: 'loading' | 'signedIn' | 'signedOut'; user: AuthUser | null; cachedProfile: CachedProfile | null }

const STORAGE_KEY = 'meal-portal.profile'
const readCached = (): CachedProfile | null => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CachedProfile | null } catch { return null }
}
export const writeCachedProfile = (c: CachedProfile | null) => {
  try { if (c) localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); else localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
}

const initialState: AuthState = { status: 'loading', user: null, cachedProfile: readCached() }

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionChanged(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload
      state.status = action.payload ? 'signedIn' : 'signedOut'
      if (!action.payload || state.cachedProfile?.userId !== action.payload.id) state.cachedProfile = null
    },
    profileLoaded(state, action: PayloadAction<CachedProfile>) {
      state.cachedProfile = action.payload
    },
  },
  selectors: {
    selectAuthUser: (s) => s.user,
    selectAuthStatus: (s) => s.status,
    selectCachedProfile: (s) => s.cachedProfile,
  },
})

export const { sessionChanged, profileLoaded } = authSlice.actions
export const { selectAuthUser, selectAuthStatus, selectCachedProfile } = authSlice.selectors
