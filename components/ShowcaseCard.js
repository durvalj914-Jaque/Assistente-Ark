import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Vitrine oficial do número conectado: catálogo (produtos do painel) + perfil
 * do WhatsApp. É o que o cliente final vê ao abrir a conversa — o equivalente
 * à vitrine do WhatsApp Business App. Todo número nasce com ela pronta; este
 * card mostra o estado e permite reaplicar com um clique.
 */
export default function ShowcaseCard({ tenantId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }
  }

  async function load() {
    if (!tenantId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/whatsapp/showcase?tenant_id=${tenantId}`, { headers: await authHeader() })
      const d = await r.json()
      setData(r.ok ? d : { ok: false, error: d.error })
    } catch (_) {
      setData({ ok: false, error: 'Não foi possível consultar a vitrine agora.' })
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    if (!tenantId) return
    setBusy(true); setNotice('')
    try {
      const r = await fetch('/api/whatsapp/showcase', {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({ tenant_id: tenantId }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Falha ao atualizar a vitrine')
      const synced = d?.steps?.products?.synced
      setNotice(synced !== undefined ? `Vitrine atualizada — ${synced} produto(s) publicados.` : 'Vitrine atualizada.')
      await load()
    } catch (err) {
      setNotice('❌ ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [tenantId])

  const tile = { padding: '12px 14px', borderRadius: 10, background: 'var(--bg-secondary, rgba(255,255,255,0.03))', border: '1px solid var(--border-soft)' }
  const label = { color: '#64748b', fontSize: 11, fontWeight: 700, marginBottom: 4 }

  const products = data?.products
  const visible = data?.catalog_visible_on_profile
  const profileOk = data?.profile_issues && data.profile_issues.length === 0

  return (
    <div className="ark-card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14, margin: 0 }}>🛍️ Vitrine oficial do WhatsApp</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-soft)', background: 'transparent', color: '#4f8ef7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {loading ? '⏳' : '🔄 Atualizar'}
          </button>
          <button onClick={refresh} disabled={busy || !data?.connected}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(37,211,102,0.4)', background: 'rgba(37,211,102,0.10)', color: '#25D366', fontSize: 12, fontWeight: 700, cursor: data?.connected ? 'pointer' : 'not-allowed' }}>
            {busy ? 'Publicando…' : 'Publicar produtos no catálogo'}
          </button>
        </div>
      </div>

      {loading && !data && <div style={{ color: '#64748b', fontSize: 13 }}>Consultando a vitrine…</div>}
      {data?.ok === false && <div style={{ color: '#ef4444', fontSize: 13 }}>❌ {data.error || 'Não foi possível consultar agora.'}</div>}

      {data?.ok && (
        <>
          {!data.connected && (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Conecte um número de WhatsApp para montar a vitrine.</div>
          )}
          {data.connected && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={tile}>
                <div style={label}>CATÁLOGO</div>
                <div style={{ color: data.catalog ? '#10b981' : '#ef4444', fontSize: 14, fontWeight: 700 }}>
                  {data.catalog ? '✅ Conectado' : '❌ Não conectado'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                  {data.catalog ? `id ${data.catalog.id}` : 'Sem catálogo na WABA'}
                </div>
              </div>

              <div style={tile}>
                <div style={label}>PRODUTOS NA VITRINE</div>
                <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 700 }}>
                  {products ? `${products.synced} de ${products.active} publicados` : '—'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                  {products && products.error > 0
                    ? `${products.error} com erro de envio à Meta`
                    : products && products.local_only > 0
                      ? `${products.local_only} ainda só no painel`
                      : 'Produtos ativos do painel aparecem no WhatsApp'}
                </div>
                {data.catalog_review && (
                  <div style={{ color: data.catalog_review.pending ? '#f59e0b' : data.catalog_review.rejected ? '#ef4444' : '#10b981', fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                    {data.catalog_review.pending
                      ? `⏳ ${data.catalog_review.pending} em análise pela Meta`
                      : data.catalog_review.rejected
                        ? `❌ ${data.catalog_review.rejected} recusado(s) pela Meta`
                        : data.catalog_review.approved
                          ? '✅ Aprovado pela Meta'
                          : '—'}
                  </div>
                )}
              </div>

              <div style={tile}>
                <div style={label}>VITRINE NO PERFIL</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: visible ? '#10b981' : (visible === false ? '#f59e0b' : '#94a3b8') }}>
                  {visible === true ? '👁️ Visível pro cliente' : visible === false ? '🙈 Oculta' : '—'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                  {visible === false
                    ? 'Aparece quando o catálogo tiver só os seus produtos — no chat o catálogo já funciona'
                    : 'Botão de catálogo no perfil do número'}
                </div>
              </div>

              <div style={tile}>
                <div style={label}>PERFIL DO WHATSAPP</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: profileOk ? '#10b981' : '#f59e0b' }}>
                  {profileOk ? '✅ Completo' : 'Falta completar'}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
                  {profileOk ? 'Foto, descrição, site e categoria' : (data.profile_issues || []).join(', ') || '—'}
                </div>
              </div>
            </div>
          )}

          {data.shared_catalog && (
            <div style={{ marginTop: 12, color: '#f59e0b', fontSize: 12, lineHeight: 1.6 }}>
              ⚠️ O catálogo da Meta é compartilhado entre os clientes da Arkiel. Para nunca mostrar produto de outro cliente,
              a vitrine no perfil fica oculta enquanto houver mais de um cliente com produtos no catálogo — dentro do chat cada
              bot mostra só os produtos do próprio negócio.
            </div>
          )}
        </>
      )}

      {notice && <div style={{ marginTop: 12, color: notice.startsWith('❌') ? '#ef4444' : '#10b981', fontSize: 12 }}>{notice}</div>}

      <div style={{ marginTop: 12, color: '#64748b', fontSize: 12 }}>
        💡 Todo número novo já nasce com a vitrine montada: perfil preenchido, catálogo conectado e os produtos do painel publicados.
      </div>
    </div>
  )
}
