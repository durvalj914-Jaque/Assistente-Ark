import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  try {
    // Use the PostgREST RPC to run SQL — try using pgrst header
    const db = supabaseAdmin()
    
    // Try direct table modification via Supabase — insert a dummy record that forces column creation? No.
    // Let's use fetch to the Supabase SQL endpoint
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    // Use Supabase's REST API with the service role key to execute raw SQL
    // Supabase doesn't have a direct SQL endpoint via REST, but we can use the management API
    // Let's try a different approach: use the Postgres connection
    
    // Actually, the simplest way is to use the Supabase JS client with a custom query
    // We can use the `.from()` with raw SQL if we use the `pg_header_prefer` 
    
    // Alternative: Use fetch to the Supabase pg endpoint
    const sqlRes = await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql_text: 'ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL; ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;' })
    })
    
    const sqlData = await sqlRes.json()
    
    if (sqlRes.ok) {
      return res.status(200).json({ ok: true, message: 'Colunas adicionadas com sucesso' })
    }
    
    // If exec_sql doesn't exist, return the SQL for manual execution
    if (sqlData?.message?.includes('does not exist') || sqlData?.code === '42883') {
      // Try using the Supabase Management API
      const projectRef = 'oiautldzswsncsgzqmhe'
      const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL; ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;' })
      })
      const mgmtData = await mgmtRes.json()
      
      if (mgmtRes.ok) {
        return res.status(200).json({ ok: true, message: 'Colunas adicionadas via Management API' })
      }
      
      return res.status(200).json({ 
        ok: false, 
        error: 'Nenhum método de execução SQL funcionou',
        sql_to_run: `ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;\nALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`
      })
    }
    
    return res.status(200).json({ ok: false, error: sqlData })
  } catch (e) {
    return res.status(200).json({ 
      ok: false, 
      error: e.message,
      sql_to_run: `ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;\nALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`
    })
  }
}
