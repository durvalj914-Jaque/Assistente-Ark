import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/mercadopago/cleanup?tenant_id=XXX&secret=YYY
 * Limpa TODOS os dados de MP de um tenant (admin one-time cleanup)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant_id, secret } = req.query
  const ADMIN_SECRET = 'arkiel_admin_cleanup_2026'

  if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Não autorizado' })
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const results = {}

  // 1. Limpar mp_access_token do tenant
  const { data: tenantBefore } = await db.from('tenants').select('id, name, mp_access_token').eq('id', tenant_id).maybeSingle()
  results.tenant_before = tenantBefore ? {
    id: tenantBefore.id,
    name: tenantBefore.name,
    had_mp_token: !!tenantBefore.mp_access_token
  } : null

  const { error: tenantError } = await db.from('tenants')
    .update({ mp_access_token: null })
    .eq('id', tenant_id)

  results.tenant_cleared = !tenantError
  results.tenant_error = tenantError?.message || null

  // 2. Limpar payment_methods que referenciam MP
  const { data: pmDeleted, error: pmError } = await db.from('payment_methods')
    .delete()
    .eq('tenant_id', tenant_id)
    .ilike('method_name', '%mercado pago%')

  results.payment_methods_deleted = pmDeleted?.length || 0
  results.payment_methods_error = pmError?.message || null

  // 3. Verificar se há pagamentos registrados na tabela messages com metadata de MP
  // (não deletamos histórico, só limpamos config ativa)
  results.message = 'Limpeza concluída: mp_access_token removido do tenant'

  return res.status(200).json({ ok: true, results })
}
