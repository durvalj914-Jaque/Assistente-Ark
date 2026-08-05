/**
 * POST /api/contacts/sync-google
 * Sincroniza contatos do Google People API usando tokens salvos.
 * Body: { tenant_id: string }
 * Usa os tokens armazenados em google_contacts_auth (fluxo OAuth próprio).
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'
import { supabaseAdmin } from '../../../lib/supabase'

async function refreshAccessToken(tenant_id, db) {
  // Buscar o refresh token
  const { data: auth } = await db
    .from('google_contacts_auth')
    .select('refresh_token, access_token, expires_at')
    .eq('tenant_id', tenant_id)
    .single()

  if (!auth) return null

  // Se o token ainda é válido (com margem de 60s), usar direto
  if (auth.expires_at && new Date(auth.expires_at) > new Date(Date.now() + 60000)) {
    return auth.access_token
  }

  // Renovar com refresh token
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

  // Atualizar no banco
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()
  await db.from('google_contacts_auth')
    .update({
      access_token: tokens.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenant_id)

  return tokens.access_token
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db, user } = ctx

  const { tenant_id } = req.body
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

  // Pegar token do fluxo OAuth próprio
  const accessToken = await refreshAccessToken(tenant_id, db)

  if (!accessToken) {
    return res.status(401).json({ 
      error: 'Google não conectado. Clique em "Conectar Google" para autorizar o acesso aos contatos.',
      needsAuth: true 
    })
  }

  try {
    // Buscar contatos do Google People API
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

      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (!resp.ok) {
        const errBody = await resp.text()
        if (resp.status === 401) {
          return res.status(401).json({ 
            error: 'Token expirado. Reconecte o Google.',
            needsAuth: true 
          })
        }
        return res.status(resp.status).json({ error: 'Erro ao buscar contatos', detail: errBody })
      }

      const data = await resp.json()
      allContacts = allContacts.concat(data.connections || [])
      pageToken = data.nextPageToken
      hasMore = !!pageToken
      pageCount++
    }

    // Processar contatos
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
        full_name: name,
        email,
        phone,
        phone_e164: phoneE164,
        photo_url: photoUrl,
        organization: org,
        job_title: jobTitle,
        notes,
        raw_data: person,
        synced_at: new Date().toISOString(),
        created_by: user.id,
      }
    }).filter(c => c.full_name || c.email || c.phone)

    // Garantir que a tabela contacts existe
    const { error: checkErr } = await db.from('contacts').select('id').limit(1)
    if (checkErr) {
      // Criar tabela via admin client
      const adminDb = supabaseAdmin()
      // Tentar criar via RPC (pode falhar se exec_sql não existe)
      await adminDb.rpc('exec_sql', { query_text: `
        CREATE TABLE IF NOT EXISTS contacts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
          google_resource_name TEXT UNIQUE,
          full_name TEXT, email TEXT, phone TEXT, phone_e164 TEXT,
          photo_url TEXT, organization TEXT, job_title TEXT, notes TEXT,
          raw_data JSONB, synced_at TIMESTAMPTZ DEFAULT now(),
          created_at TIMESTAMPTZ DEFAULT now(), created_by UUID
        );
        ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "contacts_read" ON contacts FOR SELECT USING (true);
        CREATE POLICY IF NOT EXISTS "contacts_insert" ON contacts FOR INSERT WITH CHECK (true);
        CREATE POLICY IF NOT EXISTS "contacts_update" ON contacts FOR UPDATE USING (true);
        CREATE POLICY IF NOT EXISTS "contacts_delete" ON contacts FOR DELETE USING (true);
        CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
      `}).then(() => {})
    }

    // Upsert
    const { data: upserted, error: upsertErr } = await db
      .from('contacts')
      .upsert(contactsData, { onConflict: 'google_resource_name' })

    if (upsertErr) {
      return res.status(500).json({ error: 'Erro ao salvar contatos', detail: upsertErr.message })
    }

    const { count } = await db.from('contacts').select('id', { count: 'exact' }).eq('tenant_id', tenant_id)

    return res.status(200).json({
      ok: true,
      synced: contactsData.length,
      total_in_google: allContacts.length,
      total_in_db: count,
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno', detail: e.message })
  }
}
