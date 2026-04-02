import { supabase } from './supabase'

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserTenant(userId) {
  const { data } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  return data
}

export async function getActiveBots(tenantId) {
  const { data } = await supabase
    .from('bots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at')
  return data || []
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/login'
}
