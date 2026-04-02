import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import FlowEditor from '../../components/FlowEditor'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

export default function FlowPage() {
  const router = useRouter()
  const { user, tenant, role, bots, loading } = useTenant()
  const [selectedBotId, setSelectedBotId] = useState(null)
  const [flow, setFlow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading])

  useEffect(() => {
    if (bots.length && !selectedBotId) setSelectedBotId(bots[0].id)
  }, [bots])

  useEffect(() => {
    if (!selectedBotId) return
    const bot = bots.find(b => b.id === selectedBotId)
    if (bot) setFlow(bot.flow || { name: 'Fluxo Principal', nodes: [] })
  }, [selectedBotId, bots])

  async function saveFlow() {
    if (!selectedBotId || !flow) return
    setSaving(true)
    await supabase.from('bots').update({ flow, updated_at: new Date().toISOString() }).eq('id', selectedBotId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading || !user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>🌿 Editor de Fluxo</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Monte a árvore de conversa do seu bot</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {bots.length > 1 && (
            <select value={selectedBotId} onChange={e => setSelectedBotId(e.target.value)}
              style={{ background: '#12121f', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none' }}>
              {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button onClick={saveFlow} className="ark-btn" disabled={saving}>
            {saving ? 'Salvando…' : saved ? '✅ Salvo!' : '💾 Salvar fluxo'}
          </button>
        </div>
      </div>

      <div className="ark-card" style={{ padding: 0, overflow: 'hidden' }}>
        {flow ? (
          <FlowEditor flow={flow} onChange={setFlow} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Selecione um bot para editar o fluxo</div>
        )}
      </div>
    </AdminLayout>
  )
}
