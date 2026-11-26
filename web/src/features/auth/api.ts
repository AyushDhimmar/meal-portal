import { api, sb } from '../../app/api'
import { supabase, type Enums } from '../../lib/supabase'

export type Profile = {
  id: string; emp_code: string; name: string; email: string; department: string | null
  roles: Enums<'app_role'>[]
}

export const authApi = api.injectEndpoints({
  endpoints: (b) => ({
    /** The signed-in person's employee row (null = not on the list, or inactive). */
    profile: b.query<Profile | null, string>({
      queryFn: async (userId) => {
        const res = await sb(supabase.from('employees')
          .select('id, emp_code, name, email, department, user_roles(role)')
          .eq('auth_user_id', userId).eq('status', 'active').maybeSingle())
        if (res.error) return { error: res.error }
        const e = res.data
        return { data: e ? { id: e.id, emp_code: e.emp_code, name: e.name, email: e.email, department: e.department, roles: e.user_roles.map((r) => r.role) } : null }
      },
      providesTags: ['Profile'],
      keepUnusedDataFor: 300,
    }),
  }),
})

export const { useProfileQuery } = authApi
