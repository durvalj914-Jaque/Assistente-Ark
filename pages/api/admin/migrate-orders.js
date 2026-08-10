import { Pool } from 'pg'

export default async function handler(req, res) {
  // Build connection string from Supabase env vars
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  // Extract project ref from URL: https://oiautldzswsncsgzqmhe.supabase.co
  const projectRef = supaUrl.replace('https://', '').split('.')[0]
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  // Try direct connection using the Supabase pooler
  const connString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`
  
  // Alternative: use the direct connection
  const directConn = `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`
  
  const pool = new Pool({
    connectionString: dbPassword ? connString : undefined,
    ssl: dbPassword ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
  })
  
  try {
    const client = await pool.connect()
    
    await client.query('ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL')
    await client.query('ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ')
    
    client.release()
    return res.status(200).json({ ok: true, message: 'Colunas payment_id e paid_at adicionadas a whatsapp_orders' })
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: e.message,
      sql_to_run: `ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;\nALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`
    })
  } finally {
    await pool.end()
  }
}
