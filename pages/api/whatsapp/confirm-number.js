/**
 * POST /api/whatsapp/confirm-number
 * Passo 2 do onboarding "sem Facebook": o cliente informa o código que
 * recebeu por SMS. Confirmamos na Meta, registramos o número na Cloud API,
 * garantimos a assinatura de webhooks da WABA compartilhada, e ativamos o bot
 * — tudo com o token permanente de Usuário do Sistema (nunca exposto ao cliente).
 * Body: { bot_id, code }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { verifyPhoneCode, registerPhoneNumber, subscribeAppToWaba } from '../../../lib/meta'

const SHARED_WABA_ID = process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bot_id, code } = req.body || {}
  if (!bot_id || !code) return res.status(400).json({ error: 'bot_id e code são obrigatórios' })

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: bot, error: botErr } = await db.from('bots').select('id, tenant_id, pending_phone_number_id').eq('id', bot_id).single()
  if (botErr || !bot) return res.status(404).json({ error: 'Bot não encontrado' })
  if (!bot.pending_phone_number_id) return res.status(400).json({ error: 'Nenhum número aguardando confirmação pra esse bot' })

  const { data: member } = await db
    .from('tenant_members').select('role')
    .eq('tenant_id', bot.tenant_id).eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Acesso negado a este bot' })

  const systemToken = process.env.META_SYSTEM_USER_TOKEN
  if (!systemToken) return res.status(500).json({ error: 'META_SYSTEM_USER_TOKEN não configurado no servidor' })

  const phoneNumberId = bot.pending_phone_number_id

  try {
    await verifyPhoneCode(phoneNumberId, systemToken, code)

    try {
      await registerPhoneNumber(phoneNumberId, systemToken)
    } catch (regErr) {
      const msg = regErr?.response?.data?.error?.message || ''
      if (!/already|registered/i.test(msg)) throw regErr
    }

    // A WABA compartilhada já deve estar assinada, mas isso é idempotente —
    // seguro chamar de novo a cada novo número.
    try { await subscribeAppToWaba(SHARED_WABA_ID, systemToken) } catch (_) { /* já assinado, ok */ }

    const { error: updateErr } = await db.from('bots').update({
      phone_number_id: phoneNumberId,
      waba_id: SHARED_WABA_ID,
      access_token: systemToken,
      status: 'active',
      pending_phone_number_id: null,
      pending_display_number: null
    }).eq('id', bot_id)
    if (updateErr) throw updateErr

    await db.from('whatsapp_onboarding_requests')
      .update({ status: 'connected', admin_notes: 'Conectado automaticamente via verificação por SMS' })
      .eq('tenant_id', bot.tenant_id)
      .in('status', ['pending', 'in_progress'])

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[confirm-number] erro:', err?.response?.data || err.message)
    const metaMsg = err?.response?.data?.error?.error_user_msg || err?.response?.data?.error?.message
    return res.status(500).json({ error: metaMsg || 'Código inválido ou expirado. Peça um novo número/código.' })
  }
}
