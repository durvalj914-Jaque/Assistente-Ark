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

  const { data: bot } = await db.from('bots').select('id, name, phone_number_id, access_token').eq('id', conv.bot_id).maybeSingle()
  if (!bot) return res.status(404).json({ error: 'Bot não encontrado' })

  const { data: tenant } = await db.from('tenants').select('id, name, pix_key, merchant_name, merchant_city, mp_access_token').eq('id', conv.tenant_id).maybeSingle()

  const finalPixKey = pix_key || tenant?.pix_key
  const finalName = (merchant_name || tenant?.merchant_name || tenant?.name || 'Arkiel').substring(0, 25)
  const finalCity = (merchant_city || tenant?.merchant_city || 'SAO PAULO').substring(0, 15)

  const txid = `ARK${Date.now().toString(36).toUpperCase()}`
  const { data: payment, error: payErr } = await db.from('payments').insert({
    tenant_id: conv.tenant_id, bot_id: conv.bot_id, conversation_id, contact_id: conv.contact_id,
    amount: parseFloat(amount), description: description || 'Pagamento', status: 'pending', method,
    payment_ref: txid, metadata: { txid },
  }).select().single()

  if (payErr) return res.status(500).json({ error: payErr.message })

  const waToken = bot.access_token || process.env.WHATSAPP_ACCESS_TOKEN_2
  const phoneId = bot.phone_number_id

  const { data: contact } = await db.from('contacts').select('phone').eq('id', conv.contact_id).maybeSingle()
  if (!contact?.phone) return res.status(400).json({ error: 'Contato sem telefone' })

  if (method === 'pix' || method === 'both') {
    if (!finalPixKey) return res.status(400).json({ error: 'Chave PIX não configurada. Configure em Configurações.' })

    const pixCode = generatePixCode({ pixKey: finalPixKey, merchantName: finalName, merchantCity: finalCity, amount: parseFloat(amount), txid, description: description?.substring(0, 50) })
    const qrBuffer = await QRCode.toBuffer(pixCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })

    const blob = new Blob([qrBuffer], { type: 'image/png' })
    const formData = new FormData()
    formData.append('messaging_product', 'whatsapp')
    formData.append('type', 'image/png')
    formData.append('file', blob, 'pix_qr.png')

    const upRes = await fetch(`${WA_API}/${phoneId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${waToken}` }, body: formData })
    const upJson = await upRes.json()
    if (!upJson.id) return res.status(500).json({ error: 'Falha ao subir QR Code', detail: upJson })

    await fetch(`${WA_API}/${phoneId}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: contact.phone, type: 'image',
        image: { id: upJson.id, caption: `💰 *Pagamento PIX* - R$ ${parseFloat(amount).toFixed(2)}\n\n${description || ''}\n\n*Escaneie o QR Code ou copie o código abaixo:*\n\n${pixCode}` } }),
    })

    await db.from('payments').update({ pix_code: pixCode, pix_qr_url: upJson.id }).eq('id', payment.id)
    await db.from('messages').insert({ tenant_id: conv.tenant_id, conversation_id, bot_id: conv.bot_id, contact_id: conv.contact_id, direction: 'outbound', type: 'image', content: `__media__:image:${upJson.id}__ 💰 *Pagamento PIX* - R$ ${parseFloat(amount).toFixed(2)}\n${description || ''}`, sent_by: 'human' })

    // Se method === 'both', nao retorna ainda — continua para criar tambem o link de Checkout
    if (method !== 'both') {
      return res.status(200).json({ ok: true, payment_id: payment.id, method: 'pix', pix_code: pixCode })
    }

  } else if (method === 'mercadopago' || method === 'both') {
    // Usa token do tenant (OAuth) com fallback para token da plataforma
    let mpToken = null
    if (tenant?.mp_access_token) {
      try { mpToken = JSON.parse(tenant.mp_access_token).access_token } catch { mpToken = tenant.mp_access_token }
    }
    if (!mpToken) mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_3 || process.env.MERCADO_PAGO_ACCESS_TOKEN_2
    if (!mpToken) return res.status(400).json({ error: 'Mercado Pago não configurado.' })

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` },
      body: JSON.stringify({
        items: [{ title: description || 'Pagamento', quantity: 1, unit_price: parseFloat(amount), currency_id: 'BRL' }],
        back_urls: { success: 'https://arkiel.com.br/pagamento/sucesso', failure: 'https://arkiel.com.br/pagamento/erro', pending: 'https://arkiel.com.br/pagamento/pendente' },
        auto_return: 'approved', external_reference: txid, statement_descriptor: finalName.substring(0, 12),
        notification_url: 'https://arkiel.com.br/api/mercadopago/webhook',
      }),
    })
    const mpData = await mpRes.json()
    if (!mpData.init_point) return res.status(500).json({ error: 'Falha ao criar pagamento MP', detail: mpData })

    const linkText = `💳 *Pagamento* - R$ ${parseFloat(amount).toFixed(2)}\n\n${description || ''}\n\n*Pague via link seguro:*\n${mpData.init_point}\n\nAceita PIX, cartão e boleto.`
    await fetch(`${WA_API}/${phoneId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: contact.phone, type: 'text', text: { body: linkText } }) })

    await db.from('payments').update({ mp_preference_id: mpData.id, mp_checkout_url: mpData.init_point }).eq('id', payment.id)
    await db.from('messages').insert({ tenant_id: conv.tenant_id, conversation_id, bot_id: conv.bot_id, contact_id: conv.contact_id, direction: 'outbound', type: 'text', content: linkText, sent_by: 'human' })

    return res.status(200).json({ ok: true, payment_id: payment.id, method: method === 'both' ? 'both' : 'mercadopago', checkout_url: mpData.init_point })
  }

  return res.status(400).json({ error: 'Método inválido.' })
}
