/**
 * POST /api/payments/create
 * Cria um pagamento (PIX ou Mercado Pago) e envia via WhatsApp.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'
import { generatePixCode } from '../../../lib/pix'
import QRCode from 'qrcode'

const WA_API = 'https://graph.facebook.com/v25.0'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { conversation_id, amount, description, method = 'pix', pix_key, merchant_name, merchant_city } = req.body

  if (!conversation_id || !amount) return res.status(400).json({ error: 'conversation_id e amount são obrigatórios' })
  if (amount <= 0) return res.status(400).json({ error: 'Valor deve ser maior que 0' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  const { data: conv } = await db.from('conversations').select('id, tenant_id, bot_id, contact_id').eq('id', conversation_id).maybeSingle()
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })

  // Buscar bot com status
  const { data: bot } = await db.from('bots').select('id, name, phone_number_id, access_token, status').eq('id', conv.bot_id).maybeSingle()
  if (!bot) return res.status(404).json({ error: 'Bot não encontrado' })
  if (bot.status !== 'active') return res.status(400).json({ error: 'Bot inativo. Acesse Configurações para reativar o WhatsApp antes de enviar cobranças.' })
  if (!bot.phone_number_id) return res.status(400).json({ error: 'Bot sem número de WhatsApp configurado.' })

  const { data: tenant } = await db.from('tenants').select('id, name, pix_key, merchant_name, merchant_city, mp_access_token').eq('id', conv.tenant_id).maybeSingle()

  const finalPixKey = pix_key || tenant?.pix_key
  const finalName = (merchant_name || tenant?.merchant_name || tenant?.name || 'Arkiel').substring(0, 25)
  const finalCity = (merchant_city || tenant?.merchant_city || 'SAO PAULO').substring(0, 15)

  const txid = `ARK${Date.now().toString(36).toUpperCase()}`
  const paymentId = txid

  const waToken = bot.access_token || process.env.META_SYSTEM_USER_TOKEN || process.env.FACEBOOK_BUSINESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
  const phoneId = bot.phone_number_id

  if (!waToken) return res.status(500).json({ error: 'Token do WhatsApp não configurado.' })

  const { data: contact } = await db.from('contacts').select('phone').eq('id', conv.contact_id).maybeSingle()
  if (!contact?.phone) return res.status(400).json({ error: 'Contato sem telefone' })

  // Sanitizar telefone: remover tudo que não for dígito
  let cleanPhone = contact.phone.replace(/\D/g, '')
  // Se tem 12 dígitos e começa com 55, adicionar 9 (celular BR)
  if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
    cleanPhone = cleanPhone.slice(0,4) + '9' + cleanPhone.slice(4)
  }
  // Se não tem código de país (11 dígitos), assumir Brasil +55
  if (cleanPhone.length === 11 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone
  }
  // Se tem 10 dígitos (fixo sem 9), adicionar 55
  if (cleanPhone.length === 10 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone
  }
  console.log('[payments/create] Phone original:', contact.phone, '→ Sanitizado:', cleanPhone)

  // Helper: enviar mensagem WhatsApp com verificação de erro
  async function sendWaMessage(payload) {
    console.log('[payments/create] Sending WA message to:', payload.to, 'type:', payload.type || 'text')
    const r = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
      body: JSON.stringify(payload),
    })
    const j = await r.json()
    if (!r.ok || j.error) {
      const errMsg = j.error?.message || j.message || JSON.stringify(j).substring(0, 200)
      console.error('[payments/create] WA API error:', r.status, errMsg)
      throw new Error(`WhatsApp: ${errMsg}`)
    }
    console.log('[payments/create] WA message sent OK, id:', j.messages?.[0]?.id || 'unknown')
    return j
  }

  if (method === 'pix' || method === 'pix_direct' || method === 'both') {
    const useDirectPix = method === 'pix_direct'
    let mpTokenForPix = null
    if (tenant?.mp_access_token) {
      try { mpTokenForPix = JSON.parse(tenant.mp_access_token).access_token } catch { mpTokenForPix = tenant.mp_access_token }
    }
    if (!mpTokenForPix) mpTokenForPix = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2

    let qrBuffer, pixCode, mpPixId = null

    if (mpTokenForPix && !useDirectPix) {
      const mpPixRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpTokenForPix}` },
        body: JSON.stringify({
          transaction_amount: parseFloat(amount),
          description: description || 'Pagamento Arkiel',
          payment_method_id: 'pix',
          external_reference: txid,
          notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
          payer: { email: cleanPhone ? cleanPhone + '@arkiel.client' : 'cliente@arkiel.com.br' }
        })
      })
      const mpPixData = await mpPixRes.json()

      if (mpPixData?.point_of_interaction?.transaction_data?.qr_code_base64) {
        qrBuffer = Buffer.from(mpPixData.point_of_interaction.transaction_data.qr_code_base64, 'base64')
        pixCode = mpPixData.point_of_interaction.transaction_data.qr_code
        mpPixId = mpPixData.id
      } else {
        console.error('[pix-mp] Falha ao criar PIX via MP:', JSON.stringify(mpPixData).substring(0, 300))
      }
    }

    if (!qrBuffer && !pixCode) {
      if (!finalPixKey) return res.status(400).json({ error: 'Chave PIX não configurada. Cadastre uma chave PIX em Configurações ou conecte o Mercado Pago.' })
      pixCode = generatePixCode({ pixKey: finalPixKey, merchantName: finalName, merchantCity: finalCity, amount: parseFloat(amount), txid, description: description?.substring(0, 50) })
      qrBuffer = await QRCode.toBuffer(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    }

    // Upload QR Code image
    const blob = new Blob([qrBuffer], { type: 'image/png' })
    const formData = new FormData()
    formData.append('messaging_product', 'whatsapp')
    formData.append('type', 'image/png')
    formData.append('file', blob, 'pix_qr.png')

    const upRes = await fetch(`${WA_API}/${phoneId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${waToken}` }, body: formData })
    const upJson = await upRes.json()
    if (!upJson.id) return res.status(500).json({ error: 'Falha ao subir QR Code no WhatsApp', detail: upJson })

    const viaLabel = mpPixId ? 'PIX (Mercado Pago)' : (useDirectPix ? 'PIX Direto' : 'PIX')
    const caption = `💰 *Pagamento ${viaLabel}* - R$ ${parseFloat(amount).toFixed(2)}\n\n${description || ''}\n\n*Escaneie o QR Code ou copie o código abaixo:*\n\n${pixCode}`

    // Enviar mensagem com verificação de erro
    try {
      await sendWaMessage({ messaging_product: 'whatsapp', to: cleanPhone, type: 'image',
        image: { id: upJson.id, caption } })
    } catch (sendErr) {
      // Mensagem falhou — registrar no chat mas informar o usuário
      await db.from('messages').insert({ tenant_id: conv.tenant_id, conversation_id, bot_id: conv.bot_id, contact_id: conv.contact_id, direction: 'outbound', type: 'image', content: `__media__:image:${upJson.id}__ 💰 *Pagamento ${viaLabel}* - R$ ${parseFloat(amount).toFixed(2)}\n${description || ''}\n⚠️ *Não entregue:* ${sendErr.message}`, sent_by: 'human' })
      return res.status(500).json({ error: `Cobrança criada mas não enviada: ${sendErr.message}` })
    }

    await db.from('messages').insert({ tenant_id: conv.tenant_id, conversation_id, bot_id: conv.bot_id, contact_id: conv.contact_id, direction: 'outbound', type: 'image', content: `__media__:image:${upJson.id}__ 💰 *Pagamento ${viaLabel}* - R$ ${parseFloat(amount).toFixed(2)}\n${description || ''}`, sent_by: 'human' })

    if (method !== 'both') {
      return res.status(200).json({ ok: true, payment_id: paymentId, method: useDirectPix ? 'pix_direct' : 'pix', pix_code: pixCode, mp_pix_id: mpPixId })
    }
  }

  if (method === 'mercadopago' || method === 'both') {
    let mpToken = null
    if (tenant?.mp_access_token) {
      try { mpToken = JSON.parse(tenant.mp_access_token).access_token } catch { mpToken = tenant.mp_access_token }
    }
    if (!mpToken) mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
    if (!mpToken) return res.status(400).json({ error: 'Mercado Pago não configurado.' })

    const _payAmount = parseFloat(amount)
    const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
    let _feePercent = 2.0
    try {
      const { data: _arkielT } = await db.from('tenants').select('mp_access_token').eq('id', ARKIEL_TENANT_ID).maybeSingle()
      const _parsed = JSON.parse(_arkielT?.mp_access_token || '{}')
      _feePercent = _parsed.fee_config?.pix ?? 2.0
    } catch {}
    const _mpFee = Number((_payAmount * _feePercent / 100).toFixed(2))

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
      body: JSON.stringify({
        items: [{ title: description || 'Pagamento', quantity: 1, unit_price: _payAmount, currency_id: 'BRL' }],
        marketplace: 'ARKIEL',
        marketplace_fee: _mpFee,
        back_urls: { success: 'https://arkiel.com.br/pagamento/sucesso', failure: 'https://arkiel.com.br/pagamento/erro', pending: 'https://arkiel.com.br/pagamento/pendente' },
        auto_return: 'approved', external_reference: txid, statement_descriptor: finalName.substring(0, 12),
        notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
      }),
    })
    const mpData = await mpRes.json()
    if (!mpData.init_point) return res.status(500).json({ error: 'Falha ao criar pagamento MP', detail: mpData })

    const linkText = `💳 *Pagamento* - R$ ${parseFloat(amount).toFixed(2)}\n\n${description || ''}\n\n*Pague via link seguro:*\n${mpData.init_point}\n\nAceita PIX, cartão e boleto.`

    // Enviar com verificação de erro
    try {
      await sendWaMessage({ messaging_product: 'whatsapp', to: cleanPhone, type: 'text', text: { body: linkText } })
    } catch (sendErr) {
      await db.from('messages').insert({ tenant_id: conv.tenant_id, conversation_id, bot_id: conv.bot_id, contact_id: conv.contact_id, direction: 'outbound', type: 'text', content: `${linkText}\n⚠️ *Não entregue:* ${sendErr.message}`, sent_by: 'human' })
      return res.status(500).json({ error: `Link criado mas não enviado: ${sendErr.message}` })
    }

    await db.from('messages').insert({ tenant_id: conv.tenant_id, conversation_id, bot_id: conv.bot_id, contact_id: conv.contact_id, direction: 'outbound', type: 'text', content: linkText, sent_by: 'human' })

    return res.status(200).json({ ok: true, payment_id: paymentId, method: method === 'both' ? 'both' : 'mercadopago', checkout_url: mpData.init_point })
  }

  return res.status(400).json({ error: 'Método inválido.' })
}
