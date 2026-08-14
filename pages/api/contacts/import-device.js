/**
 * POST /api/contacts/import-device
 * Importa contatos enviados pelo dispositivo (vCard .vcf, .csv, ou JSON).
 * Body: FormData com file (.vcf/.csv) + tenant_id  OU  JSON { tenant_id, contacts: [...] }
 * Usa o client autenticado do usuário (não service role) — a tabela contacts tem RLS permissiva.
 */
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

function parseVCard(text) {
  const cards = text.split('BEGIN:VCARD').slice(1)
  return cards.map(cardText => {
    const block = cardText.split('END:VCARD')[0]
    let name = '', phone = '', email = '', org = ''

    const fnMatch = block.match(/^FN:(.+)$/m)
    if (fnMatch) name = fnMatch[1].trim()

    const telMatch = block.match(/^TEL[^:]*:(.+)$/m)
    if (telMatch) phone = telMatch[1].trim()

    const emailMatch = block.match(/^EMAIL[^:]*:(.+)$/m)
    if (emailMatch) email = emailMatch[1].trim()

    const orgMatch = block.match(/^ORG[^:]*:(.+)$/m)
    if (orgMatch) org = orgMatch[1].trim()

    if (!name) {
      const nMatch = block.match(/^N:(.+)$/m)
      if (nMatch) {
        const parts = nMatch[1].split(';').filter(Boolean).reverse()
        name = parts.join(' ').trim()
      }
    }

    return { name, phone, email, organization: org }
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
 * Parser robusto de multipart/form-data usando Buffer.
 */
function parseMultipart(rawBuffer, boundary) {
  const fields = {}
  const files = {}
  const boundaryStr = '--' + boundary
  const boundaryBuf = Buffer.from(boundaryStr)

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

    if (partStart < rawBuffer.length - 1 && rawBuffer[partStart] === 0x0D && rawBuffer[partStart + 1] === 0x0A) {
      partStart += 2
    }

    let partBuffer = rawBuffer.slice(partStart, partEnd)
    if (partBuffer.length >= 2 && partBuffer[partBuffer.length - 2] === 0x0D && partBuffer[partBuffer.length - 1] === 0x0A) {
      partBuffer = partBuffer.slice(0, -2)
    }

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

  const userToken = authHeader.replace('Bearer ', '')

  let tenantId, contactsList = []

  if (contentType.includes('multipart/form-data')) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const rawBuffer = Buffer.concat(chunks)

    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
    if (!boundaryMatch) return res.status(400).json({ error: 'Boundary não encontrado' })
    const boundary = boundaryMatch[1].replace(/"/g, '')

    const { fields, files } = parseMultipart(rawBuffer, boundary)
    tenantId = fields.tenant_id || ''

    if (!tenantId) return res.status(400).json({ error: 'tenant_id é obrigatório' })

    for (const [fieldName, file] of Object.entries(files)) {
      const text = file.data.toString('utf-8')
      const filename = (file.filename || '').toLowerCase()

      if (text.includes('BEGIN:VCARD')) {
        contactsList.push(...parseVCard(text))
      } else if (filename.endsWith('.csv') || file.contentType.includes('csv') || text.includes(',') || text.includes(';')) {
        contactsList.push(...parseCSV(text))
      }
    }

    if (!contactsList.length) {
      return res.status(400).json({
        error: 'Nenhum contato válido encontrado. Verifique se é .vcf ou .csv',
        debug: {
          filesReceived: Object.keys(files).length,
          fileNames: Object.values(files).map(f => f.filename),
          fileSizes: Object.values(files).map(f => f.data.length),
        }
      })
    }
  } else {
    let body = req.body
    if (typeof body === 'string') body = JSON.parse(body)
    tenantId = body.tenant_id
    contactsList = body.contacts || []
  }

  if (!tenantId) return res.status(400).json({ error: 'tenant_id é obrigatório' })
  if (!contactsList.length) return res.status(400).json({ error: 'Nenhum contato válido encontrado' })

  // Cliente autenticado com o token do usuário (RLS da tabela contacts é permissiva)
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const db = createClient(supaUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${userToken}` } }
  })

  // Verificar autenticação
  const { data: { user }, error: authErr } = await db.auth.getUser(userToken)
  if (authErr || !user) return res.status(401).json({ error: 'Sessão inválida' })

  // Verificar se a tabela contacts existe
  const { error: tableCheck } = await db.from('contacts').select('id').limit(1)
  if (tableCheck) {
    return res.status(500).json({
      error: 'Tabela de contatos não existe. Clique em "Inicializar" primeiro.',
      detail: tableCheck.message
    })
  }

  // Importar contatos — SÓ colunas que existem na tabela
  let imported = 0, skipped = 0, errors = 0
  const errorMessages = []

  for (const c of contactsList) {
    let phone = (c.phone || '').replace(/[^\d+]/g, '')
    if (phone && !phone.startsWith('+')) phone = '+' + phone

    const contactData = {
      tenant_id: tenantId,
      full_name: c.name || '',
      phone,
      email: c.email || '',
      organization: c.organization || '',
      synced_at: new Date().toISOString(),
    }

    if (!contactData.full_name && !contactData.phone && !contactData.email) {
      skipped++
      continue
    }

    // Verificar se já existe (por phone ou email)
    let existingQuery = db.from('contacts').select('id').eq('tenant_id', tenantId).limit(1)
    if (contactData.phone) existingQuery = existingQuery.eq('phone', contactData.phone)
    else if (contactData.email) existingQuery = existingQuery.eq('email', contactData.email)
    else { skipped++; continue }

    const { data: existing, error: existErr } = await existingQuery.maybeSingle()

    if (existing) {
      const { error } = await db.from('contacts')
        .update({ ...contactData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) {
        errors++
        if (errors === 1) console.error('[import-device] PRIMEIRO ERRO UPDATE:', JSON.stringify({ message: error.message, code: error.code, details: error.details, contact: contactData }))
        if (errorMessages.length < 5) errorMessages.push(`Update: ${error.message} (${error.code})`)
      }
      else imported++
    } else {
      const { error } = await db.from('contacts').insert(contactData)
      if (error) {
        errors++
        if (errors === 1) console.error('[import-device] PRIMEIRO ERRO INSERT:', JSON.stringify({ message: error.message, code: error.code, details: error.details, contact: contactData }))
        if (errorMessages.length < 5) errorMessages.push(`Insert: ${error.message} (${error.code})`)
      }
      else imported++
    }
  }

  return res.status(200).json({
    ok: true,
    imported,
    skipped,
    errors,
    total: contactsList.length,
    errorMessages: errors > 0 ? errorMessages : undefined,
  })
}
