/**
 * POST /api/contacts/import-device
 * Importa contatos enviados pelo dispositivo (vCard .vcf ou JSON do Contact Picker API).
 * Body: { tenant_id, contacts: [{ name, phone, email }] }  OU  FormData com file .vcf
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

function parseVCard(text) {
  const cards = text.split('BEGIN:VCARD').slice(1)
  return cards.map(cardText => {
    const block = cardText.split('END:VCARD')[0]
    let name = '', phone = '', email = ''

    const fnMatch = block.match(/^FN:(.+)$/m)
    if (fnMatch) name = fnMatch[1].trim()

    const telMatch = block.match(/^TEL[^:]*:(.+)$/m)
    if (telMatch) phone = telMatch[1].trim()

    const emailMatch = block.match(/^EMAIL[^:]*:(.+)$/m)
    if (emailMatch) email = emailMatch[1].trim()

    // Se não tem FN, tentar N:
    if (!name) {
      const nMatch = block.match(/^N:(.+)$/m)
      if (nMatch) {
        const parts = nMatch[1].split(';').filter(Boolean).reverse()
        name = parts.join(' ').trim()
      }
    }

    return { name, phone, email }
  }).filter(c => c.name || c.phone || c.email)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentType = req.headers['content-type'] || ''

  let tenantId, contactsList = []

  if (contentType.includes('multipart/form-data')) {
    // Upload de arquivo vCard
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const rawBody = Buffer.concat(chunks).toString('utf-8')

    // Parse simples do FormData boundary
    const boundary = contentType.split('boundary=')[1]
    const parts = rawBody.split('--' + boundary)

    let vcardText = ''
    for (const part of parts) {
      if (part.includes('BEGIN:VCARD')) {
        vcardText += part.substring(part.indexOf('BEGIN:VCARD'))
      }
      if (part.includes('name="tenant_id"')) {
        const m = part.match(/name="tenant_id"[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/)
        if (m) tenantId = m[1].trim()
      }
    }

    if (!vcardText) return res.status(400).json({ error: 'Nenhum vCard encontrado no arquivo' })
    contactsList = parseVCard(vcardText)
  } else {
    // JSON do Contact Picker API
    const body = req.body
    tenantId = body.tenant_id
    contactsList = body.contacts || []
  }

  if (!tenantId) return res.status(400).json({ error: 'tenant_id é obrigatório' })
  if (!contactsList.length) return res.status(400).json({ error: 'Nenhum contato válido encontrado' })

  // Verificar autenticação
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  // Verificar permissão (dono do tenant ou platform admin)
  const { data: profile } = await supabaseAdmin()
    .from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  const isPlatformAdmin = profile?.is_platform_admin || false

  if (!isPlatformAdmin) {
    const { data: member } = await supabaseAdmin()
      .from('tenant_members').select('tenant_id').eq('user_id', user.id).eq('tenant_id', tenantId).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
  }

  // Importar contatos
  const db = supabaseAdmin()
  let imported = 0, skipped = 0, errors = 0

  for (const c of contactsList) {
    // Normalizar telefone
    let phone = (c.phone || '').replace(/[^\d+]/g, '')
    if (phone && !phone.startsWith('+')) phone = '+' + phone

    const contactData = {
      tenant_id: tenantId,
      full_name: c.name || '',
      phone,
      email: c.email || '',
      source: 'device',
      synced_at: new Date().toISOString(),
    }

    if (!contactData.full_name && !contactData.phone && !contactData.email) {
      skipped++
      continue
    }

    // Verificar se já existe (mesmo phone OU mesmo email no tenant)
    let existingQuery = db.from('contacts').select('id').eq('tenant_id', tenantId).limit(1)
    if (contactData.phone) existingQuery = existingQuery.eq('phone', contactData.phone)
    else if (contactData.email) existingQuery = existingQuery.eq('email', contactData.email)
    else { skipped++; continue }

    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      // Atualizar
      const { error } = await db.from('contacts')
        .update({ ...contactData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) errors++
      else imported++
    } else {
      // Criar
      const { error } = await db.from('contacts').insert(contactData)
      if (error) errors++
      else imported++
    }
  }

  return res.status(200).json({
    ok: true,
    imported,
    skipped,
    errors,
    total: contactsList.length,
  })
}
