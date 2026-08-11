import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  
  // We'll use a workaround: insert a test record with the new columns
  // If it fails, the columns don't exist yet
  
  try {
    // Try updating an existing record with payment_id
    const { error } = await db.from('whatsapp_orders')
      .update({ 
        payment_id: null,
        payment_method: null,
        paid_at: null
      })
      .eq('status', '___never_match___')
    
    if (error && error.message?.includes('column') && error.message?.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Columns do not exist. Please run SQL in Supabase dashboard:',
        sql: `
ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
        `
      })
    }
    
    return res.status(200).json({ ok: true, message: 'Columns already exist or update succeeded' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
