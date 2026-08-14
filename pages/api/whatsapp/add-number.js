/**
 * POST /api/whatsapp/add-number
 * Passo 1 do onboarding "sem Facebook": o cliente digita o número dele,
 * a Arkiel adiciona esse número na WABA compartilhada (usando o token
 * permanente de Usuário do Sistema, que nunca sai do servidor) e pede um
 * código de verificação por SMS pro próprio número do cliente.
 * Body: { bot_id, cc, phone_number, verified_name }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { addPhoneNumberToWaba, requestVerificationCode, listWabaPhoneNumbers } from '../../../lib/meta'

const SHARED_WABA_ID = process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bot_id, cc, phone_number, verified_name } = req.body || {}
  if (!bot_id || !cc || !phone_number || !verified_name) {
    return res.status(400).json({ error: 'bot_id, cc, phone_number e verified_name são obrigatórios' })
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

  const systemToken = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
  if (!systemToken || systemToken === '[SENSITIVE]') return res.status(500).json({ error: 'Token da Meta não configurado no servidor' })

  const digitsOnly = (s) => (s || '').replace(/\D/g, '')
  const targetDigits = digitsOnly(cc) + digitsOnly(phone_number)

  try {
    let phoneNumberId

    try {
      const addRes = await addPhoneNumberToWaba(SHARED_WABA_ID, systemToken, cc, phone_number, verified_name)
      phoneNumberId = addRes.data.id
    } catch (addErr) {
      const metaMsg = addErr?.response?.data?.error?.message || addErr?.response?.data?.error?.error_user_msg || ''
      // Esse número já existe como recurso na WABA (ex.: tentativa anterior, ou
      // número que já passou por aqui antes) — em vez de falhar, localizamos o
      // recurso já existente e seguimos o fluxo normalmente a partir dele.
      if (/already|existe|registrad/i.test(metaMsg)) {
        const listRes = await listWabaPhoneNumbers(SHARED_WABA_ID, systemToken)
        const existing = (listRes.data.data || []).find(p => digitsOnly(p.display_phone_number).endsWith(targetDigits.slice(-11)))
        if (!existing) throw addErr
        phoneNumberId = existing.id
      } else {
        throw addErr
      }
    }

    if (!phoneNumberId) throw new Error('Meta não retornou um ID pro número informado')

    // Verificar se o número já está verificado antes de pedir código
    let alreadyVerified = false
    try {
      const checkResp = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}?fields=code_verification_status`, {
        headers: { Authorization: `Bearer ${systemToken}` }
      })
      const checkData = await checkResp.json()
      alreadyVerified = checkData.code_verification_status === 'VERIFIED'
    } catch (e) { /* ignora */ }

    if (alreadyVerified) {
      // Número já verificado — registra direto e ativa o bot
      await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${systemToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin: '123456' })
      })

      await db.from('bots').update({
        phone_number_id: phoneNumberId,
        waba_id: SHARED_WABA_ID,
        status: 'active',
        pending_phone_number_id: null,
        pending_display_number: null,
        updated_at: new Date().toISOString(),
      }).eq('id', bot_id)

      return res.status(200).json({ ok: true, phone_number_id: phoneNumberId, already_verified: true })
    }

    await requestVerificationCode(phoneNumberId, systemToken, 'SMS')

    await db.from('bots').update({
      pending_phone_number_id: phoneNumberId,
      pending_display_number: `+${cc} ${phone_number}`
    }).eq('id', bot_id)

    return res.status(200).json({ ok: true, phone_number_id: phoneNumberId })
  } catch (err) {
    console.error('[add-number] erro:', err?.response?.data || err.message)
    const metaMsg = err?.response?.data?.error?.error_user_msg || err?.response?.data?.error?.message
    return res.status(500).json({ error: metaMsg || 'Falha ao adicionar o número. Verifique se ele não está em uso em outra conta WhatsApp.' })
  }
}
