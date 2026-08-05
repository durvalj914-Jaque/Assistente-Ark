/**
 * BotEditorModal — Modal de edição de bot do cliente, aberto do Painel Arkiel.
 * Permite: renomear, ativar/desativar, editar fluxo (FlowEditor), 
 * colar/importar JSON, gerar fluxo via IA.
 */
import { useState, useEffect } from 'react'
import FlowEditor from '../FlowEditor'
import Tutorial from '../FlowEditor/Tutorial'
import AIGenerateButton from '../FlowEditor/AIGenerate'
import JsonTools from '../FlowEditor/JsonTools'
import { supabase } from '../../lib/supabase'

export default function BotEditorModal({ bot, tenantName, onClose, onSaved }) {
  const [flow, setFlow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [botName, setBotName] = useState(bot.name)
  const [botStatus, setBotStatus] = useState(bot.status)
  const [renaming, setRenaming] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Carregar o flow completo do bot (não vem no select do painel)
    supabase
      .from('bots')
      .select('flow')
      .eq('id', bot.id)
      .single()
      .then(({ data, error }) => {
        if (data?.flow) {
          setFlow(data.flow)
        } else {
          setFlow({ name: 'Fluxo Principal', nodes: [] })
        }
        setLoading(false)
      })
  }, [bot.id])

  async function saveFlow() {
    if (!flow) return
    setSaving(true)
    await supabase
      .from('bots')
      .update({ flow, updated_at: new Date().toISOString() })
      .eq('id', bot.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveRename() {
    setRenaming(true)
    await supabase
      .from('bots')
      .update({ name: botName, updated_at: new Date().toISOString() })
      .eq('id', bot.id)
    setRenaming(false)
    onSaved?.()
  }

  async function toggleStatus() {
    const newStatus = botStatus === 'active' ? 'inactive' : 'active'
    setBotStatus(newStatus)
    await supabase
      .from('bots')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', bot.id)
    onSaved?.()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflow: 'auto', padding: '20px',
    }} onClick={onClose}>
      <div
        className="ark-card"
        style={{ width: '100%', maxWidth: 1100, padding: 0, overflow: 'hidden', marginTop: 10 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header do modal */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid rgba(79,142,247,0.12)',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, background: botStatus === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.1)',
            }}>
              {botStatus === 'active' ? '🟢' : '⚪'}
            </div>
            <div>
              <input
                value={botName}
                onChange={e => setBotName(e.target.value)}
                style={{
                  background: 'transparent', border: '1px solid transparent', borderRadius: 6,
                  padding: '4px 8px', color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none',
                  fontFamily: 'inherit', minWidth: 180,
                }}
                onFocus={e => { e.target.style.border = '1px solid rgba(79,142,247,0.3)'; e.target.style.background = '#12121f' }}
                onBlur={e => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; saveRename() }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
              />
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                {tenantName} {bot.phone_number_id ? ' · 📱 conectado' : ' · sem número'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={toggleStatus} className="ark-btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}>
              {botStatus === 'active' ? '⏸️ Pausar' : '▶️ Ativar'}
            </button>
            <button onClick={() => setShowTutorial(true)} className="ark-btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}>
              🧭 Tutorial
            </button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
              fontSize: 22, padding: '4px 8px', lineHeight: 1,
            }}>×</button>
          </div>
        </div>

        {/* Toolbar do flow editor */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 24px', borderBottom: '1px solid rgba(79,142,247,0.08)',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <AIGenerateButton
              botId={bot.id}
              hasExistingFlow={(flow?.nodes?.length || 0) > 0}
              onGenerated={generated => setFlow(generated)}
            />
            <JsonTools flow={flow} onChange={setFlow} />
          </div>
          <button onClick={saveFlow} className="ark-btn" disabled={saving || loading}>
            {saving ? 'Salvando…' : saved ? '✅ Salvo!' : '💾 Salvar fluxo'}
          </button>
        </div>

        {/* Flow editor */}
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div className="ark-spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#64748b', fontSize: 13 }}>Carregando fluxo…</p>
            </div>
          ) : showTutorial ? (
            <Tutorial onClose={() => setShowTutorial(false)} />
          ) : (
            <div style={{ padding: 8 }}>
              <FlowEditor flow={flow} onChange={setFlow} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
