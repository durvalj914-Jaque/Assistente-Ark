/**
 * POST /api/contacts/sync-google
 * Sincroniza contatos do Google People API usando tokens salvos.
 * Body: { tenant_id: string }
 * Funciona para: platform admin (qualquer tenant) OU usuário autenticado dono do tenant.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

async function refreshAccessToken(tenant_id, db) {
  const { data: auth } = await db
    .from('google_contacts_auth')
    .select('refresh_token, access_token, expires_at')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (!auth) return null

  if (auth.expires_at && new Date(auth.expires_at) > new Date(Date.now() + 60000)) {
    return auth.access_token
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!auth.refresh_token || !clientSecret) return null

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
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant_id } = req.body
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

  // Verificar autenticação — usuário autenticado OU platform admin
  const authHeader = req.headers.authorization
  let userId = null
  let isPlatformAdmin = false
  let db = supabaseAdmin() // default to admin

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      userId = user.id
      // Verificar se é platform admin
      const { data: profile } = await supabaseAdmin()
        .from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
      isPlatformAdmin = profile?.is_platform_admin || false

      // Se não é platform admin, verificar se é dono do tenant
      if (!isPlatformAdmin) {
        const { data: member } = await supabaseAdmin()
          .from('tenant_members').select('tenant_id, role')
          .eq('user_id', user.id).eq('tenant_id', tenant_id).maybeSingle()
        if (!member) return res.status(403).json({ error: 'Sem permissão para este tenant' })
      }
    } else {
      return res.status(401).json({ error: 'Sessão inválida' })
    }
  } else {
    return res.status(401).json({ error: 'Não autenticado' })
  }

  const accessToken = await refreshAccessToken(tenant_id, supabaseAdmin())
  if (!accessToken) {
    return res.status(401).json({
      error: 'Google não conectado. Clique em "Conectar Google" para autorizar.',
      needsAuth: true
    })
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
        if (resp.status === 401) return res.status(401).json({ error: 'Token expirado. Reconecte o Google.', needsAuth: true })
        const errBody = await resp.text()
        return res.status(resp.status).json({ error: 'Erro ao buscar contatos', detail: errBody })
      }

      const data = await resp.json()
      allContacts = allContacts.concat(data.connections || [])
      pageToken = data.nextPageToken
      hasMore = !!pageToken
      pageCount++
    }

    const contactsData = allContacts.map(person => {
      const name = person.names?.[0]?.displayName || ''
      const email = person.emailAddresses?.[0]?.value || ''
      const phone = person.phoneNumbers?.[0]?.value || ''
      const phoneE164 = person.phoneNumbers?.[0]?.canonicalForm || ''
      const photoUrl = person.photos?.[0]?.url || ''
      const org = person.organizations?.[0]?.name || ''
      const jobTitle = person.organizations?.[0]?.title || ''
      const notes = person.biographies?.[0]?.value || ''

      return {
        tenant_id,
        google_resource_name: person.resourceName,
        name: name,
        email,
        phone,
        phone_e164: phoneE164,
        photo_url: photoUrl,
        organization: org,
        job_title: jobTitle,
        notes,
        raw_data: person,
        synced_at: new Date().toISOString(),
      }
    }).filter(c => c.name || c.email || c.phone)

    // Upsert contatos
    let synced = 0
    let errors = 0
    for (const contact of contactsData) {
      const { error } = await supabaseAdmin()
        .from('contacts')
        .upsert(contact, { onConflict: 'tenant_id,google_resource_name' })
      if (error) errors++
      else synced++
    }

    // Contar total no banco
    const { count } = await supabaseAdmin()
      .from('contacts').select('*', { count: 'exact', head: true })
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
