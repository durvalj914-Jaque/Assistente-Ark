/**
 * POST /api/admin/remove-rita
 * Remove completamente a Rita (número +55 11 91675-9444, phone_number_id 1271918366007214)
 * Usa service role key. Protegido por x-setup-key.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const setupKey = req.headers['x-setup-key']
  if (setupKey !== (process.env.SETUP_SECRET || 'arkiel-setup-2026')) {
    return res.status(403).json({ error: 'Não autorizado' })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) return res.status(500).json({ error: 'Service key não configurada' })

  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  const results = { steps: [] }

  // 1. Buscar todos os bots
  const botsResp = await fetch(`${supaUrl}/rest/v1/bots?select=*`, { headers })
  const bots = await botsResp.json()
  results.steps.push({ step: 'list_bots', count: bots.length, bots: bots.map(b => ({ id: b.id, name: b.name, phone_number_id: b.phone_number_id, tenant_id: b.tenant_id, active: b.active })) })

  // 2. Encontrar o bot da Rita (phone_number_id 1271918366007214 ou nome contém "rita")
  const ritaBot = bots.find(b => 
    b.phone_number_id === '1271918366007214' || 
    (b.name || '').toLowerCase().includes('rita')
  )

  if (!ritaBot) {
    results.steps.push({ step: 'find_rita_bot', result: 'not_found' })
    return res.status(200).json({ ...results, message: 'Bot da Rita não encontrado' })
  }

  results.steps.push({ step: 'find_rita_bot', found: ritaBot })

  const botId = ritaBot.id
  const tenantId = ritaBot.tenant_id

  // 3. Deletar conversas do bot
  const delConvResp = await fetch(`${supaUrl}/rest/v1/conversations?bot_id=eq.${botId}`, {
    method: 'DELETE',
    headers,
  })
  results.steps.push({ step: 'delete_conversations', status: delConvResp.status })

  // 4. Deletar mensagens (se houver tabela separada)
  const delMsgResp = await fetch(`${supaUrl}/rest/v1/messages?bot_id=eq.${botId}`, {
    method: 'DELETE',
    headers,
  })
  results.steps.push({ step: 'delete_messages', status: delMsgResp.status })

  // 5. Deletar contatos sincronizados (se houver)
  if (tenantId) {
    const delContactsResp = await fetch(`${supaUrl}/rest/v1/contacts?tenant_id=eq.${tenantId}`, {
      method: 'DELETE',
      headers,
    })
    results.steps.push({ step: 'delete_contacts', status: delContactsResp.status })

    // 6. Deletar google_contacts_auth
    const delGoogleAuthResp = await fetch(`${supaUrl}/rest/v1/google_contacts_auth?tenant_id=eq.${tenantId}`, {
      method: 'DELETE',
      headers,
    })
    results.steps.push({ step: 'delete_google_auth', status: delGoogleAuthResp.status })
  }

  // 7. Deletar o bot
  const delBotResp = await fetch(`${supaUrl}/rest/v1/bots?id=eq.${botId}`, {
    method: 'DELETE',
    headers,
  })
  results.steps.push({ step: 'delete_bot', status: delBotResp.status })

  // 8. Deletar o tenant (se for da Rita e não for o Arkiel principal)
  if (tenantId && tenantId !== 'cc629c88-c072-4593-84dc-e9cd8d2b06d2') {
    // Verificar se é um tenant isolado da Rita
    const tenantsResp = await fetch(`${supaUrl}/rest/v1/tenants?id=eq.${tenantId}&select=*`, { headers })
    const tenants = await tenantsResp.json()
    
    if (tenants.length > 0) {
      const tenant = tenants[0]
      // Deletar tenant_members
      const delMembersResp = await fetch(`${supaUrl}/rest/v1/tenant_members?tenant_id=eq.${tenantId}`, {
        method: 'DELETE',
        headers,
      })
      results.steps.push({ step: 'delete_tenant_members', status: delMembersResp.status })

      // Deletar tenant
      const delTenantResp = await fetch(`${supaUrl}/rest/v1/tenants?id=eq.${tenantId}`, {
        method: 'DELETE',
        headers,
      })
      results.steps.push({ step: 'delete_tenant', status: delTenantResp.status, tenant_name: tenant.name })
    }
  }

  // 9. Desativar o número na Meta (tentar via Graph API)
  const metaToken = process.env.META_SYSTEM_USER_TOKEN
  if (metaToken) {
    try {
      const metaResp = await fetch(`https://graph.facebook.com/v25.0/1271918366007214`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${metaToken}` },
      })
      const metaData = await metaResp.json()
      results.steps.push({ step: 'meta_delete_number', status: metaResp.status, result: metaData })
    } catch (e) {
      results.steps.push({ step: 'meta_delete_number', error: e.message })
    }
  }

  return res.status(200).json({ ok: true, results })
}
