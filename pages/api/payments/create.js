/**
 * POST /api/payments/create
 * Cria um pagamento (PIX ou Mercado Pago) e envia via WhatsApp.
 * Estratégia: envia TEXTO primeiro (mais confiável), depois tenta imagem QR Code.
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

  // Sanitizar telefone
  let cleanPhone = contact.phone.replace(/\D/g, '')
  if (cleanPhone.startsWith('55') && cleanPhone.length === 12) {
    cleanPhone = cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4)
  }
  if (cleanPhone.length === 11 && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone
  if (cleanPhone.length === 10 && !cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone
  console.log('[payments/create] Phone:', contact.phone, '→', cleanPhone)

  // Helper: enviar mensagem WhatsApp
  async function sendWaMessage(payload) {
    console.log('[payments/create] WA to:', payload.to, 'type:', payload.type || 'text')
    const r = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
      body: JSON.stringify(payload),
    })
    const j = await r.json()
    if (!r.ok || j.error) {
      const errMsg = j.error?.message || j.message || JSON.stringify(j).substring(0, 200)
      console.error('[payments/create] WA error:', r.status, errMsg)
      throw new Error(`WhatsApp: ${errMsg}`)
    }
    console.log('[payments/create] WA OK, id:', j.messages?.[0]?.id || 'unknown')
    return j
  }

  // Helper: salvar mensagem no chat
  async function saveMessage(content, type = 'text') {
    await db.from('messages').insert({
      tenant_id: conv.tenant_id, conversation_id, bot_id: conv.bot_id,
      contact_id: conv.contact_id, direction: 'outbound', type, content, sent_by: 'human'
    })
  }

  if (method === 'pix' || method === 'pix_mp' || method === 'pix_direct' || method === 'both') {
    const useDirectPix = method === 'pix_direct'
    let mpTokenForPix = null
    if (tenant?.mp_access_token) {
      try { mpTokenForPix = JSON.parse(tenant.mp_access_token).access_token } catch { mpTokenForPix = tenant.mp_access_token }
    }
    if (!mpTokenForPix) mpTokenForPix = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2

    let qrBuffer, pixCode, mpPixId = null

    if (mpTokenForPix && !useDirectPix) {
      const mpPixRes = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mpTokenForPix}`, 'X-Idempotency-Key': txid },
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
        console.error('[pix-mp] Falha MP PIX:', JSON.stringify(mpPixData).substring(0, 300))
      }
    }

    if (!qrBuffer && !pixCode) {
      if (!finalPixKey) return res.status(400).json({ error: 'Chave PIX não configurada. Cadastre uma chave PIX em Configurações ou conecte o Mercado Pago.' })
      pixCode = generatePixCode({ pixKey: finalPixKey, merchantName: finalName, merchantCity: finalCity, amount: parseFloat(amount), txid, description: description?.substring(0, 50) })
      qrBuffer = await QRCode.toBuffer(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
    }

    const viaLabel = mpPixId ? 'PIX (Mercado Pago)' : (useDirectPix ? 'PIX Direto' : 'PIX')
    const textMsg = `💰 *Pagamento ${viaLabel}* - R$ ${parseFloat(amount).toFixed(2)}\n\n${description || ''}\n\n*PIX Copia e Cola:*\n${pixCode}\n\nEscaneie o QR Code abaixo ou copie o código acima.`

    // 1. SALVAR PIX COMO PENDENTE (será enviado quando o cliente clicar "Ver detalhes")
    const pendingContent = `__pending_charge__:amount=${parseFloat(amount)}:desc=${encodeURIComponent(description || '')}:pix=${encodeURIComponent(pixCode)}:method=${viaLabel}`
    await saveMessage(pendingContent, 'payment_pending')
    console.log('[payments/create] PIX salvo como pendente')

    // 2. TENTAR ENVIAR TEXTO DIRETO (se janela 24h aberta)
    let textSent = false
    try {
      await sendWaMessage({ messaging_product: 'whatsapp', to: cleanPhone, type: 'text', text: { body: textMsg } })
      textSent = true
      await saveMessage(textMsg, 'text')
      console.log('[payments/create] Texto PIX enviado OK (janela aberta)')
    } catch (textErr) {
      console.error('[payments/create] Texto falhou:', textErr.message)
      // 3. SE FALHOU (janela 24h), ENVIAR TEMPLATE COM BOTÃO "Ver detalhes"
      // 3a. TENTAR TEMPLATE CUSTOMIZADO (se aprovado)
      let templateSent = false
      try {
        await sendWaMessage({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: { name: 'nova_cobranca_arkiel', language: { code: 'pt_BR' } }
        })
        templateSent = true
        await saveMessage(`📨 *Notificação de cobrança enviada* - R$ ${parseFloat(amount).toFixed(2)}\n${description || ''}\n\n_Cliente deve clicar em "Ver detalhes" para receber o PIX._`, 'text')
        console.log('[payments/create] Template custom enviado (fora janela 24h)')
      } catch (tmplErr) {
        console.error('[payments/create] Template custom falhou:', tmplErr.message)
      }
      // 3b. FALLBACK: TEMPLATE HELLO_WORLD (sempre aprovado)
      if (!templateSent) {
        try {
          await sendWaMessage({
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: { name: 'hello_world', language: { code: 'en_US' } }
          })
          templateSent = true
          await saveMessage(`📨 *Notificação enviada* - R$ ${parseFloat(amount).toFixed(2)}\n${description || ''}\n\n_Cliente recebeu notificação. Quando responder, receberá o PIX automaticamente._`, 'text')
          console.log('[payments/create] Template hello_world enviado (fallback)')
        } catch (hwErr) {
          console.error('[payments/create] Hello world falhou:', hwErr.message)
        }
      }
      if (templateSent) {
        return res.status(200).json({ ok: true, payment_id: paymentId, method: useDirectPix ? 'pix_direct' : 'pix', pix_code: pixCode, mp_pix_id: mpPixId, delivery: 'template' })
      }
      await saveMessage(`${textMsg}\n⚠️ *Não entregue:* Janela 24h expirada e templates falharam.`, 'text')
      return res.status(500).json({ error: 'Não foi possível enviar a cobrança. O cliente não interagiu nas últimas 24h e os templates falharam.' })
    }

    // 4. SE TEXTO DEU CERTO, TENTAR ENVIAR QR CODE TAMBÉM
    if (qrBuffer && textSent) {
      try {
        const blob = new Blob([qrBuffer], { type: 'image/png' })
        const formData = new FormData()
        formData.append('messaging_product', 'whatsapp')
        formData.append('type', 'image/png')
        formData.append('file', blob, 'pix_qr.png')

        const upRes = await fetch(`${WA_API}/${phoneId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${waToken}` }, body: formData })
        const upJson = await upRes.json()

        if (upJson.id) {
          const caption = `📲 *QR Code ${viaLabel}* - R$ ${parseFloat(amount).toFixed(2)}`
          try {
            await sendWaMessage({ messaging_product: 'whatsapp', to: cleanPhone, type: 'image', image: { id: upJson.id, caption } })
            await saveMessage(`__media__:image:${upJson.id}__ ${caption}`, 'image')
            console.log('[payments/create] QR Code enviado OK')
          } catch (imgErr) {
            console.error('[payments/create] Erro imagem (texto já foi):', imgErr.message)
          }
        }
      } catch (uploadErr) {
        console.error('[payments/create] Erro upload:', uploadErr.message)
      }
    }

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

    try {
      await sendWaMessage({ messaging_product: 'whatsapp', to: cleanPhone, type: 'text', text: { body: linkText } })
    } catch (sendErr) {
      await saveMessage(`${linkText}\n⚠️ *Não entregue:* ${sendErr.message}`, 'text')
      return res.status(500).json({ error: `Link criado mas não enviado: ${sendErr.message}` })
    }

    await saveMessage(linkText, 'text')

    return res.status(200).json({ ok: true, payment_id: paymentId, method: method === 'both' ? 'both' : 'mercadopago', checkout_url: mpData.init_point })
  }

  return res.status(400).json({ error: 'Método inválido.' })
}
