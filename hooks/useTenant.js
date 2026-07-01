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
      // 1) Verifica se existe uma sessão válida (não expirada) antes de qualquer coisa.
      //    Isso evita o falso "Tenant não encontrado" quando o token local está velho/expirado.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setUser(null); setTenant(null); setLoading(false)
        return
      }

      // Se o access_token estiver perto de expirar ou já expirado, força um refresh explícito.
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      if (expiresAt && expiresAt < Date.now() + 30_000) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshed?.session) {
          // Sessão não pôde ser renovada — desloga de forma limpa em vez de mostrar erro confuso.
          await supabase.auth.signOut()
          setUser(null); setTenant(null); setLoading(false)
          return
        }
      }

      const { data: { user: u }, error: userError } = await supabase.auth.getUser()
      if (userError || !u) {
        await supabase.auth.signOut()
        setUser(null); setTenant(null); setLoading(false)
        return
      }

      setUser(u)

      const { data: memberData, error: memberError } = await supabase
        .from('tenant_members')
        .select('role, tenants(*)')
        .eq('user_id', u.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (memberError) {
        console.error('[useTenant] member error', memberError)
        setLoading(false)
        return
      }

      if (!memberData) {
        // Última verificação: tenta uma vez mais após revalidar sessão, para descartar
        // falso-negativo por token ainda propagando nos servidores do Supabase.
        const { data: retryData } = await supabase
          .from('tenant_members')
          .select('role, tenants(*)')
          .eq('user_id', u.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (!retryData) {
          console.warn('[useTenant] sem tenant vinculado para user', u.id)
          setLoading(false)
          return
        }

        setTenant(retryData.tenants)
        setRole(retryData.role)
        await loadBotsAndUsage(retryData.tenants.id)
        setLoading(false)
        return
      }

      setTenant(memberData.tenants)
      setRole(memberData.role)
      await loadBotsAndUsage(memberData.tenants.id)
    } catch (e) {
      console.error('[useTenant] catch', e)
    } finally {
      setLoading(false)
    }
  }, [])

  async function loadBotsAndUsage(tenantId) {
    const month = new Date().toISOString().slice(0, 7)
    const [{ data: botData, error: botError }, { data: usageData }] = await Promise.all([
      supabase.from('bots').select('*').eq('tenant_id', tenantId).order('created_at'),
      supabase.from('usage').select('*').eq('tenant_id', tenantId).eq('month', month).maybeSingle()
    ])
    if (botError) console.error('[useTenant] bots error', botError)
    setBots(botData || [])
    setUsage(usageData || { messages: 0, conversations: 0 })
  }

  useEffect(() => {
    load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [load])

  const refreshBots = useCallback(async (tenantId) => {
    const { data } = await supabase.from('bots').select('*').eq('tenant_id', tenantId).order('created_at')
    setBots(data || [])
  }, [])

  return { user, tenant, role, bots, usage, loading, refreshBots }
}
