import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import SectionHelp from '../../components/Tutorial/SectionHelp'
import { API_DOC_CATEGORIES, countEndpoints, AUTH_LABELS, METHOD_COLORS } from '../../lib/apiDocs'

export default function ApiPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [apiKey, setApiKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [query, setQuery] = useState('')
  const [showInternal, setShowInternal] = useState(false)

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])
  useEffect(() => {
    if (!tenant) return
    if (tenant.api_key) { setApiKey(tenant.api_key); return }
    // Tenant sem chave (caso raro): gera automaticamente via RPC segura
    supabase.rpc('regenerate_api_key', { p_tenant: tenant.id }).then(({ data, error }) => {
      if (!error && data) setApiKey(data)
    })
  }, [tenant?.id, tenant?.api_key])

  async function regenerate() {
    if (!confirm('Isso vai invalidar a chave atual. Qualquer integração usando a chave antiga vai parar de funcionar. Continuar?')) return
    setRegenerating(true)
    const { data: newKey, error } = await supabase.rpc('regenerate_api_key', { p_tenant: tenant.id })
    setRegenerating(false)
    if (!error && newKey) setApiKey(newKey)
    else alert('Não foi possível gerar a chave. Tente novamente.')
  }

  function copyKey() {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !user || !tenant) return null

  const snippet = `curl -X POST https://arkiel.com.br/api/v1/send \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "5511999999999", "message": "Olá! Essa mensagem veio pela API."}'`

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <h1 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 20, marginBottom: 8 }}>🔌 API</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24, maxWidth: 640 }}>
        Use sua chave pra enviar mensagens de WhatsApp pelo bot ativo da sua empresa a partir de qualquer sistema seu.
      </p>

      <div style={{ display: 'grid', gap: 20, maxWidth: 700 }}>
        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 14, fontSize: 14 }}>🔑 Sua chave de API<SectionHelp t='api' s='chave' /></h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={apiKey} className="ark-input" style={{ fontFamily: 'monospace', fontSize: 12 }} />
            <button onClick={copyKey} className="ark-btn" style={{ whiteSpace: 'nowrap' }}>{copied ? '✅ Copiado' : 'Copiar'}</button>
          </div>
          {(role === 'owner' || role === 'admin') && (
            <button onClick={regenerate} disabled={regenerating}
              style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', padding: '8px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {regenerating ? 'Gerando...' : '🔄 Gerar nova chave'}
            </button>
          )}
        </div>

        <div className="ark-card">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 14, fontSize: 14 }}>📘 Como usar<SectionHelp t='api' s='como-usar' /></h3>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>Envie um POST pra <code style={{ color: '#4f8ef7' }}>/api/v1/send</code> com sua chave no cabeçalho <code style={{ color: '#4f8ef7' }}>Authorization</code>:</p>
          <pre style={{ background: '#12121f', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 8, padding: 14, color: '#cbd5e1', fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{snippet}</pre>
          <p style={{ color: '#334155', fontSize: 11, marginTop: 10 }}>A mensagem sai pelo primeiro bot ativo da sua conta e aparece normalmente em Conversas.</p>
        </div>

        <div className="ark-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>📖 Documentação de Endpoints</h3>
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 12 }}>Referência completa dos {countEndpoints()} endpoints da plataforma, agrupados por área. Clique num caminho pra copiar.</p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔎 Buscar endpoint, descrição ou categoria..."
            className="ark-input"
            style={{ width: '100%', marginBottom: 14 }}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowInternal(!showInternal)}
              style={{
                padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: showInternal ? 'rgba(167,139,250,0.15)' : 'transparent',
                border: `1px solid ${showInternal ? 'rgba(167,139,250,0.4)' : 'rgba(148,163,184,0.25)'}`,
                color: showInternal ? '#a78bfa' : '#94a3b8',
              }}
            >
              {showInternal ? '👁️ Internos visíveis' : '🔒 Mostrar internos (equipe)'}
            </button>
            <span style={{ color: '#64748b', fontSize: 11 }}>Autenticação:</span>
            {Object.entries(AUTH_LABELS).map(([k, v]) => (
              <span key={k} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, color: v.color, border: `1px solid ${v.color}55`, background: `${v.color}11` }}>{v.label}</span>
            ))}
          </div>

          {API_DOC_CATEGORIES
            .filter((c) => (showInternal || (c.id !== 'internal' && c.id !== 'maintenance')))
            .map((cat) => {
              const eps = cat.endpoints.filter((e) =>
                !query || (
                  e.p.toLowerCase().includes(query.toLowerCase()) ||
                  e.d.toLowerCase().includes(query.toLowerCase()) ||
                  cat.title.toLowerCase().includes(query.toLowerCase())
                )
              )
              if (!eps.length) return null
              return (
                <div key={cat.id} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 15 }}>{cat.icon}</span>
                    <b style={{ color: 'var(--text-primary)', fontSize: 13 }}>{cat.title}</b>
                    <span style={{ color: '#475569', fontSize: 10, background: 'rgba(148,163,184,0.12)', padding: '1px 8px', borderRadius: 99 }}>{eps.length}</span>
                  </div>
                  <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 8px 23px' }}>{cat.desc}</p>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {eps.map((e) => {
                      const first = e.m.split('+')[0]
                      return (
                        <div key={e.p + e.m} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '7px 10px', borderRadius: 8, background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.08)' }}>
                          <b style={{ fontSize: 10, letterSpacing: 0.4, color: METHOD_COLORS[first] || '#94a3b8', minWidth: 42 }}>{e.m}</b>
                          <code
                            onClick={() => { navigator.clipboard.writeText(e.p) }}
                            style={{ fontSize: 12, color: '#4f8ef7', cursor: 'pointer' }}
                            title="Clique pra copiar"
                          >{e.p}</code>
                          <span style={{ color: '#94a3b8', fontSize: 11, flex: 1, minWidth: 180 }}>{e.d}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, color: AUTH_LABELS[e.a].color, border: `1px solid ${AUTH_LABELS[e.a].color}44`, background: `${AUTH_LABELS[e.a].color}11` }}>{AUTH_LABELS[e.a].label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </AdminLayout>
  )
}
