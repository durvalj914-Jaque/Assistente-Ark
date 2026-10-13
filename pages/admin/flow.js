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
  const [seasonal, setSeasonal] = useState(null)      // { catalog, subscriptions }
  const [seasonalBusy, setSeasonalBusy] = useState(null)
  const [tenantProducts, setTenantProducts] = useState([])
  const [schedEdits, setSchedEdits] = useState({})    // { [flowId]: { start_md, end_md, featured: [ids] } }

  async function loadSeasonal() {
    if (!tenant) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/seasonal/catalog', {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const d = await r.json()
      if (r.ok) setSeasonal(d)
    } catch (_) {}
  }

  function editSched(flowId, patch) {
    setSchedEdits(prev => {
      const cur = prev[flowId] || initSched(flowId)
      return { ...prev, [flowId]: { ...cur, ...patch } }
    })
  }

  async function saveSched(flowId) {
    const ed = schedEdits[flowId] || initSched(flowId)
    setSeasonalBusy(flowId + 'update')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/seasonal/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'update', bot_id: selectedBotId, seasonal_flow_id: flowId, custom_start_md: ed.start_md, custom_end_md: ed.end_md, featured_product_ids: ed.featured }),
      })
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Erro ao salvar') }
      else await loadSeasonal()
    } catch (_) {} finally { setSeasonalBusy(null) }
  }

  async function seasonalAction(action, flowId) {
    if (!selectedBotId) return
    setSeasonalBusy(flowId + action)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/seasonal/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action, bot_id: selectedBotId, seasonal_flow_id: flowId }),
      })
      await loadSeasonal()
    } catch (_) {} finally { setSeasonalBusy(null) }
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/assistente-ark/entrar')
  }, [user, loading])

  useEffect(() => {
    if (bots.length && !selectedBotId) setSelectedBotId(bots[0].id)
    loadSeasonal()
    if (tenant) {
      supabase.from('products').select('id,name,is_active').eq('tenant_id', tenant.id).eq('is_active', true).limit(30)
        .then(({ data }) => setTenantProducts(data || []))
    }
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

  // estado inicial de edição da agenda de um fluxo (usa o que a adesão já tem)
  function initSched(flowId) {
    const f = seasonal?.catalog?.find(c => c.id === flowId)
    const sub = seasonal?.subscriptions?.find(x => x.seasonal_flow_id === flowId && x.bot_id === selectedBotId)
    return {
      start_md: (schedEdits[flowId]?.start_md) || sub?.custom_start_md || f?.start_md || '',
      end_md: (schedEdits[flowId]?.end_md) || sub?.custom_end_md || f?.end_md || '',
      featured: (schedEdits[flowId]?.featured) || sub?.featured_product_ids || [],
    }
  }

  const meses = { 1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez' }
  const mdToBR = (md) => { if (!md) return ''; const [m, d] = md.split('-'); return `${d}/${m}` }
  const brToMd = (br) => {
    const m = (br || '').match(/^(\d{1,2})\/(\d{1,2})$/)
    if (!m) return ''
    return String(Number(m[2])).padStart(2, '0') + '-' + String(Number(m[1])).padStart(2, '0')
  }

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
      {/* ── Fluxos Sazonais: adesão por data comemorativa, ativação automática ── */}
      <div className="ark-card" style={{ marginTop: 24 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>🗓️ Fluxos Sazonais {selectedBotId ? `· ${bots.find(b => b.id === selectedBotId)?.name}` : ''}</h3>
        <p style={{ color: '#64748b', fontSize: 12, marginBottom: 16 }}>
          Fluxos especiais de datas comemorativas. Ao aderir, o fluxo <b style={{ color: '#94a3b8' }}>liga sozinho na janela da data</b> e volta ao fluxo normal depois — seu menu padrão fica intacto.
        </p>
        {seasonal?.catalog?.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
            {seasonal.catalog.map(f => {
              const sub = seasonal.subscriptions?.find(s => s.seasonal_flow_id === f.id && s.bot_id === selectedBotId)
              const active = sub?.status === 'active'
              const mdLabel = (md) => { const [m, d] = md.split('-'); return `${d} ${meses[Number(m)]}` }
              return (
                <div key={f.id} style={{ padding: '16px', borderRadius: 12, border: `1px solid ${active ? 'rgba(16,185,129,0.4)' : 'var(--border-soft)'}`, background: active ? 'rgba(16,185,129,0.05)' : 'var(--bg-secondary, rgba(255,255,255,0.03))', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 22 }}>{f.emoji}</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>{f.name}</div>
                  <div style={{ color: '#64748b', fontSize: 11 }}>🗓️ Ativa de {mdLabel(f.start_md)} a {mdLabel(f.end_md)}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12, flex: 1 }}>{f.description}</div>
                  {sub ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(() => {
                        const ed = schedEdits[f.id] || initSched(f.id)
                        const toggleFeat = (pid) => editSched(f.id, { featured: ed.featured.includes(pid) ? ed.featured.filter(x => x !== pid) : [...ed.featured, pid] })
                        return (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>🗓️ ATIVA DE</span>
                              <input value={mdToBR(ed.start_md)} onChange={e => editSched(f.id, { start_md: brToMd(e.target.value) })}
                                placeholder="08/10" style={{ width: 64, padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }} />
                              <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>ATÉ</span>
                              <input value={mdToBR(ed.end_md)} onChange={e => editSched(f.id, { end_md: brToMd(e.target.value) })}
                                placeholder="13/10" style={{ width: 64, padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'center' }} />
                              <span style={{ color: '#334155', fontSize: 10 }}>(dd/mm — todo ano)</span>
                            </div>
                            {tenantProducts.length > 0 && (
                              <div>
                                <span style={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>🌟 PRODUTOS EM DESTAQUE NO TOPO DO CATÁLOGO</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                  {tenantProducts.map(pr => {
                                    const on = ed.featured.includes(pr.id)
                                    return (
                                      <button key={pr.id} onClick={() => toggleFeat(pr.id)} type="button"
                                        style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                                          border: `1px solid ${on ? 'rgba(251,191,36,0.5)' : 'var(--border-soft)'}`,
                                          background: on ? 'rgba(251,191,36,0.12)' : 'transparent',
                                          color: on ? '#fbbf24' : '#94a3b8', fontWeight: on ? 700 : 400 }}>
                                        {on ? '★ ' : ''}{pr.name}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button onClick={() => saveSched(f.id)} disabled={seasonalBusy === f.id + 'update'}
                                style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                  border: '1px solid rgba(79,142,247,0.4)', background: 'rgba(79,142,247,0.08)', color: '#4f8ef7' }}>
                                💾 Salvar agenda
                              </button>
                              <button onClick={() => seasonalAction('toggle', f.id)} disabled={seasonalBusy === f.id + 'toggle'}
                                style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                  border: active ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.4)',
                                  background: active ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.08)',
                                  color: active ? '#ef4444' : '#10b981' }}>
                                {active ? '⏸️ Desativar adesão' : '▶️ Ativar adesão'}
                              </button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <button onClick={() => seasonalAction('acquire', f.id)} disabled={seasonalBusy === f.id + 'acquire'}
                      style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                        border: '1px solid rgba(79,142,247,0.4)', background: 'rgba(79,142,247,0.08)', color: '#4f8ef7' }}>
                      ✨ Aderir ao fluxo{f.price > 0 ? ` (R$ ${Number(f.price).toFixed(2).replace('.', ',')})` : ''}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: 13 }}>Nenhum fluxo sazonal disponível no momento.</div>
        )}
      </div>

    </AdminLayout>
  )
}
