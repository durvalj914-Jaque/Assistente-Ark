/**
 * Migracao: adiciona colunas do OAuth do Mercado Pago na tabela tenants
 * GET /api/migrate/mp-oauth-columns
 */
export default async function handler(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  const sql = `
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_refresh_token text;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_public_key text;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_user_id bigint;
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mp_expires_at timestamptz;
  `
  
  try {
    // Try Supabase SQL endpoint
    const r = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    })
    
    if (r.ok) {
      return res.status(200).json({ ok: true, message: 'Columns added via /pg/query' })
    }
    
    // Fallback: try /rest/v1/rpc with a function
    const r2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    })
    
    if (r2.ok) {
      return res.status(200).json({ ok: true, message: 'Columns added via rpc' })
    }
    
    const err = await r2.text()
    return res.status(500).json({ 
      error: 'Could not auto-migrate. Run this SQL in Supabase dashboard:',
      sql: sql.trim()
    })
  } catch (e) {
    return res.status(500).json({ error: e.message, sql: sql.trim() })
  }
}
