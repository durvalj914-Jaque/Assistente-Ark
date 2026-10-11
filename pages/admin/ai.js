import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

const labelStyle = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }
}

export default function AIPage() {
  const { tenant, loading, bots } = useTenant()
  const [settings, setSettings] = useState(null)
  const [providers, setProviders] = useState([])
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState(null)

  const [form, setForm] = useState({
    enabled: false, provider: 'openai', model: '',
    persona_instructions: '', temperature: 0.4, max_tokens: 600, custom_base_url: '',
  })
  const [customModel, setCustomModel] = useState(false)

  const load = useCallback(async () => {
    if (!tenant?.id) return
    try {
      const res = await fetch(`/api/ai/settings?tenant_id=${tenant.id}`, { headers: await authHeaders() })
      const json = await res.json()
      setProviders(json.providers || [])
      if (json.ai_settings) {
        setForm({
          enabled: json.ai_settings.enabled,
          provider: json.ai_settings.provider,
          model: json.ai_settings.model || '',
          persona_instructions: json.ai_settings.persona_instructions || '',
          temperature: json.ai_settings.temperature ?? 0.4,
          max_tokens: json.ai_settings.max_tokens || 600,
          custom_base_url: json.ai_settings.custom_base_url || '',
        })
        setCustomModel(!!json.ai_settings.model && !(json.providers?.find(p => p.id === json.ai_settings.provider)?.models || []).includes(json.ai_settings.model))
      }
      setSettings(json.ai_settings)
    } catch (e) {
      setMsg({ type: 'error', text: 'Falha ao carregar configuração da IA' })
    }
  }, [tenant?.id])

  useEffect(() => { load() }, [load])

  const activeProvider = providers.find(p => p.id === form.provider)
  const hasBot = bots?.some(b => b.status === 'active')

  async function save(partial = null) {
    if (!tenant?.id) return
    setSaving(true); setMsg(null)
    try {
      const body = partial || { ...form, ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}) }
      const res = await fetch('/api/ai/settings', {
        method: 'PUT', headers: await authHeaders(),
        body: JSON.stringify({ ...body, tenant_id: tenant.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar')
      setMsg({ type: 'success', text: 'Configuração salva ✓' })
      setApiKey('')
      await load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setSaving(false)
  }

  async function test() {
    if (!tenant?.id) return
    setTesting(true); setMsg(null)
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({
          tenant_id: tenant.id,
          ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
          provider: form.provider, model: form.model, custom_base_url: form.custom_base_url,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha na conexão')
      setMsg({ type: 'success', text: `✓ ${json.provider} respondeu em ${json.latency_ms}ms (modelo ${json.model})` })
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setTesting(false)
  }

  async function clearKey() {
    if (!confirm('Remover a chave API salva? A IA para de responder até você salvar uma nova chave.')) return
    await fetch('/api/ai/settings', {
      method: 'POST', headers: await authHeaders(),
      body: JSON.stringify({ tenant_id: tenant.id, action: 'clear_key' }),
    })
    setMsg({ type: 'success', text: 'Chave removida' })
    await load()
  }

  if (loading) return <AdminLayout><div style={{ padding: 40, color: '#64748b' }}>Carregando…</div></AdminLayout>

  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>

        {/* ── Card principal ── */}
        <div style={{ background: 'var(--card, #fff)', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>🧠 IA do seu bot</h2>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0 0' }}>
                Conecte a inteligência artificial da sua preferência usando a sua própria chave API.
                Quando o cliente enviar uma mensagem que não está no menu, a IA responde conhecendo seu catálogo, serviços e horários.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={!!form.enabled}
                onChange={e => { const v = e.target.checked; setForm(f => ({ ...f, enabled: v })); save({ enabled: v }) }}
                style={{ width: 18, height: 18 }} />
              {form.enabled ? 'IA ativada' : 'IA desativada'}
            </label>
          </div>

          {!hasBot && (
            <div style={{ marginTop: 14, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 10, fontSize: 13 }}>
              ⚠️ Nenhum bot ativo encontrado. Conecte seu WhatsApp em <b>Conectar WhatsApp</b> para a IA atender.
            </div>
          )}

          {msg && (
            <div style={{ marginTop: 14, padding: 10, borderRadius: 8, fontSize: 13,
              background: msg.type === 'success' ? '#dcfce7' : '#fee2e2', color: msg.type === 'success' ? '#166534' : '#991b1b' }}>
              {msg.text}
            </div>
          )}

          {/* Provedor */}
          <div style={{ marginTop: 20 }}>
            <label style={labelStyle}>PROVEDOR DE IA</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
              {providers.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { setForm(f => ({ ...f, provider: p.id, model: p.defaultModel })); setCustomModel(false) }}
                  style={{
                    padding: '10px 12px', borderRadius: 10, border: form.provider === p.id ? '2px solid #10b981' : '1px solid #e2e8f0',
                    background: form.provider === p.id ? '#ecfdf5' : 'transparent', cursor: 'pointer', textAlign: 'left',
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{p.note}</div>
                </button>
              ))}
            </div>
            {activeProvider && (
              <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0 0' }}>
                Pegue sua chave em <a href={activeProvider.keyUrl} target="_blank" rel="noreferrer" style={{ color: '#059669' }}>{activeProvider.keyUrl}</a>
              </p>
            )}
          </div>

          {/* Chave API */}
          <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                CHAVE API {settings?.has_key && <span style={{ color: '#10b981' }}>✓ salva</span>}
              </label>
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder={settings?.has_key ? '•••••••• (deixe vazio para manter a atual)' : (activeProvider?.id === 'ollama' ? 'Chave (opcional p/ Ollama)' : 'Cole sua chave API aqui')}
                className="ark-input" autoComplete="off" />
              <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0 0' }}>
                🔒 A chave é criptografada e guardada com segurança — nunca aparece na tela nem no histórico.
              </p>
            </div>
            <button type="button" onClick={() => setShowKey(s => !s)}
              style={{ alignSelf: 'flex-end', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          {settings?.has_key && (
            <button type="button" onClick={clearKey}
              style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
              Remover chave salva
            </button>
          )}

          {/* URL do Ollama */}
          {activeProvider?.needsBaseUrl && (
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>URL DO SEU SERVIDOR OLLAMA (pública)</label>
              <input value={form.custom_base_url} onChange={e => setForm(f => ({ ...f, custom_base_url: e.target.value }))}
                placeholder="http://seu-servidor.com:11434" className="ark-input" />
            </div>
          )}

          {/* Modelo */}
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>MODELO</label>
            {customModel ? (
              <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                placeholder="nome exato do modelo no provedor" className="ark-input" />
            ) : (
              <select className="ark-input" value={form.model || activeProvider?.defaultModel || ''}
                onChange={e => { if (e.target.value === '__custom__') { setCustomModel(true); setForm(f => ({ ...f, model: '' })); return } setForm(f => ({ ...f, model: e.target.value })) }}>
                {(activeProvider?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">Outro modelo (digitar)…</option>
              </select>
            )}
          </div>

          {/* Persona */}
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>INSTRUÇÕES EXTRAS (OPCIONAL)</label>
            <textarea value={form.persona_instructions} onChange={e => setForm(f => ({ ...f, persona_instructions: e.target.value }))}
              placeholder="Ex: Somos uma barbearia familiar, tom descontraído. Nunca oferte desconto. Se pedirem corte infantil, fale da Bianca."
              rows={3} className="ark-input" style={{ resize: 'vertical' }} />
            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0 0' }}>
              A IA já conhece seu catálogo, serviços e horários automaticamente. Aqui você define tom e regras do negócio.
            </p>
          </div>

          {/* Ações */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => save()} disabled={saving}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'Salvando…' : 'Salvar configuração'}
            </button>
            <button onClick={test} disabled={testing}
              style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #10b981', background: 'transparent', color: '#059669', fontWeight: 700, cursor: 'pointer' }}>
              {testing ? 'Testando…' : '⚡ Testar conexão'}
            </button>
          </div>
        </div>

        {/* ── Como funciona ── */}
        <div style={{ background: 'var(--card, #fff)', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, fontSize: 13, color: '#334155' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>Como a IA funciona no seu bot</h3>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li>O menu numerado continua mandando: <b>1, 2, 3…</b> navegam normalmente e <b>0</b> volta ao menu.</li>
            <li>Quando o cliente manda uma mensagem <b>fora do menu</b> (uma pergunta livre), a IA responde por cima.</li>
            <li>A IA conhece seus <b>produtos com preços</b>, <b>serviços de agendamento</b> e <b>horários de atendimento</b> — atualizados do painel.</li>
            <li>Ela nunca inventa preço ou prazo: sem certeza, chama o atendimento humano (palavra <b>humano</b>).</li>
            <li>Se o provedor falhar (chave inválida, sem crédito), o bot volta ao comportamento normal sozinho.</li>
          </ol>
          {settings?.ai_handled_count > 0 && (
            <p style={{ marginTop: 12, marginBottom: 0, color: '#059669', fontWeight: 600 }}>
              🤖 A IA já respondeu {settings.ai_handled_count} mensagem(ns) pelos seus clientes.
            </p>
          )}
        </div>

      </div>
    </AdminLayout>
  )
}
