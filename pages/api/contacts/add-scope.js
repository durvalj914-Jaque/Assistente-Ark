/**
 * POST /api/contacts/add-scope
 * Adiciona o escopo contacts.readonly na config do Google OAuth no Supabase.
 * Não requer user auth — usa a service role key do ambiente + um secret.
 * One-time setup endpoint.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Proteção simples: requer um header x-setup-key
  const setupKey = req.headers['x-setup-key']
  const expectedKey = process.env.SETUP_SECRET || 'arkiel-setup-2026'
  
  if (setupKey !== expectedKey) {
    return res.status(403).json({ error: 'Não autorizado' })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' })
  }

  const contactsScope = 'https://www.googleapis.com/auth/contacts.readonly'

  try {
    // Método 1: Tentar via auth.config table (GoTrue)
    const readResp = await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_text: `SELECT google_provider_scopes FROM auth.config LIMIT 1;`
      })
    })

    const readData = await readResp.json()

    let currentScopes = ''
    if (readResp.ok && Array.isArray(readData) && readData[0]) {
      currentScopes = readData[0].google_provider_scopes || ''
    }

    if (currentScopes.includes(contactsScope)) {
      return res.status(200).json({ 
        ok: true, 
        message: 'Escopo já configurado!',
        currentScopes 
      })
    }

    const newScopes = currentScopes ? `${currentScopes} ${contactsScope}` : contactsScope

    // Atualizar
    const updateResp = await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_text: `UPDATE auth.config SET google_provider_scopes = '${newScopes}';`
      })
    })

    const updateData = await updateResp.json()

    if (updateResp.ok) {
      return res.status(200).json({ 
        ok: true, 
        message: 'Escopo contacts.readonly adicionado!',
        previousScopes: currentScopes,
        newScopes,
        note: 'Faça logout e login novamente no painel.'
      })
    }

    // Método 2: Tentar via pg/query endpoint
    const pgResp = await fetch(`${supaUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `UPDATE auth.config SET google_provider_scopes = '${newScopes}';`
      })
    })

    const pgData = await pgResp.json()

    if (pgResp.ok) {
      return res.status(200).json({ 
        ok: true, 
        message: 'Escopo adicionado via pg/query!',
        newScopes,
        note: 'Faça logout e login novamente no painel.'
      })
    }

    return res.status(500).json({ 
      error: 'Não foi possível atualizar auth.config',
      attempt1: updateData,
      attempt2: pgData,
      hint: 'Adicione manualmente: Supabase Dashboard → Authentication → Providers → Google → Scopes → adicione: https://www.googleapis.com/auth/contacts.readonly'
    })
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno', detail: e.message })
  }
}
