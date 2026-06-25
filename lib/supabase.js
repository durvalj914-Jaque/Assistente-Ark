import { createClient } from '@supabase/supabase-js'

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// Admin client — SOMENTE em API routes (server-side)
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
  return createClient(URL, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
