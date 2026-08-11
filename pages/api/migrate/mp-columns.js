import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  
  // Add MP OAuth columns to tenants
  const { error: e1 } = await db.rpc('exec', { 
    sql: 'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_refresh_token text' 
  }).catch(() => ({ error: 'rpc not available' }))
  
  // Fallback: try direct insert with the new columns to trigger auto-create
  // Or use the REST API approach
  
  return res.status(200).json({ 
    message: 'Migration endpoint - use Supabase dashboard to run SQL manually',
    sql: `
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_refresh_token text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_public_key text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_user_id bigint;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_expires_at timestamptz;
    `
  })
}
