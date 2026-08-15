import { supabase, supabaseAdmin } from '../../../lib/supabase'

export const config = { api: { bodyParser: false } }

function unfoldLines(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

function parseVCard(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  text = unfoldLines(text)
  const cards = text.split('BEGIN:VCARD').slice(1)
  return cards.map(cardText => {
    const block = cardText.split('END:VCARD')[0]
    let name = '', phone = '', email = '', org = ''
    const fnMatch = block.match(/^(?:item\d+\.)?FN:(.+)$/m)
    if (fnMatch) name = fnMatch[1].trim()
    const telMatch = block.match(/^(?:item\d+\.)?TEL[^:]*:(.+)$/m)
    if (telMatch) phone = telMatch[1].trim()
    const emailMatch = block.match(/^(?:item\d+\.)?EMAIL[^:]*:(.+)$/m)
    if (emailMatch) email = emailMatch[1].trim()
    const orgMatch = block.match(/^ORG[^:]*:(.+)$/m)
    if (orgMatch) org = orgMatch[1].trim()
    if (!name) {
      const nMatch = block.match(/^N[^:]*:(.+)$/m)
      if (nMatch) {
        const parts = nMatch[1].split(';').filter(Boolean).reverse()
        name = parts.join(' ').trim()
      }
    }
    return { name, phone, email, organization: org }
  }).filter(c => c.name || c.phone || c.email)
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const firstLine = lines[0]
  let delim = ','
  if (firstLine.split(';').length > firstLine.split(',').length) delim = ';'
  else if (firstLine.includes('\t')) delim = '\t'
  const headers = firstLine.split(delim).map(h => h.trim().toLowerCase().replace(/"/g, ''))
  const nameIdx = headers.findIndex(h => h.match(/nome|name|fullname|nome completo/))
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
    if (match) { positions.push(i); i += boundaryBuf.length - 1 }
  }
  for (let p = 0; p < positions.length - 1; p++) {
    let partStart = positions[p] + boundaryBuf.length
    let partEnd = positions[p + 1]
    if (partStart < rawBuffer.length - 1 && rawBuffer[partStart] === 0x0D && rawBuffer[partStart + 1] === 0x0A) partStart += 2
    let partBuffer = rawBuffer.slice(partStart, partEnd)
    if (partBuffer.length >= 2 && partBuffer[partBuffer.length - 2] === 0x0D && partBuffer[partBuffer.length - 1] === 0x0A) partBuffer = partBuffer.slice(0, -2)
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
      files[fieldName] = { filename: filenameMatch[1], contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream', data: bodyBuffer }
    } else {
      fields[fieldName] = bodyBuffer.toString('utf-8').trim()
    }
  }
  return { fields, files }
}

// Ler o body bruto da requisicao (usado quando bodyParser esta desativado)
async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentType = req.headers['content-type'] || ''
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const userToken = authHeader.replace('Bearer ', '')

  let tenantId, contactsList = []
  let importSource = 'device'

  if (contentType.includes('multipart/form-data')) {
    // Upload de arquivo (.vcf / .csv)
    const rawBuffer = await readBody(req)
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
    if (!boundaryMatch) return res.status(400).json({ error: 'Boundary não encontrado' })
    const boundary = boundaryMatch[1].replace(/"/g, '')
    const { fields, files } = parseMultipart(rawBuffer, boundary)
    tenantId = fields.tenant_id || ''
    importSource = fields.source || 'device'

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
        debug: { filesReceived: Object.keys(files).length, fileNames: Object.values(files).map(f => f.filename) }
      })
    }
  } else {
    // JSON body (sincronizacao do dispositivo via Contact Picker API)
    const rawBuffer = await readBody(req)
    try {
      const body = JSON.parse(rawBuffer.toString('utf-8'))
      tenantId = body.tenant_id
      contactsList = body.contacts || []
      importSource = body.source || 'device'
    } catch (e) {
      return res.status(400).json({ error: 'Body inválido: esperado JSON ou multipart/form-data' })
    }
  }

  if (!tenantId) return res.status(400).json({ error: 'tenant_id é obrigatório' })
  if (!contactsList.length) return res.status(400).json({ error: 'Nenhum contato válido encontrado' })

  // Auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(userToken)
  if (authErr || !user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado' })
  if (!profile.is_platform_admin) {
    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).eq('tenant_id', tenantId).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão para este tenant' })
  }

  // Normalizar
  const normalized = contactsList.map(c => {
    let phone = (c.phone || '').replace(/[^\d+]/g, '')
    if (phone && !phone.startsWith('+')) phone = '+' + phone
    return {
      tenant_id: tenantId,
      name: (c.name || '').trim(),
      phone: phone || null,
      email: (c.email || '').trim() || null,
      organization: (c.organization || '').trim() || null,
      source: importSource,
      synced_at: new Date().toISOString(),
    }
  }).filter(c => c.name || c.phone || c.email)

  // Buscar duplicatas em batch
  const phones = normalized.filter(c => c.phone).map(c => c.phone)
  const emails = normalized.filter(c => c.email && !c.phone).map(c => c.email)
  let existingMap = new Map()
  if (phones.length > 0) {
    const { data: existingByPhone } = await db.from('contacts').select('id, phone, email').eq('tenant_id', tenantId).in('phone', phones)
    ;(existingByPhone || []).forEach(c => existingMap.set(c.phone, c))
  }
  if (emails.length > 0) {
    const { data: existingByEmail } = await db.from('contacts').select('id, phone, email').eq('tenant_id', tenantId).in('email', emails)
    ;(existingByEmail || []).forEach(c => { if (!existingMap.has(c.phone)) existingMap.set(`email:${c.email}`, c) })
  }

  const toInsert = []
  const toUpdate = []
  let skipped = 0
  for (const c of normalized) {
    if (!c.phone && !c.email) { skipped++; continue }
    const key = c.phone ? c.phone : `email:${c.email}`
    const existing = existingMap.get(key)
    if (existing) toUpdate.push({ ...c, id: existing.id, updated_at: new Date().toISOString() })
    else toInsert.push(c)
  }

  let imported = 0, errors = 0
  const errorMessages = []
  const BATCH_SIZE = 500
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const { error } = await db.from('contacts').insert(batch)
    if (error) { errors += batch.length; if (errorMessages.length < 5) errorMessages.push(`Insert: ${error.message} (${error.code})`) }
    else imported += batch.length
  }
  for (const c of toUpdate) {
    const { id, ...updateData } = c
    const { error } = await db.from('contacts').update(updateData).eq('id', id)
    if (error) { errors++; if (errorMessages.length < 5) errorMessages.push(`Update: ${error.message} (${error.code})`) }
    else imported++
  }

  return res.status(200).json({
    ok: true, imported,
    skipped: skipped + (contactsList.length - normalized.length),
    errors, total: contactsList.length,
    parsed: normalized.length,
    newContacts: toInsert.length,
    updatedContacts: toUpdate.length,
    source: importSource,
    errorMessages: errors > 0 ? errorMessages : undefined,
  })
}
