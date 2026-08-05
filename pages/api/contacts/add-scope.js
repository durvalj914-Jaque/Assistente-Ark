/**
 * POST /api/contacts/add-scope
 * Adiciona o escopo contacts.readonly na configuração do Google OAuth no Supabase.
 * Usa a service role key (disponível no server-side na Vercel). Requer platform admin.
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor' })
  }

  try {
    // 1. Buscar a config atual do Google provider
    // A config de auth fica na tabela auth.config ou no GoTrue config
    // Tentar via SQL direto
    const sqlResp = await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_text: `
          SELECT google_provider_scopes 
          FROM auth.config 
          LIMIT 1;
        `
      })
    })

    const sqlData = await sqlResp.json()

    if (!sqlResp.ok) {
      // Tabela auth.config pode não ser acessível via REST
      // Tentar via pg endpoint
      const pgResp = await fetch(`${supaUrl}/pg/query`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `SELECT google_provider_scopes FROM auth.config LIMIT 1;`
        })
      })
      const pgData = await pgResp.json()
      
      if (!pgResp.ok) {
        return res.status(500).json({ 
          error: 'Não foi possível acessar auth.config', 
          detail: pgData,
          hint: 'Adicione manualmente no Supabase Dashboard: Authentication → Providers → Google → Scopes: https://www.googleapis.com/auth/contacts.readonly'
        })
      }
      
      // Usar pgData
      return processUpdate(res, supaUrl, serviceKey, pgData)
    }

    return processUpdate(res, supaUrl, serviceKey, sqlData)
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno', detail: e.message })
  }
}

async function processUpdate(res, supaUrl, serviceKey, configData) {
  let currentScopes = ''
  
  // Extrair scopes atuais
  if (Array.isArray(configData)) {
    currentScopes = configData[0]?.google_provider_scopes || ''
  } else if (configData?.data) {
    currentScopes = configData.data[0]?.google_provider_scopes || ''
  } else if (configData?.google_provider_scopes !== undefined) {
    currentScopes = configData.google_provider_scopes
  }

  const contactsScope = 'https://www.googleapis.com/auth/contacts.readonly'

  if (currentScopes.includes(contactsScope)) {
    return res.status(200).json({ 
      ok: true, 
      message: 'Escopo contacts.readonly já está configurado!',
      currentScopes 
    })
  }

  // Adicionar o escopo
  const newScopes = currentScopes 
    ? `${currentScopes} ${contactsScope}` 
    : contactsScope

  // Tentar atualizar via SQL
  const updateResp = await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_text: `
        UPDATE auth.config 
        SET google_provider_scopes = '${newScopes}'
        WHERE true;
      `
    })
  })

  const updateData = await updateResp.json()

  if (!updateResp.ok) {
    // Tentar via pg
    const pgUpdateResp = await fetch(`${supaUrl}/pg/query`, {
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
    const pgUpdateData = await pgUpdateResp.json()
    
    if (!pgUpdateResp.ok) {
      return res.status(500).json({ 
        error: 'Não foi possível atualizar auth.config automaticamente',
        detail: pgUpdateData,
        currentScopes,
        hint: 'Adicione manualmente no Supabase Dashboard: Authentication → Providers → Google → Scopes: https://www.googleapis.com/auth/contacts.readonly'
      })
    }
  }

  return res.status(200).json({ 
    ok: true, 
    message: 'Escopo contacts.readonly adicionado com sucesso!',
    previousScopes: currentScopes,
    newScopes,
    note: 'Faça logout e login novamente no painel para gerar um novo token com permissão de contatos.'
  })
}
