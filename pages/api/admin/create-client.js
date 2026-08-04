/**
 * POST /api/admin/create-client
 * Cria uma nova empresa (tenant) do zero, já com um bot padrão, pra equipe
 * Arkiel deixar pronto antes mesmo do cliente entrar na plataforma.
 *
 * Se o admin informar o número de WhatsApp (cc + phone_number + verified_name),
 * o endpoint também adiciona o número na WABA compartilhada e dispara o SMS
 * de verificação — tudo numa única chamada. O cliente só precisa digitar o
 * código que recebeu no celular (via /api/whatsapp/confirm-number ou pelo portal).
 *
 * Body: { company_name, owner_email, plan, whatsapp_cc?, whatsapp_number?, whatsapp_name? }
 * Header: Authorization: Bearer <supabase_session_token>
 */
import crypto from 'crypto'
import { requirePlatformAdmin } from '../../../lib/adminAuth'
import { addPhoneNumberToWaba, requestVerificationCode, listWabaPhoneNumbers } from '../../../lib/meta'

const VALID_PLANS = ['free', 'starter', 'pro', 'enterprise']
const SHARED_WABA_ID = process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db, user } = ctx

  const {
    company_name, owner_email, plan,
    whatsapp_cc, whatsapp_number, whatsapp_name
  } = req.body || {}

  if (!company_name?.trim()) return res.status(400).json({ error: 'Nome da empresa é obrigatório' })
  if (!owner_email?.trim() || !owner_email.includes('@')) return res.status(400).json({ error: 'E-mail do responsável é obrigatório e precisa ser válido' })

  const email = owner_email.trim().toLowerCase()
  const finalPlan = VALID_PLANS.includes(plan) ? plan : 'free'

  // Valida número de WhatsApp se foi informado
  const hasWhatsapp = !!(whatsapp_cc && whatsapp_number)
  if (hasWhatsapp && !whatsapp_name?.trim()) {
    return res.status(400).json({ error: 'Informe o nome que vai aparecer no perfil do WhatsApp (verified_name)' })
  }

  // Verifica se já existe alguém com esse e-mail cadastrado na plataforma
  const { data: existingProfile } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existingProfile) {
    const { data: existingMembership } = await db
      .from('tenant_members').select('tenant_id').eq('user_id', existingProfile.id).maybeSingle()
    if (existingMembership) {
      return res.status(409).json({ error: 'Esse e-mail já está vinculado a uma empresa existente no Assistente Ark. Se for pra migrar de conta, avise a equipe técnica.' })
    }
  }

  const apiKey = 'ark_live_' + crypto.randomUUID().replace(/-/g, '')

  // 1. Cria o tenant
  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .insert({ name: company_name.trim(), plan: finalPlan, status: 'active', api_key: apiKey })
    .select().single()
  if (tErr) return res.status(500).json({ error: 'Erro ao criar empresa: ' + tErr.message })

  // 2. Cria o bot padrão
  const { data: bot, error: bErr } = await db
    .from('bots')
    .insert({
      tenant_id: tenant.id,
      name: whatsapp_name?.trim() || 'Meu Bot',
      status: 'inactive',
      greeting: 'Olá! Sou seu assistente virtual 🤖',
      fallback_message: 'Não entendi 🤔. Digite *0* para voltar ao menu.',
      human_takeover_keyword: 'humano',
    })
    .select().single()
  if (bErr) {
    await db.from('tenants').delete().eq('id', tenant.id)
    return res.status(500).json({ error: 'Erro ao criar bot padrão: ' + bErr.message })
  }

  // 3. Vincula o usuário existente ou cria convite pendente
  let linkedExisting = false
  if (existingProfile) {
    const { error: mErr } = await db.from('tenant_members').insert({ tenant_id: tenant.id, user_id: existingProfile.id, role: 'owner' })
    if (mErr) return res.status(500).json({ error: 'Empresa criada, mas falhou ao vincular o usuário existente: ' + mErr.message })
    linkedExisting = true
  } else {
    const { error: iErr } = await db.from('tenant_invites').insert({ tenant_id: tenant.id, email, role: 'owner', invited_by: user.id })
    if (iErr) return res.status(500).json({ error: 'Empresa criada, mas falhou ao registrar o convite: ' + iErr.message })
  }

  // 4. Se informou número de WhatsApp, adiciona na WABA e dispara SMS
  let whatsappResult = null
  if (hasWhatsapp) {
    const systemToken = process.env.META_SYSTEM_USER_TOKEN
    if (!systemToken) {
      return res.status(200).json({
        tenant, bot, linked_existing: linkedExisting,
        warning: 'Cliente criado, mas META_SYSTEM_USER_TOKEN não configurado — não foi possível cadastrar o WhatsApp agora. O cliente pode ativar pelo portal.'
      })
    }

    const digitsOnly = (s) => (s || '').replace(/\D/g, '')
    const targetDigits = digitsOnly(whatsapp_cc) + digitsOnly(whatsapp_number)

    try {
      let phoneNumberId

      try {
        const addRes = await addPhoneNumberToWaba(SHARED_WABA_ID, systemToken, whatsapp_cc, whatsapp_number, whatsapp_name.trim())
        phoneNumberId = addRes.data.id
      } catch (addErr) {
        const metaMsg = addErr?.response?.data?.error?.message || addErr?.response?.data?.error?.error_user_msg || ''
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

      // Dispara o SMS de verificação
      await requestVerificationCode(phoneNumberId, systemToken, 'SMS')

      // Salva o pending no bot
      await db.from('bots').update({
        pending_phone_number_id: phoneNumberId,
        pending_display_number: `+${whatsapp_cc} ${whatsapp_number}`,
      }).eq('id', bot.id)

      whatsappResult = {
        phone_number_id: phoneNumberId,
        display_number: `+${whatsapp_cc} ${whatsapp_number}`,
        sms_sent: true,
        bot_id: bot.id,
      }
    } catch (err) {
      console.error('[create-client] WhatsApp erro:', err?.response?.data || err.message)
      const metaMsg = err?.response?.data?.error?.error_user_msg || err?.response?.data?.error?.message
      // Não falha a criação do cliente — só avisa que o WhatsApp não deu certo
      whatsappResult = {
        error: metaMsg || 'Falha ao cadastrar o número. O cliente pode ativar pelo portal (/client).'
      }
    }
  }

  return res.status(200).json({ tenant, bot, linked_existing: linkedExisting, whatsapp: whatsappResult })
}
