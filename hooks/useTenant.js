import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTenant() {
  const [user,    setUser]    = useState(null)
  const [tenant,  setTenant]  = useState(null)
  const [role,    setRole]    = useState(null)
  const [bots,    setBots]    = useState([])
  const [usage,   setUsage]   = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { setUser(null); setTenant(null); setLoading(false); return }

      setUser(u)

      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('role, tenants(*)')
        .eq('user_id', u.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!memberData) { setLoading(false); return }

      setTenant(memberData.tenants)
      setRole(memberData.role)

      const tenantId = memberData.tenants.id
      const month    = new Date().toISOString().slice(0, 7)

      const [{ data: botData }, { data: usageData }] = await Promise.all([
        supabase.from('bots').select('*').eq('tenant_id', tenantId).order('created_at'),
        supabase.from('usage').select('*').eq('tenant_id', tenantId).eq('month', month).single()
      ])

      setBots(botData || [])
      setUsage(usageData || { messages: 0, conversations: 0 })
    } catch (e) {
      console.error('[useTenant]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [load])

  // Refresh manual de bots (ex: após criar/deletar)
  const refreshBots = useCallback(async (tenantId) => {
    const { data } = await supabase.from('bots').select('*').eq('tenant_id', tenantId).order('created_at')
    setBots(data || [])
  }, [])

  return { user, tenant, role, bots, usage, loading, refreshBots }
}
