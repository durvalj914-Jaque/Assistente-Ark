/**
 * GET /api/migrate/add-fee-config-column
 * Adds fee_config JSONB column to tenants table if it doesn't exist.
 * Run once manually.
 */
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  
  // Check if we can read/write fee_config
  const ARKIEL_TENANT_ID = 'cc629c88-c072-4593-84dc-e9cd8d2b06d2'
  
  // Try to update fee_config
  const { data, error } = await db.from('tenants')
    .update({ fee_config: { test: true } })
    .eq('id', ARKIEL_TENANT_ID)
    .select('fee_config')
    .maybeSingle()
  
  if (error) {
    // Column doesn't exist — try via RPC
    const { error: rpcErr } = await db.rpc('exec_sql', { 
      sql: 'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS fee_config JSONB DEFAULT NULL;' 
    }).catch(() => ({ error: 'rpc_not_available' }))
    
    if (rpcErr) {
      return res.status(200).json({ 
        ok: false, 
        error: error.message,
        rpc_error: typeof rpcErr === 'string' ? rpcErr : rpcErr,
        note: 'Execute manualmente no SQL Editor do Supabase: ALTER TABLE tenants ADD COLUMN IF NOT EXISTS fee_config JSONB DEFAULT NULL;'
      })
    }
    
    // Try again after column creation
    const { error: err2 } = await db.from('tenants')
      .update({ fee_config: { test: true } })
      .eq('id', ARKIEL_TENANT_ID)
    
    if (err2) return res.status(200).json({ ok: false, error: err2.message })
    return res.status(200).json({ ok: true, message: 'Coluna fee_config criada com sucesso' })
  }
  
  return res.status(200).json({ ok: true, message: 'Coluna fee_config já existe', data })
}
