import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import FlowEditor from '../../components/FlowEditor'
import Tutorial from '../../components/FlowEditor/Tutorial'
import AIGenerateButton from '../../components/FlowEditor/AIGenerate'
import JsonTools from '../../components/FlowEditor/JsonTools'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

export default function FlowPage() {
  const router = useRouter()
  const { user, tenant, role, bots, profile, loading } = useTenant()
  const [selectedBotId, setSelectedBotId] = useState(null)
  const [flow, setFlow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  async function deleteFlow() {
    if (!selectedBotId) return
    const emptyFlow = { name: 'Fluxo Principal', nodes: [] }
    setSaving(true)
    await supabase.from('bots').update({ flow: emptyFlow, updated_at: new Date().toISOString() }).eq('id', selectedBotId)
    setFlow(emptyFlow)
    setSaving(false)
    setConfirmDelete(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

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
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 20 }}>🌿 Editor de Fluxo</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>Monte a árvore de conversa do seu bot</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {bots.length > 1 && (
            <select value={selectedBotId} onChange={e => setSelectedBotId(e.target.value)}
              style={{ background: '#12121f', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 13, outline: 'none' }}>
              {bots.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <AIGenerateButton
            botId={selectedBotId}
            hasExistingFlow={(flow?.nodes?.length || 0) > 0}
            onGenerated={generated => setFlow(generated)}
          />
          <JsonTools flow={flow} onChange={setFlow} />
          <button onClick={() => setShowTutorial(true)} className="ark-btn-ghost">
            🧭 Como usar
          </button>
          <button onClick={() => setConfirmDelete(true)} className="ark-btn-ghost" disabled={saving}
            style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
            🗑️ Apagar fluxo
          </button>
          <button onClick={saveFlow} className="ark-btn" disabled={saving}>
            {saving ? 'Salvando…' : saved ? '✅ Salvo!' : '💾 Salvar fluxo'}
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0d0d1e', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 28, width: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Apagar fluxo inteiro?</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
              Todos os nós e configurações do fluxo serão removidos. O bot voltará ao estado sem fluxo. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(false)} className="ark-btn-ghost">
                Cancelar
              </button>
              <button onClick={deleteFlow} disabled={saving}
                style={{ background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Apagando…' : 'Sim, apagar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ark-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {flow ? (
          <FlowEditor flow={flow} onChange={setFlow} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Selecione um bot para editar o fluxo</div>
        )}
      </div>
    </AdminLayout>
  )
}
