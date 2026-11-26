import { supabase } from '../../lib/supabase'

/**
 * Sign-in method for development: email + password on the local Supabase.
 * Decision pending between Microsoft (Azure AD via Supabase Auth) and the company IAM
 * (custom OIDC). Only this file changes when that is decided.
 */
export const signInMethod = {
  kind: 'email-password' as const,

  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    return error ? friendlyError(error.message) : null
  },

  async signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password })
    return error ? friendlyError(error.message) : null
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut()
  },
}

function friendlyError(message: string): string {
  // The database rejects non-company emails in a trigger; Supabase reports that generically.
  if (/database error saving new user|DOMAIN_NOT_ALLOWED/i.test(message)) {
    return 'Only @1rivet.com company accounts can sign in.'
  }
  if (/invalid login credentials/i.test(message)) return 'Email or password is incorrect.'
  if (/already registered/i.test(message)) return 'This email already has an account. Sign in instead.'
  if (/password should be at least/i.test(message)) return 'Password must be at least 6 characters.'
  return message
}
