import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

export default function AnalyticsPage() {
  const { user, tenant, role, loading } = useTenant()
  const router = useRouter()
  const [stats, setStats] = useState([])

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => {
    if (!tenant) return
    supabase.from('usage').select('*').eq('tenant_id', tenant.id).order('month', { ascending: false }).limit(12)
      .then(({ data }) => setStats(data || []))
  }, [tenant])

  if (loading || !user || !tenant) return null

  const maxMsg = Math.max(...stats.map(s => s.messages), 1)

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 24 }}>📊 Analytics</h1>
      <div className="ark-card">
        <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 20 }}>Mensagens por mês</h3>
        {stats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155' }}>Dados aparecerão aqui conforme o bot for usado.</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 200, overflowX: 'auto' }}>
            {stats.reverse().map(s => (
              <div key={s.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 60 }}>
                <div style={{ color: '#4f8ef7', fontSize: 11, fontWeight: 700 }}>{s.messages}</div>
                <div style={{ width: 40, height: `${(s.messages / maxMsg) * 160}px`, background: 'linear-gradient(180deg,#4f8ef7,#06b6d4)', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                <div style={{ color: '#475569', fontSize: 10 }}>{s.month.slice(5)}/{s.month.slice(2,4)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
