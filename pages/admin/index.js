import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'

export default function AdminDashboard() {
  const router = useRouter()
  const { user, tenant, role, bots, loading } = useTenant()
  const [stats, setStats] = useState({ messages: 0, conversations: 0, contacts: 0, active: 0 })

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    async function loadStats() {
      const month = new Date().toISOString().slice(0, 7)
      const [{ count: msgCount }, { count: convCount }, { count: contactCount }, { data: usageData }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
        supabase.from('usage').select('*').eq('tenant_id', tenant.id).eq('month', month).single()
      ])
      setStats({
        messages: msgCount || 0,
        conversations: convCount || 0,
        contacts: contactCount || 0,
        monthMessages: usageData?.messages || 0
      })
    }
    loadStats()
  }, [tenant])

  if (loading) return <div style={{ background: '#080810', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f8ef7' }}>Carregando…</div>
  if (!user || !tenant) return null

  const plan = PLANS[tenant.plan] || PLANS.free
  const usagePct = Math.min((stats.monthMessages / plan.max_messages_month) * 100, 100)
  const activeBot = bots.find(b => b.status === 'active')

  const STAT_CARDS = [
    { label: 'Mensagens totais', value: stats.messages.toLocaleString('pt-BR'), icon: '💬', color: '#4f8ef7' },
    { label: 'Conversas', value: stats.conversations.toLocaleString('pt-BR'), icon: '🗂', color: '#8b5cf6' },
    { label: 'Contatos', value: stats.contacts.toLocaleString('pt-BR'), icon: '👥', color: '#10b981' },
    { label: 'Bots configurados', value: bots.length, icon: '🤖', color: '#f59e0b' },
  ]

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>Olá, {user.email?.split('@')[0]} 👋</h1>
        <p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>Aqui está o resumo da {tenant.name}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {STAT_CARDS.map(s => (
          <div key={s.label} className="ark-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        {/* Uso mensal */}
        <div className="ark-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>📊 Uso este mês</h3>
            <span className="ark-badge" style={{ background: `rgba(79,142,247,0.15)`, color: '#4f8ef7', border: '1px solid rgba(79,142,247,0.2)' }}>
              Plano {plan.label}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 13, marginBottom: 8 }}>
            <span>{stats.monthMessages.toLocaleString('pt-BR')} mensagens</span>
            <span>{plan.max_messages_month === 999999 ? 'Ilimitado' : plan.max_messages_month.toLocaleString('pt-BR')} limite</span>
          </div>
          <div style={{ background: '#12121f', borderRadius: 8, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${usagePct}%`, height: '100%', background: usagePct > 80 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#4f8ef7,#06b6d4)', borderRadius: 8, transition: 'width 0.5s' }} />
          </div>
          <p style={{ color: '#334155', fontSize: 12, marginTop: 8 }}>{usagePct.toFixed(1)}% do limite mensal usado</p>
          {usagePct > 80 && tenant.plan !== 'enterprise' && (
            <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ef4444' }}>
              ⚠️ Limite próximo — <a href="/admin/upgrade" style={{ color: '#4f8ef7' }}>considere fazer upgrade</a>
            </div>
          )}
        </div>

        {/* Status do bot */}
        <div className="ark-card">
          <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>🤖 Status dos Bots</h3>
          {bots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: '#475569', fontSize: 13, marginBottom: 12 }}>Nenhum bot criado ainda.</p>
              <a href="/admin/bots" className="ark-btn" style={{ fontSize: 12 }}>Criar bot →</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bots.map(bot => (
                <div key={bot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12121f', borderRadius: 8, padding: '10px 12px' }}>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{bot.name}</div>
                    <div style={{ color: '#475569', fontSize: 11 }}>{bot.phone_number_id ? '✅ Meta configurado' : '⚠️ Meta não configurado'}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                    background: bot.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                    color: bot.status === 'active' ? '#10b981' : '#ef4444'
                  }}>
                    {bot.status === 'active' ? '● Ativo' : '○ Inativo'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
