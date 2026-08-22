import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDB() {
  return createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
}

/**
 * POST /api/marketing/send
 * Body: { tenant_id, message, contacts: ['5511...', ...] }
 * 
 * Envia uma mensagem de marketing via template do WhatsApp.
 * Cada contato consome 1 crédito de marketing (R$0,36).
 * Usa o template hello_world como fallback se não houver template de marketing aprovado.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant_id, message, contacts } = req.body

  if (!tenant_id || !message || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'tenant_id, message e contacts são obrigatórios' })
  }

  const db = getDB()

  // 1. Verificar saldo de créditos de marketing
  const { data: creditRow } = await db.from('conversation_credits')
    .select('balance')
    .eq('tenant_id', tenant_id)
    .eq('credit_type', 'marketing')
    .maybeSingle()

  const balance = creditRow?.balance || 0
  if (balance < contacts.length) {
    return res.status(402).json({
      error: `Créditos de marketing insuficientes. Você tem ${balance} créditos e está tentando enviar para ${contacts.length} contatos.`,
      balance,
      needed: contacts.length,
    })
  }

  // 2. Buscar bot do tenant
  const { data: bot } = await db.from('bots')
    .select('id,phone_number_id,access_token,tenant_id')
    .eq('tenant_id', tenant_id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (!bot) {
    return res.status(404).json({ error: 'Nenhum bot ativo encontrado para este tenant' })
  }

  const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
  const phoneId = bot.phone_number_id

  // 3. Buscar templates de marketing aprovados
  // Por agora, usar template hello_world como fallback
  // TODO: criar template customizado de marketing e usar ele
  let templateName = 'hello_world'
  let templateLanguage = 'en_US'

  // Tentar buscar template de marketing customizado
  try {
    const templatesRes = await fetch(
      `https://graph.facebook.com/v25.0/${process.env.WABA_ID || '1867398900635798'}/message_templates?fields=name,language,status,category&limit=100`,
      { headers: { Authorization: `Bearer ${waToken}` } }
    )
    const templatesData = await templatesRes.json()
    
    const approvedMarketing = (templatesData.data || []).find(
      t => t.status === 'APPROVED' && t.category === 'MARKETING'
    )
    if (approvedMarketing) {
      templateName = approvedMarketing.name
      templateLanguage = approvedMarketing.language
    }
  } catch (e) {
    console.error('[marketing/send] Erro ao buscar templates:', e.message)
  }

  // 4. Enviar mensagens
  let sent = 0
  let failed = 0
  const errors = []

  for (const phone of contacts) {
    try {
      let body
      if (templateName === 'hello_world') {
        // Template padrão — não suporta variáveis, envia como está
        body = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
          },
        }
        // Se tem mensagem customizada, usar template com body
        if (message && message !== 'hello_world') {
          // Enviar como texto normal dentro da janela 24h se possível
          // Senão, usar template hello_world e depois enviar a mensagem
          body.template = {
            name: templateName,
            language: { code: templateLanguage },
          }
        }
      } else {
        // Template de marketing customizado com variável
        body = {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
            components: [{
              type: 'body',
              parameters: [{ type: 'text', text: message.substring(0, 1024) }],
            }],
          },
        }
      }

      const sendRes = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
        body: JSON.stringify(body),
      })
      const sendData = await sendRes.json()

      if (sendData.id || sendData.message_status === 'accepted') {
        sent++
        // Se template customizado com a mensagem, a mensagem já foi enviada no template
        // Se hello_world, enviar a mensagem real como follow-up
        if (templateName === 'hello_world' && message !== 'hello_world') {
          // Enviar a mensagem de marketing como texto (após abrir a janela)
          try {
            await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
              body: JSON.stringify({
                messaging_product: 'whatsapp', to: phone, type: 'text',
                text: { body: message.substring(0, 4096) },
              }),
            })
          } catch (_) {}
        }
      } else {
        failed++
        errors.push({ phone, error: sendData.error?.message || 'unknown' })
      }
    } catch (e) {
      failed++
      errors.push({ phone, error: e.message })
    }

    // Pequeno delay para não estourar rate limit da Meta
    if (sent % 10 === 0 && sent > 0) await new Promise(r => setTimeout(r, 500))
  }

  // 5. Registrar no log
  try {
    await db.from('activity_logs').insert({
      tenant_id,
      event_type: 'marketing_broadcast',
      description: `Broadcast de marketing enviado para ${sent} contatos (${failed} falhas)`,
      metadata: JSON.stringify({ sent, failed, template: templateName, message_preview: message.substring(0, 100) }),
    })
  } catch (_) {}

  return res.status(200).json({
    ok: true,
    sent,
    failed,
    template_used: templateName,
    errors: errors.slice(0, 5), // primeiros 5 erros apenas
  })
}
