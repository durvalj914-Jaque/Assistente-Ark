/**
 * POST /api/admin/confirm-whatsapp
 * Permite que o platform admin confirme o código SMS de verificação do
 * WhatsApp de qualquer bot — usado no fluxo "Novo Cliente" quando o admin
 * está junto com o cliente (presencial ou videochamada) e o código chega na hora.
 *
 * Body: { bot_id, code }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'
import { verifyPhoneCode, registerPhoneNumber, subscribeAppToWaba } from '../../../lib/meta'

const SHARED_WABA_ID = process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const { bot_id, code } = req.body || {}
  if (!bot_id || !code) return res.status(400).json({ error: 'bot_id e code são obrigatórios' })

  const { data: bot, error: botErr } = await db.from('bots')
    .select('id, tenant_id, pending_phone_number_id, pending_display_number')
    .eq('id', bot_id).single()
  if (botErr || !bot) return res.status(404).json({ error: 'Bot não encontrado' })
  if (!bot.pending_phone_number_id) return res.status(400).json({ error: 'Nenhum número aguardando confirmação pra esse bot' })

  const systemToken = process.env.META_SYSTEM_USER_TOKEN
  if (!systemToken) return res.status(500).json({ error: 'META_SYSTEM_USER_TOKEN não configurado no servidor' })

  const phoneNumberId = bot.pending_phone_number_id

  try {
    // 1. Verifica o código SMS
    await verifyPhoneCode(phoneNumberId, systemToken, code)

    // 2. Registra na Cloud API (resiliente — lida com PIN mismatch e já-registrado)
    try {
      await registerPhoneNumber(phoneNumberId, systemToken)
    } catch (regErr) {
      const errCode = regErr?.response?.data?.error?.code
      const msg = regErr?.response?.data?.error?.message || ''
      if (errCode === 133010) {
        await registerPhoneNumber(phoneNumberId, systemToken)
      } else if (!/already|registered/i.test(msg)) {
        throw regErr
      }
    }

    // 3. Garante assinatura de webhooks da WABA
    try { await subscribeAppToWaba(SHARED_WABA_ID, systemToken) } catch (_) {}

    // 4. Ativa o bot
    const { error: updateErr } = await db.from('bots').update({
      phone_number_id: phoneNumberId,
      waba_id: SHARED_WABA_ID,
      access_token: systemToken,
      status: 'active',
      pending_phone_number_id: null,
      pending_display_number: null,
    }).eq('id', bot_id)
    if (updateErr) throw updateErr

    // 5. Atualiza onboarding se existir
    await db.from('whatsapp_onboarding_requests')
      .update({ status: 'connected', admin_notes: 'Conectado pelo admin via Novo Cliente' })
      .eq('tenant_id', bot.tenant_id)
      .in('status', ['pending', 'in_progress'])

    return res.status(200).json({
      ok: true,
      phone_number: bot.pending_display_number,
      bot_id: bot.id,
    })
  } catch (err) {
    console.error('[admin/confirm-whatsapp] erro:', err?.response?.data || err.message)
    const metaMsg = err?.response?.data?.error?.error_user_msg || err?.response?.data?.error?.message
    return res.status(500).json({ error: metaMsg || 'Código inválido ou expirado. Peça um novo envio de SMS.' })
  }
}
