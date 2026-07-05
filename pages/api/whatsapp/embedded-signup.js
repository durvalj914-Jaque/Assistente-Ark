/**
 * POST /api/whatsapp/embedded-signup
 * Conclui o onboarding automático de WhatsApp via Embedded Signup da Meta.
 * O cliente loga com o Facebook dele num popup (componente
 * WhatsAppEmbeddedSignup), a Meta devolve um "code" + waba_id + phone_number_id
 * pro frontend, e esse endpoint troca tudo por um token de longa duração,
 * registra o número na Cloud API, assina o app pros webhooks, e salva
 * direto no bot do tenant — sem a equipe Arkiel precisar copiar/colar nada.
 *
 * Body: { bot_id, code, waba_id, phone_number_id }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { exchangeCodeForLongLivedToken, registerPhoneNumber, subscribeAppToWaba } from '../../../lib/meta'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bot_id, code, waba_id, phone_number_id } = req.body || {}
  if (!bot_id || !code || !waba_id || !phone_number_id) {
    return res.status(400).json({ error: 'bot_id, code, waba_id e phone_number_id são obrigatórios' })
  }

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { data: bot, error: botErr } = await db.from('bots').select('id, tenant_id').eq('id', bot_id).single()
  if (botErr || !bot) return res.status(404).json({ error: 'Bot não encontrado' })

  const { data: member } = await db
    .from('tenant_members').select('role')
    .eq('tenant_id', bot.tenant_id).eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Acesso negado a este bot' })

  const appId = process.env.META_APP_ID || '1233523595601487'
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) return res.status(500).json({ error: 'META_APP_SECRET não configurado no servidor' })

  try {
    const accessToken = await exchangeCodeForLongLivedToken(code, appId, appSecret)

    // Registro do número pode falhar com "already registered" se o cliente já
    // tinha feito isso antes (ex.: reconexão) — nesse caso seguimos em frente.
    try {
      await registerPhoneNumber(phone_number_id, accessToken)
    } catch (regErr) {
      const msg = regErr?.response?.data?.error?.message || ''
      if (!/already|registered/i.test(msg)) throw regErr
    }

    await subscribeAppToWaba(waba_id, accessToken)

    const { error: updateErr } = await db.from('bots').update({
      phone_number_id,
      waba_id,
      access_token: accessToken,
      status: 'active'
    }).eq('id', bot_id)
    if (updateErr) throw updateErr

    // Se existir um pedido manual pendente pra esse tenant, marca como conectado
    // automaticamente — o cliente não precisa mais esperar a equipe Arkiel.
    await db.from('whatsapp_onboarding_requests')
      .update({ status: 'connected', admin_notes: 'Conectado automaticamente via Embedded Signup' })
      .eq('tenant_id', bot.tenant_id)
      .in('status', ['pending', 'in_progress'])

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[embedded-signup] erro:', err?.response?.data || err.message)
    const metaMsg = err?.response?.data?.error?.message
    return res.status(500).json({ error: metaMsg || 'Falha ao concluir a conexão com a Meta. Tente novamente.' })
  }
}
