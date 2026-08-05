/**
 * POST /api/contacts/sync-google
 * Sincroniza contatos do Google People API.
 * Body: { provider_token: string, tenant_id: string }
 * Recebe o provider_token da sessão Supabase (Google OAuth) do frontend.
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db, user } = ctx

  const { provider_token, tenant_id } = req.body

  if (!provider_token) {
    return res.status(400).json({ error: 'provider_token é obrigatório. Faça login novamente com Google.' })
  }
  if (!tenant_id) {
    return res.status(400).json({ error: 'tenant_id é obrigatório' })
  }

  try {
    // Buscar contatos do Google People API
    // pageSize máximo é 1000 por request, faremos paginação
    let allContacts = []
    let pageToken = null
    let hasMore = true
    let pageCount = 0

    while (hasMore && pageCount < 10) { // limite de 10 páginas = 10.000 contatos
      let url = 'https://people.googleapis.com/v1/people:batchGet?resourceNames=people/me'
      // Usar connections:list que é o correto
      url = 'https://people.googleapis.com/v1/people:connections?resourceName=people/me'
      url += '&pageSize=1000'
      url += '&personFields=names,emailAddresses,phoneNumbers,photos,organizations,biographies'
      url += '&sortOrder=FIRST_NAME_ASCENDING'
      if (pageToken) url += `&pageToken=${pageToken}`

      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${provider_token}` }
      })

      if (!resp.ok) {
        const errBody = await resp.text()
        if (resp.status === 401) {
          return res.status(401).json({ error: 'Token do Google expirado. Faça login novamente.' })
        }
        if (resp.status === 403) {
          return res.status(403).json({ 
            error: 'Permissão de contatos não concedida. Adicione o escopo "contacts.readonly" no Supabase Auth > Providers > Google.' 
          })
        }
        return res.status(resp.status).json({ error: 'Erro ao buscar contatos', detail: errBody })
      }

      const data = await resp.json()
      const connections = data.connections || []
      allContacts = allContacts.concat(connections)

      pageToken = data.nextPageToken
      hasMore = !!pageToken
      pageCount++
    }

    // Processar e salvar no Supabase
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
    }).filter(c => c.full_name || c.email || c.phone) // só contatos com info

    // Upsert no Supabase (usar google_resource_name como conflito)
    const { data: upserted, error: upsertErr } = await db
      .from('contacts')
      .upsert(contactsData, { onConflict: 'google_resource_name' })
      .select('id, full_name, email, phone')

    if (upsertErr) {
      // Se a tabela não existe, retornar erro específico
      if (upsertErr.message?.includes('does not exist') || upsertErr.code === '42P01') {
        return res.status(500).json({ 
          error: 'Tabela contacts não existe. Chame POST /api/contacts/init-table primeiro.' 
        })
      }
      return res.status(500).json({ error: 'Erro ao salvar contatos', detail: upsertErr.message })
    }

    // Buscar total de contatos salvos no banco
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
