import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useTenant() {
  const [user, setUser] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [role, setRole] = useState(null)
  const [bots, setBots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        setUser(user)

        const { data: memberData } = await supabase
          .from('tenant_members')
          .select('role, tenants(*)')
          .eq('user_id', user.id)
          .single()

        if (memberData) {
          setTenant(memberData.tenants)
          setRole(memberData.role)

          const { data: botData } = await supabase
            .from('bots')
            .select('*')
            .eq('tenant_id', memberData.tenants.id)
          setBots(botData || [])
        }
      } catch(e) { console.error(e) }
      setLoading(false)
    }
    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => load())
    return () => subscription.unsubscribe()
  }, [])

  return { user, tenant, role, bots, loading }
}
