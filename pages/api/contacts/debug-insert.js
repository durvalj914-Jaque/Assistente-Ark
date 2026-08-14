/**
 * POST /api/contacts/debug-insert
 * Testa um insert simples na tabela contacts e retorna o erro exato.
 */
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const userToken = authHeader.replace('Bearer ', '')

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Cliente com token do usuário
  const dbUser = createClient(supaUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${userToken}` } }
  })

  // Cliente com service role (para comparar)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let dbAdmin = null
  let serviceKeyInfo = 'não configurada'
  if (serviceKey && serviceKey !== '[SENSITIVE]' && serviceKey.length > 20) {
    dbAdmin = createClient(supaUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    serviceKeyInfo = `configurada (${serviceKey.length} chars)`
  }

  // Auth check
  const { data: { user }, error: authErr } = await dbUser.auth.getUser(userToken)
  
  const body = req.body || {}
  const tenantId = body.tenant_id || 'test-tenant'

  const results = {
    user: user ? { id: user.id, email: user.email } : null,
    authError: authErr?.message,
    supabaseUrl: supaUrl,
    serviceKeyInfo,
    tenantId,
  }

  // Test 1: SELECT da tabela
  const { error: selectErr } = await dbUser.from('contacts').select('id').limit(1)
  results.select = selectErr ? `ERRO: ${selectErr.message} (${selectErr.code})` : 'OK'

  // Test 2: INSERT com client do usuário
  const testData = {
    tenant_id: tenantId,
    name: 'TESTE DEBUG',
    phone: '+5511999999999',
    email: 'teste@debug.com',
    synced_at: new Date().toISOString(),
  }

  const { data: insertData, error: insertErr } = await dbUser.from('contacts').insert(testData).select()
  results.insertUser = insertErr ? `ERRO: ${insertErr.message} (${insertErr.code})` : `OK: ${JSON.stringify(insertData?.[0]?.id || 'no id')}`

  // Test 3: INSERT com service role (se disponível)
  if (dbAdmin) {
    const { data: insertData2, error: insertErr2 } = await dbAdmin.from('contacts').insert({ ...testData, name: 'TESTE ADMIN' }).select()
    results.insertAdmin = insertErr2 ? `ERRO: ${insertErr2.message} (${insertErr2.code})` : `OK: ${JSON.stringify(insertData2?.[0]?.id || 'no id')}`
  }

  // Test 4: Verificar colunas da tabela
  const { error: colsErr } = await dbUser.from('contacts').select('*').limit(1)
  results.columns = colsErr ? `ERRO: ${colsErr.message}` : 'SELECT * OK'

  return res.status(200).json(results)
}
