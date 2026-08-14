/**
 * POST /api/whatsapp/activate-number
 * Ativa um número da WABA em um bot específico, usando service role (server-side).
 * Protegido por um secret simples (ARK_SECRET) para uso administrativo.
 *
 * Body: { phone_number_id, bot_id?, tenant_id? }
 * Query: ?secret=<ARK_SECRET>
 *
 * Se bot_id não for informado, busca o bot pelo tenant_id.
 */
import { supabaseAdmin } from '../../../lib/supabase'

const ARK_SECRET = 'ark_secret_arkiel_2025'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = req.query.secret || req.body.secret
  if (secret !== ARK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  const { phone_number_id, bot_id, tenant_id } = req.body || {}
  if (!phone_number_id) {
    return res.status(400).json({ error: 'phone_number_id é obrigatório' })
  }

  const db = supabaseAdmin()
  if (!db) return res.status(500).json({ error: 'Erro ao conectar com o banco' })

  // Re-registrar o número na Cloud API (caso esteja desregistrado)
  const metaToken = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
  let metaInfo = null
  if (metaToken) {
    try {
      const checkResp = await fetch(`https://graph.facebook.com/v25.0/${phone_number_id}?fields=verified_name,display_phone_number,code_verification_status,platform_type,throughput`, {
        headers: { Authorization: `Bearer ${metaToken}` }
      })
      metaInfo = await checkResp.json()

      // Se não estiver registrado na Cloud API, registrar
      if (metaInfo.error?.error_subcode === 133010 || !metaInfo.code_verification_status) {
        const regResp = await fetch(`https://graph.facebook.com/v25.0/${phone_number_id}/register`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', pin: '123456' })
        })
        const regData = await regResp.json()
        if (regData.success) {
          const recheck = await fetch(`https://graph.facebook.com/v25.0/${phone_number_id}?fields=verified_name,display_phone_number,code_verification_status,platform_type,throughput`, {
            headers: { Authorization: `Bearer ${metaToken}` }
          })
          metaInfo = await recheck.json()
        }
      }
    } catch (e) {
      console.error('[activate-number] Meta error:', e.message)
    }
  }

  // Buscar o bot alvo
  let targetBotId = bot_id
  let targetBot = null

  if (targetBotId) {
    const { data, error } = await db.from('bots')
      .select('id, name, tenant_id, phone_number_id, status')
      .eq('id', targetBotId)
      .maybeSingle()
    if (error || !data) {
      return res.status(404).json({ error: 'Bot não encontrado', detail: error?.message })
    }
    targetBot = data
  } else if (tenant_id) {
    const { data, error } = await db.from('bots')
      .select('id, name, tenant_id, phone_number_id, status')
      .eq('tenant_id', tenant_id)
      .maybeSingle()
    if (error || !data) {
      return res.status(404).json({ error: 'Nenhum bot encontrado para este tenant', detail: error?.message })
    }
    targetBot = data
    targetBotId = data.id
  } else {
    return res.status(400).json({ error: 'Informe bot_id ou tenant_id' })
  }

  // Desvincular o número de qualquer outro bot
  await db.from('bots')
    .update({ phone_number_id: null, status: 'inactive' })
    .neq('id', targetBotId)
    .eq('phone_number_id', phone_number_id)

  // Atualizar o bot alvo com o número
  const { data: updated, error: updateErr } = await db.from('bots')
    .update({
      phone_number_id,
      waba_id: process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798',
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetBotId)
    .select('id, name, status, phone_number_id, tenant_id')

  if (updateErr) {
    return res.status(500).json({ error: 'Erro ao ativar bot', detail: updateErr.message })
  }

  // Buscar nome do tenant
  let tenantName = null
  if (updated?.[0]?.tenant_id) {
    const { data: tenant } = await db.from('tenants')
      .select('name')
      .eq('id', updated[0].tenant_id)
      .maybeSingle()
    tenantName = tenant?.name
  }

  return res.status(200).json({
    ok: true,
    message: `Número ${metaInfo?.display_phone_number || phone_number_id} ativado no bot ${updated?.[0]?.name || targetBotId}`,
    bot: updated?.[0],
    tenant_name: tenantName,
    meta_info: metaInfo,
  })
}
