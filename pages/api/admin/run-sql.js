import { Pool } from 'pg'

export default async function handler(req, res) {
  const ref = 'oiautldzswsncsgzqmhe'
  const region = 'sa-east-1'
  
  // Try multiple connection methods
  const connections = [
    // Pooler with 'postgres' password
    `postgresql://postgres.${ref}:postgres@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    // Direct with 'postgres' password  
    `postgresql://postgres:postgres@db.${ref}.supabase.co:5432/postgres`,
    // Try with service role key as password
    `postgresql://postgres.${ref}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
  ]
  
  for (const connStr of connections) {
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    })
    
    try {
      const client = await pool.connect()
      // Get current columns of payments table
      const { rows } = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'payments' 
        ORDER BY ordinal_position
      `)
      
      // Add missing columns
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS conversation_id UUID`)
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS contact_id UUID`)
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS description TEXT`)
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'pix'`)
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_ref TEXT`)
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`)
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS mp_preference_id TEXT`)
      await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS mp_checkout_url TEXT`)
      
      // Get updated columns
      const { rows: newCols } = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'payments' 
        ORDER BY ordinal_position
      `)
      
      client.release()
      await pool.end()
      return res.status(200).json({
        ok: true,
        connection: connStr.split('@')[0].replace(/:[^:@]*$/, ':***'),
        before: rows.map(r => r.column_name),
        after: newCols.map(r => r.column_name),
      })
    } catch (e) {
      await pool.end()
      // Try next connection
      continue
    }
  }
  
  return res.status(200).json({
    ok: false,
    error: 'Could not connect to database with any method',
    sql_to_run: `ALTER TABLE payments ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS contact_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'pix';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS mp_checkout_url TEXT;`
  })
}
