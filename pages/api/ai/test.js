// ── /api/ai/test — testa a chave/modelo do provedor escolhido (aba "IA") ────
// POST { tenant_id, api_key? } — testa a chave salva OU uma chave nova
// (sem salvar), pra o B2B validar antes de ativar.

import { supabaseAdmin } from '../../../lib/supabase'
import { requireTenant, rateLimit } from '../../../lib/serverAuth'
import { decryptSecret } from '../../../lib/aiSecret'
import { testProviderConnection, getProvider } from '../../../lib/aiProviders'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Método não permitido' })
  }
  const auth = await requireTenant(req, res)
  if (!auth) return
  if (!rateLimit(`ai-test-${auth.tenant_id}`, 10, 60000)) {
    return res.status(429).json({ error: 'Muitos testes em sequência — aguarde um minuto' })
  }
  const tenantId = auth.tenant_id
  const db = supabaseAdmin()
  const b = req.body || {}

  const { data: settings } = await db.from('ai_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
  if (!settings) return res.status(400).json({ error: 'Salve a configuração antes de testar' })

  const provider = getProvider(b.provider || settings.provider)
  if (!provider) return res.status(400).json({ error: 'Provedor não suportado' })

  const apiKey = (typeof b.api_key === 'string' && b.api_key.trim()) ? b.api_key.trim() : decryptSecret(settings.api_key_encrypted)
  if (!apiKey) return res.status(400).json({ error: 'Nenhuma chave API configurada' })

  const model = b.model || settings.model || provider.defaultModel
  const customBaseUrl = b.custom_base_url ?? settings.custom_base_url

  try {
    const result = await testProviderConnection({ provider: provider.id, apiKey, model, customBaseUrl })
    await db.from('ai_settings').update({ last_test_ok: true, last_test_at: new Date().toISOString() }).eq('tenant_id', tenantId)
    return res.json({ ok: true, latency_ms: result.latency_ms, model, provider: provider.label })
  } catch (e) {
    await db.from('ai_settings').update({ last_test_ok: false, last_test_at: new Date().toISOString() }).eq('tenant_id', tenantId)
    return res.status(502).json({ error: e?.message || 'Falha na conexão com o provedor' })
  }
}
