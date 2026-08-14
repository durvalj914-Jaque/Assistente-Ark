/**
 * POST /api/whatsapp/migrate-number
 * Migra um phone_number_id da WABA compartilhada para o bot de um tenant específico.
 * Usa service role (admin) para acessar/modificar dados de qualquer tenant.
 * 
 * Body: { phone_number_id, target_tenant_id, verified_name? }
 * Header: Authorization: Bearer <supabase_session_token> (requer platform_admin)
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { phone_number_id, target_tenant_id, verified_name } = req.body || {}
  if (!phone_number_id || !target_tenant_id) {
    return res.status(400).json({ error: 'phone_number_id e target_tenant_id são obrigatórios' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')

  // Verificar autenticação
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Verificar se é platform_admin
  const { data: profile } = await db.from('profiles')
    .select('platform_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.platform_admin) {
    return res.status(403).json({ error: 'Apenas administradores da plataforma podem migrar números' })
  }

  // Verificar se o target_tenant_id existe
  const { data: tenant, error: tenantErr } = await db.from('tenants')
    .select('id, name')
    .eq('id', target_tenant_id)
    .maybeSingle()
  if (tenantErr || !tenant) {
    return res.status(404).json({ error: 'Tenant de destino não encontrado' })
  }

  // Verificar se o número está ativo na Meta
  const metaToken = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
  let metaInfo = null
  if (metaToken) {
    try {
      const metaResp = await fetch(`https://graph.facebook.com/v25.0/${phone_number_id}?fields=verified_name,display_phone_number,code_verification_status,platform_type`, {
        headers: { Authorization: `Bearer ${metaToken}` }
      })
      metaInfo = await metaResp.json()
      if (metaInfo.error) {
        return res.status(400).json({ error: 'Número não encontrado na Meta', detail: metaInfo.error.message })
      }
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao consultar Meta', detail: e.message })
    }
  }

  // Verificar se já existe um bot para o tenant de destino
  const { data: existingBot } = await db.from('bots')
    .select('id, name, phone_number_id, status')
    .eq('tenant_id', target_tenant_id)
    .maybeSingle()

  let botId
  const botName = verified_name || metaInfo?.verified_name || 'Bot Arkiel'

  if (existingBot) {
    // Atualizar o bot existente
    const { data: updated, error: updateErr } = await db.from('bots')
      .update({
        phone_number_id,
        waba_id: process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798',
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingBot.id)
      .select('id')

    if (updateErr) return res.status(500).json({ error: 'Erro ao atualizar bot', detail: updateErr.message })
    botId = existingBot.id
  } else {
    // Criar um novo bot para o tenant
    const newBotId = crypto.randomUUID()
    const { data: created, error: createErr } = await db.from('bots').insert({
      id: newBotId,
      tenant_id: target_tenant_id,
      name: botName,
      phone_number_id,
      waba_id: process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798',
      status: 'active',
      flow: { nodes: [{ id: 'root', type: 'menu', text: 'Olá! Como posso ajudar?', options: [] }] },
    }).select('id')

    if (createErr) return res.status(500).json({ error: 'Erro ao criar bot', detail: createErr.message })
    botId = newBotId
  }

  // Desvincular o número de qualquer outro bot que o tenha
  const { error: unlinkErr } = await db.from('bots')
    .update({ phone_number_id: null, status: 'inactive' })
    .neq('id', botId)
    .eq('phone_number_id', phone_number_id)

  return res.status(200).json({
    ok: true,
    message: `Número ${metaInfo?.display_phone_number || phone_number_id} migrado para o tenant ${tenant.name}`,
    bot_id: botId,
    tenant: tenant.name,
    meta_info: metaInfo,
    existing_bot: !!existingBot,
  })
}
