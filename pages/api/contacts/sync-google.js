/**
 * POST /api/contacts/sync-google
 * Sincroniza contatos do Google People API usando tokens salvos.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

async function refreshAccessToken(tenant_id, db) {
  const { data: auth } = await db
    .from('google_contacts_auth')
    .select('refresh_token, access_token, expires_at')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (!auth) return null

  // Token ainda valido?
  if (auth.expires_at && new Date(auth.expires_at) > new Date(Date.now() + 60000)) {
    return auth.access_token
  }

  // Refresh
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!auth.refresh_token || !clientSecret) return null

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: auth.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      })
    })

    const tokens = await resp.json()
    if (!resp.ok || !tokens.access_token) return null

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()
    await db.from('google_contacts_auth')
      .update({ access_token: tokens.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant_id)

    return tokens.access_token
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body = req.body
  if (typeof body === 'string') body = JSON.parse(body)
  const { tenant_id } = body
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

  // Auth
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado' })

  if (!profile.is_platform_admin) {
    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).eq('tenant_id', tenant_id).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
  }

  const accessToken = await refreshAccessToken(tenant_id, db)
  if (!accessToken) {
    return res.status(401).json({ needsAuth: true, error: 'Google não conectado. Clique em "Conectar Google".' })
  }

  try {
    let allContacts = []
    let pageToken = null
    let hasMore = true
    let pageCount = 0

    while (hasMore && pageCount < 10) {
      let url = 'https://people.googleapis.com/v1/people:connections?resourceName=people/me'
      url += '&pageSize=1000'
      url += '&personFields=names,emailAddresses,phoneNumbers,photos,organizations,biographies'
      url += '&sortOrder=FIRST_NAME_ASCENDING'
      if (pageToken) url += `&pageToken=${pageToken}`

      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
      if (!resp.ok) {
        if (resp.status === 401) return res.status(401).json({ needsAuth: true, error: 'Token expirado. Reconecte o Google.' })
        const errBody = await resp.text()
        return res.status(resp.status).json({ error: 'Erro ao buscar contatos', detail: errBody })
      }

      const data = await resp.json()
      allContacts = allContacts.concat(data.connections || [])
      pageToken = data.nextPageToken
      hasMore = !!pageToken
      pageCount++
    }

    // Mapear contatos
    const contactsData = allContacts.map(person => {
      const name = person.names?.[0]?.displayName || ''
      const email = person.emailAddresses?.[0]?.value || ''
      let phone = person.phoneNumbers?.[0]?.value || ''
      const phoneE164 = person.phoneNumbers?.[0]?.canonicalForm || ''
      const photoUrl = person.photos?.[0]?.url || ''
      const org = person.organizations?.[0]?.name || ''
      const jobTitle = person.organizations?.[0]?.title || ''
      const notes = person.biographies?.[0]?.value || ''

      // Normalizar telefone
      phone = phone.replace(/[^\d+]/g, '')
      if (phone && !phone.startsWith('+')) phone = '+' + phone

      return {
        tenant_id,
        google_resource_name: person.resourceName,
        name,
        email: email || null,
        phone: phone || null,
        phone_e164: phoneE164 || null,
        photo_url: photoUrl || null,
        organization: org || null,
        job_title: jobTitle || null,
        notes: notes || null,
        source: 'google',
        synced_at: new Date().toISOString(),
      }
    }).filter(c => c.name || c.email || c.phone)

    // Batch upsert (500 por vez)
    let synced = 0, errors = 0
    const BATCH = 500
    for (let i = 0; i < contactsData.length; i += BATCH) {
      const batch = contactsData.slice(i, i + BATCH)
      const { error } = await db.from('contacts')
        .upsert(batch, { onConflict: 'tenant_id,google_resource_name' })
      if (error) { errors += batch.length }
      else { synced += batch.length }
    }

    const { count } = await db.from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)

    return res.status(200).json({
      ok: true,
      synced,
      errors,
      total_in_db: count || 0,
      total_from_google: contactsData.length,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro inesperado', detail: e.message })
  }
}
