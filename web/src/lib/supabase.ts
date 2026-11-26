import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy web/.env.example to web/.env.local.')
}

// LAN/proxy mode uses a path on this site ("/sb"), passed through to Supabase by the dev server
const absolute = url.startsWith('/') ? new URL(url, window.location.origin).toString().replace(/\/$/, '') : url

/** Typed client: table, view and function names, arguments and results are checked at build time.
 *  Regenerate the types after every migration (see web/README.md). */
export const supabase = createClient<Database>(absolute, key)

export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
