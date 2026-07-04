/**
 * POST /api/admin/update-client
 * Atualiza plano/status de um tenant e/ou conecta as credenciais do WhatsApp
 * num bot dele. Substitui as escritas diretas via supabase-js que existiam
 * antes no Painel Arkiel (essas falhavam silenciosamente pra qualquer tenant
 * que não fosse o da própria equipe Arkiel, porque a tabela `bots`/`tenants`
 * não libera escrita por RLS pra admin de plataforma — só esse endpoint,
 * rodando com a service role, consegue).
 * Body: { tenant_id, plan?, status?, bot_id?, phone_number_id?, waba_id?, access_token? }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

const VALID_PLANS = ['free', 'starter', 'pro', 'enterprise']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const { tenant_id, plan, status, bot_id, phone_number_id, waba_id, access_token } = req.body || {}
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

  if (plan || status) {
    const patch = {}
    if (plan) {
      if (!VALID_PLANS.includes(plan)) return res.status(400).json({ error: 'Plano inválido' })
      patch.plan = plan
    }
    if (status) patch.status = status
    const { error } = await db.from('tenants').update(patch).eq('id', tenant_id)
    if (error) return res.status(500).json({ error: 'Erro ao atualizar empresa: ' + error.message })
  }

  if (bot_id && (phone_number_id || waba_id || access_token)) {
    const patch = { status: 'active' }
    if (phone_number_id) patch.phone_number_id = phone_number_id
    if (waba_id) patch.waba_id = waba_id
    if (access_token) patch.access_token = access_token
    const { error } = await db.from('bots').update(patch).eq('id', bot_id).eq('tenant_id', tenant_id)
    if (error) return res.status(500).json({ error: 'Erro ao conectar bot: ' + error.message })
  }

  return res.status(200).json({ ok: true })
}
