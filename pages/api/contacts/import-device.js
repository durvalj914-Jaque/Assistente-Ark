/**
 * POST /api/contacts/import-device
 * Importa contatos enviados pelo dispositivo (vCard .vcf, .csv, ou JSON).
 * Body: FormData com file (.vcf/.csv) + tenant_id  OU  JSON { tenant_id, contacts: [...] }
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

// Desabilita bodyParser do Next.js para ler o raw body do multipart
export const config = { api: { bodyParser: false } }

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

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const firstLine = lines[0]
  let delim = ','
  if (firstLine.split(';').length > firstLine.split(',').length) delim = ';'
  else if (firstLine.includes('\t')) delim = '\t'

  const headers = firstLine.split(delim).map(h => h.trim().toLowerCase().replace(/"/g, ''))

  const nameIdx = headers.findIndex(h => h.match(/nome|name|fullname|full_name|nome completo/))
  const phoneIdx = headers.findIndex(h => h.match(/telefone|phone|celular|whats|mobile|numero/))
  const emailIdx = headers.findIndex(h => h.match(/email|e-mail|mail/))
  const orgIdx = headers.findIndex(h => h.match(/empresa|organization|org|company/))

  const contacts = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.trim().replace(/^"|"$/g, ''))
    contacts.push({
      name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
      phone: phoneIdx >= 0 ? cols[phoneIdx] || '' : '',
      email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
      organization: orgIdx >= 0 ? cols[orgIdx] || '' : '',
    })
  }
  return contacts.filter(c => c.name || c.phone || c.email)
}

/**
 * Parser manual de multipart/form-data robusto usando Buffer.
 */
function parseMultipart(rawBuffer, boundary) {
  const fields = {}
  const files = {}
  const boundaryStr = '--' + boundary
  const boundaryBuf = Buffer.from(boundaryStr)

  // Encontrar todas as posições do boundary no buffer
  const positions = []
  for (let i = 0; i <= rawBuffer.length - boundaryBuf.length; i++) {
    let match = true
    for (let j = 0; j < boundaryBuf.length; j++) {
      if (rawBuffer[i + j] !== boundaryBuf[j]) { match = false; break }
    }
    if (match) {
      positions.push(i)
      i += boundaryBuf.length - 1
    }
  }

  for (let p = 0; p < positions.length - 1; p++) {
    let partStart = positions[p] + boundaryBuf.length
    let partEnd = positions[p + 1]

    // Skip CRLF após boundary
    if (partStart < rawBuffer.length - 1 && rawBuffer[partStart] === 0x0D && rawBuffer[partStart + 1] === 0x0A) {
      partStart += 2
    }

    let partBuffer = rawBuffer.slice(partStart, partEnd)
    // Remover trailing CRLF
    if (partBuffer.length >= 2 && partBuffer[partBuffer.length - 2] === 0x0D && partBuffer[partBuffer.length - 1] === 0x0A) {
      partBuffer = partBuffer.slice(0, -2)
    }

    // Separar headers do body (double CRLF = \r\n\r\n)
    const sep = Buffer.from('\r\n\r\n')
    const sepIdx = partBuffer.indexOf(sep)
    if (sepIdx === -1) continue

    const headerStr = partBuffer.slice(0, sepIdx).toString('utf-8')
    const bodyBuffer = partBuffer.slice(sepIdx + sep.length)

    const nameMatch = headerStr.match(/name="([^"]+)"/)
    if (!nameMatch) continue
    const fieldName = nameMatch[1]

    const filenameMatch = headerStr.match(/filename="([^"]*)"/)
    const ctMatch = headerStr.match(/content-type:\s*([^\r\n]+)/i)

    if (filenameMatch) {
      files[fieldName] = {
        filename: filenameMatch[1],
        contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
        data: bodyBuffer,
      }
    } else {
      fields[fieldName] = bodyBuffer.toString('utf-8').trim()
    }
  }

  return { fields, files }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentType = req.headers['content-type'] || ''
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })

  let tenantId, contactsList = []

  if (contentType.includes('multipart/form-data')) {
    // Ler raw body
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const rawBuffer = Buffer.concat(chunks)

    // Extrair boundary
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
    if (!boundaryMatch) return res.status(400).json({ error: 'Boundary não encontrado' })
    const boundary = boundaryMatch[1].replace(/"/g, '')

    // Parse multipart
    const { fields, files } = parseMultipart(rawBuffer, boundary)
    tenantId = fields.tenant_id || ''

    if (!tenantId) return res.status(400).json({ error: 'tenant_id é obrigatório' })

    // Processar cada arquivo
    for (const [fieldName, file] of Object.entries(files)) {
      const text = file.data.toString('utf-8')
      const filename = (file.filename || '').toLowerCase()

      if (text.includes('BEGIN:VCARD')) {
        const parsed = parseVCard(text)
        contactsList.push(...parsed)
      } else if (filename.endsWith('.csv') || file.contentType.includes('csv') || text.includes(',') || text.includes(';')) {
        const parsed = parseCSV(text)
        contactsList.push(...parsed)
      }
    }

    if (!contactsList.length) {
      return res.status(400).json({
        error: 'Nenhum contato válido encontrado no arquivo. Verifique se o formato é .vcf ou .csv',
        debug: {
          filesReceived: Object.keys(files).length,
          fileNames: Object.values(files).map(f => f.filename),
          fileSizes: Object.values(files).map(f => f.data.length),
        }
      })
    }
  } else {
    // JSON do Contact Picker API
    let body = req.body
    if (typeof body === 'string') body = JSON.parse(body)
    tenantId = body.tenant_id
    contactsList = body.contacts || []
  }

  if (!tenantId) return res.status(400).json({ error: 'tenant_id é obrigatório' })
  if (!contactsList.length) return res.status(400).json({ error: 'Nenhum contato válido encontrado' })

  // Autenticar
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  // Verificar permissão
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
    let phone = (c.phone || '').replace(/[^\d+]/g, '')
    if (phone && !phone.startsWith('+')) phone = '+' + phone

    const contactData = {
      tenant_id: tenantId,
      full_name: c.name || '',
      phone,
      email: c.email || '',
      organization: c.organization || '',
      source: 'device',
      synced_at: new Date().toISOString(),
    }

    if (!contactData.full_name && !contactData.phone && !contactData.email) {
      skipped++
      continue
    }

    let existingQuery = db.from('contacts').select('id').eq('tenant_id', tenantId).limit(1)
    if (contactData.phone) existingQuery = existingQuery.eq('phone', contactData.phone)
    else if (contactData.email) existingQuery = existingQuery.eq('email', contactData.email)
    else { skipped++; continue }

    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      const { error } = await db.from('contacts')
        .update({ ...contactData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) errors++
      else imported++
    } else {
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
