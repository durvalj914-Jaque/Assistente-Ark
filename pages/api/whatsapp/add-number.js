/**
 * POST /api/whatsapp/add-number
 * Passo 1 do onboarding "sem Facebook": o cliente digita o número dele,
 * a Arkiel adiciona esse número na WABA compartilhada (usando o token
 * permanente de Usuário do Sistema, que nunca sai do servidor) e pede um
 * código de verificação por SMS pro próprio número do cliente.
 * Body: { cc, phone_number, verified_name, bot_id? } — sem bot_id, um bot novo é criado junto com o número (1 número = 1 bot)
 * Header: Authorization: Bearer <supabase_session_token>
 *
 * Regras de segurança/robustez (valem pra todos os tenants):
 * - Idempotente: pedir de novo o número que JÁ está conectado e ativo na própria
 *   conta devolve already_connected em vez de erro de plano/bot ocupado.
 * - Número que já pertence a OUTRO tenant nunca é reivindicado (evita disputa/duplicidade).
 * - Se o bot já tem outro número, avisa claramente que precisa desconectar antes de trocar.
 */
import { supabaseAdmin } from '../../../lib/supabase'
import { checkLimit, PLANS } from '../../../lib/plans'
import { addPhoneNumberToWaba, requestVerificationCode, listWabaPhoneNumbers } from '../../../lib/meta'

const SHARED_WABA_ID = process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798'

const digitsOnly = (s) => (s || '').replace(/\D/g, '')

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userToken = (req.headers.authorization || '').replace('Bearer ', '')
  const db = supabaseAdmin()

  const { data: { user }, error: authError } = await db.auth.getUser(userToken)
  if (authError || !user) return res.status(401).json({ error: 'Não autorizado' })

  const { bot_id, cc, phone_number, verified_name } = req.body || {}
  if (!cc || !phone_number || !verified_name) {
    return res.status(400).json({ error: 'cc, phone_number e verified_name são obrigatórios' })
  }

  const systemToken = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
  if (!systemToken || systemToken === '[SENSITIVE]') return res.status(500).json({ error: 'Token da Meta não configurado no servidor' })

  // Tenant do usuário — usado pra cota e pra checagem de posse do número
  const { data: tm } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).limit(1)
  if (!tm?.length) return res.status(403).json({ error: 'Acesso negado' })
  const tenantId = tm[0].tenant_id

  const targetDigits = digitsOnly(cc) + digitsOnly(phone_number)
  const suffix = targetDigits.slice(-11)

  // 1. Esse número já existe como recurso na WABA? (uma listagem só, sem criar nada)
  let existingPhoneNumberId = null
  try {
    const listRes = await listWabaPhoneNumbers(SHARED_WABA_ID, systemToken)
    const found = (listRes.data.data || []).find(p => digitsOnly(p.display_phone_number).endsWith(suffix))
    existingPhoneNumberId = found?.id || null
  } catch (_) { /* segue: tentamos adicionar de novo mais abaixo */ }

  // 2. Posse do número: nunca reivindicar número de outro tenant; e se já é da
  //    própria conta e está ativo, a operação é idempotente (nenhum SMS é enviado).
  if (existingPhoneNumberId) {
    const { data: claims } = await db.from('bots')
      .select('id, tenant_id, status')
      .eq('phone_number_id', existingPhoneNumberId)
    const foreign = (claims || []).find(c => c.tenant_id !== tenantId)
    if (foreign) {
      return res.status(409).json({ error: 'Esse número já está conectado a outra conta do Assistente Ark. Fale com o suporte.' })
    }
    const mineActive = (claims || []).find(c => c.tenant_id === tenantId && c.status === 'active')
    if (mineActive) {
      return res.status(200).json({
        ok: true,
        already_connected: true,
        phone_number_id: existingPhoneNumberId,
        bot_id: mineActive.id,
        message: 'Esse número já está conectado e ativo.',
      })
    }
  }

  // 3. Qual bot vai receber o número
  let bot, botErr = null
  if (bot_id) {
    const r = await db.from('bots').select('id, tenant_id, phone_number_id, status').eq('id', bot_id).single()
    bot = r.data; botErr = r.error
    if (!botErr && bot?.phone_number_id) {
      if (existingPhoneNumberId && bot.phone_number_id === existingPhoneNumberId) {
        return res.status(200).json({
          ok: true,
          already_connected: bot.status === 'active',
          phone_number_id: bot.phone_number_id,
          bot_id: bot.id,
        })
      }
      return res.status(409).json({ error: 'Esse bot já tem outro número conectado. Desconecte o número atual antes de trocar.' })
    }
  } else {
    // 1 número = 1 bot: reaproveita um bot do tenant que ainda está sem número
    // (inclusive os legados) e só cria um novo se todos já tiverem número.
    const { data: freeBot } = await db
      .from('bots').select('id, tenant_id')
      .eq('tenant_id', tenantId).is('phone_number_id', null)
      .order('created_at', { ascending: true }).limit(1)
    if (freeBot?.length) {
      bot = freeBot[0]
    } else {
      const { data: tenant } = await db.from('tenants').select('id, plan, subscription').eq('id', tenantId).single()
      // A cota do plano conta NÚMEROS conectados, não bots vazios.
      const { count } = await db.from('bots').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).not('phone_number_id', 'is', null)
      if (!checkLimit(tenant, null, count || 0, 'bots')) {
        const plan = PLANS[tenant?.plan] || PLANS.free
        return res.status(403).json({
          error: `Seu plano já tem ${count || 0} de ${plan.max_bots > 900 ? 'ilimitados' : plan.max_bots} número(s) conectado(s). Faça upgrade pra conectar mais.`,
          upsell: true,
        })
      }
      const cr = await db.from('bots').insert({
        tenant_id: tenantId,
        name: (verified_name || '').slice(0, 60) || `WhatsApp ${phone_number}`,
      }).select('id, tenant_id').single()
      bot = cr.data; botErr = cr.error
    }
  }
  if (botErr || !bot) return res.status(404).json({ error: 'Bot não encontrado ou não pôde ser criado' })

  const { data: member } = await db
    .from('tenant_members').select('role')
    .eq('tenant_id', bot.tenant_id).eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Acesso negado a este bot' })

  try {
    let phoneNumberId = existingPhoneNumberId

    if (!phoneNumberId) {
      try {
        const addRes = await addPhoneNumberToWaba(SHARED_WABA_ID, systemToken, cc, phone_number, verified_name)
        phoneNumberId = addRes.data.id
      } catch (addErr) {
        // O número pode já existir como recurso na WABA (tentativa anterior, verificação
        // de nome de exibição em andamento etc.). Em vez de falhar por causa da mensagem,
        // procuramos o recurso existente e seguimos o fluxo a partir dele.
        let existing = null
        try {
          const listRes = await listWabaPhoneNumbers(SHARED_WABA_ID, systemToken)
          existing = (listRes.data.data || []).find(p => digitsOnly(p.display_phone_number).endsWith(suffix))
        } catch (_) { /* se a listagem falhar, mantemos o erro original */ }
        if (!existing) throw addErr
        phoneNumberId = existing.id
      }
    }

    if (!phoneNumberId) throw new Error('Meta não retornou um ID pro número informado')

    // Posse (corrida): o número pode ter sido conectado por outro tenant entre a
    // checagem inicial e agora — nesse caso, não prossegue.
    const { data: claims2 } = await db.from('bots')
      .select('id, tenant_id, status')
      .eq('phone_number_id', phoneNumberId)
    const foreign2 = (claims2 || []).find(c => c.tenant_id !== tenantId)
    if (foreign2) {
      return res.status(409).json({ error: 'Esse número já está conectado a outra conta do Assistente Ark. Fale com o suporte.' })
    }

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

      const { error: upErr } = await db.from('bots').update({
        phone_number_id: phoneNumberId,
        waba_id: SHARED_WABA_ID,
        access_token: systemToken,
        status: 'active',
        pending_phone_number_id: null,
        pending_display_number: null,
        updated_at: new Date().toISOString(),
      }).eq('id', bot.id)
      if (upErr) throw upErr

      return res.status(200).json({ ok: true, phone_number_id: phoneNumberId, bot_id: bot.id, already_verified: true })
    }

    await requestVerificationCode(phoneNumberId, systemToken, 'SMS')

    const { error: pendErr } = await db.from('bots').update({
      pending_phone_number_id: phoneNumberId,
      pending_display_number: `+${cc} ${phone_number}`,
      updated_at: new Date().toISOString(),
    }).eq('id', bot.id)
    if (pendErr) throw pendErr

    return res.status(200).json({ ok: true, phone_number_id: phoneNumberId, bot_id: bot.id })
  } catch (err) {
    console.error('[add-number] erro:', err?.response?.data || err.message)
    const metaMsg = err?.response?.data?.error?.error_user_msg || err?.response?.data?.error?.message
    return res.status(500).json({ error: metaMsg || 'Falha ao adicionar o número. Verifique se ele não está em uso em outra conta WhatsApp.' })
  }
}
