import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Painel de saúde de um número conectado (aba Conectar WhatsApp):
 * qualidade Meta, limite de envio/24h, nome verificado — direto da Graph API.
 * Um card por bot conectado (multi-número).
 */
export default function NumberHealthCard({ bot }) {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/whatsapp/number-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ bot_id: bot.id }),
      })
      const d = await r.json()
      setHealth(r.ok ? { ...d, ok: true } : { ok: false, error: d.error })
    } catch (_) {
      setHealth({ ok: false, error: 'Falha ao consultar a Meta' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [bot.id])

  return (
    <div className="ark-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, margin: 0 }}>📊 Saúde do número · {bot.name}</h3>
        <button onClick={load} disabled={loading}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? '⏳' : '🔄 Atualizar'}
        </button>
      </div>
      {loading && !health && <div style={{ color: '#64748b', fontSize: 13 }}>Consultando a Meta…</div>}
      {health?.ok === false && <div style={{ color: '#ef4444', fontSize: 13 }}>❌ {health.error || 'Não foi possível obter os dados agora.'}</div>}
      {health?.ok && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary, rgba(255,255,255,0.03))', border: '1px solid var(--border-soft)' }}>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>NÚMERO</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{health.number || '—'}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{health.verified_name}</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary, rgba(255,255,255,0.03))', border: '1px solid var(--border-soft)' }}>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>QUALIDADE (META)</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: health.quality.code === 'GREEN' ? '#10b981' : health.quality.code === 'YELLOW' ? '#f59e0b' : '#ef4444' }}>
              {health.quality.emoji} {health.quality.label}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{health.quality.desc}</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary, rgba(255,255,255,0.03))', border: '1px solid var(--border-soft)' }}>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>LIMITE DE ENVIO</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{health.messaging_limit}</div>
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>conversas iniciadas por 24h</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary, rgba(255,255,255,0.03))', border: '1px solid var(--border-soft)' }}>
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>NOME VERIFICADO</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{health.name_status}</div>
          </div>
        </div>
      )}
      <div style={{ marginTop: 12, color: '#64748b', fontSize: 12 }}>
        💡 Quer conferir que tá tudo certo? Manda um <b style={{ color: '#94a3b8' }}>Oi</b> pro seu próprio número no WhatsApp — o bot responde na hora.
      </div>
    </div>
  )
}
