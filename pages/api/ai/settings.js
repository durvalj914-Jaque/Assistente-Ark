// ── /api/ai/settings — config da IA por tenant (aba "IA") ──────────────────
// GET  → config SEM a chave (has_key true/false)
// PUT  → salva/upsert (criptografa a chave AES-256-GCM, nunca devolve)
// POST { action: 'clear_key' } → apaga a chave

import { supabaseAdmin } from '../../../lib/supabase'
import { requireTenant } from '../../../lib/serverAuth'
import { encryptSecret } from '../../../lib/aiSecret'
import { getProvider, AI_PROVIDERS } from '../../../lib/aiProviders'

export default async function handler(req, res) {
  const auth = await requireTenant(req, res)
  if (!auth) return
  const tenantId = auth.tenant_id
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data } = await db.from('ai_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
    if (!data) return res.json({ ai_settings: null, providers: AI_PROVIDERS })
    return res.json({
      ai_settings: {
        enabled: data.enabled,
        provider: data.provider,
        model: data.model,
        has_key: !!data.api_key_encrypted,
        custom_base_url: data.custom_base_url,
        persona_instructions: data.persona_instructions,
        temperature: Number(data.temperature ?? 0.4),
        max_tokens: data.max_tokens,
        ai_handled_count: data.ai_handled_count,
        last_test_ok: data.last_test_ok,
        last_test_at: data.last_test_at,
      },
      providers: AI_PROVIDERS,
    })
  }

  if (req.method === 'PUT') {
    const b = req.body || {}
    const updates = {}

    if (typeof b.enabled === 'boolean') updates.enabled = b.enabled
    if (b.provider !== undefined) {
      const p = getProvider(b.provider)
      if (!p) return res.status(400).json({ error: 'Provedor não suportado' })
      updates.provider = p.id
      if (b.model === undefined || b.model === null || b.model === '') updates.model = p.defaultModel
    }
    if (typeof b.model === 'string' && b.model.trim()) updates.model = b.model.trim().substring(0, 120)
    if (b.api_key !== undefined) {
      // string vazia → mantém a chave existente; valor novo → criptografa
      if (typeof b.api_key === 'string' && b.api_key.trim()) {
        updates.api_key_encrypted = encryptSecret(b.api_key.trim())
      }
    }
    if (b.clear_key === true) updates.api_key_encrypted = null
    if (b.custom_base_url !== undefined) {
      updates.custom_base_url = typeof b.custom_base_url === 'string' ? b.custom_base_url.trim().substring(0, 300) : null
    }
    if (b.persona_instructions !== undefined) {
      updates.persona_instructions = typeof b.persona_instructions === 'string' ? b.persona_instructions.substring(0, 2000) : null
    }
    if (b.temperature !== undefined) {
      const t = Number(b.temperature)
      updates.temperature = isNaN(t) ? 0.4 : Math.max(0, Math.min(1, t))
    }
    if (b.max_tokens !== undefined) {
      const mt = parseInt(b.max_tokens, 10)
      updates.max_tokens = isNaN(mt) ? 600 : Math.max(100, Math.min(4000, mt))
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada para atualizar' })

    updates.updated_at = new Date().toISOString()
    updates.tenant_id = tenantId

    const { data: existing } = await db.from('ai_settings').select('id').eq('tenant_id', tenantId).maybeSingle()
    let row
    if (existing?.id) {
      const r = await db.from('ai_settings').update(updates).eq('id', existing.id).select().single()
      row = r.data
      if (r.error) return res.status(500).json({ error: 'Falha ao salvar: ' + r.error.message })
    } else {
      const r = await db.from('ai_settings').insert(updates).select().single()
      row = r.data
      if (r.error) return res.status(500).json({ error: 'Falha ao salvar: ' + r.error.message })
    }

    return res.json({ ok: true, enabled: row.enabled, has_key: !!row.api_key_encrypted })
  }

  if (req.method === 'POST' && req.body?.action === 'clear_key') {
    await db.from('ai_settings').update({ api_key_encrypted: null, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId)
    return res.json({ ok: true })
  }

  res.setHeader('Allow', 'GET, PUT, POST')
  return res.status(405).json({ error: 'Método não permitido' })
}
