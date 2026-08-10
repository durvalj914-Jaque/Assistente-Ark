import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const db = supabaseAdmin()
  try {
    // Add payment_id and paid_at columns to whatsapp_orders
    const { error: err1 } = await db.rpc('exec_sql', { sql_text: 'ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL' })
    const { error: err2 } = await db.rpc('exec_sql', { sql_text: 'ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ' })
    
    // Check if exec_sql exists
    if (err1 && err1.message?.includes('function') && err1.message?.includes('does not exist')) {
      // Fallback: use raw query via pg
      return res.status(200).json({ 
        ok: false, 
        error: 'exec_sql function not available',
        sql_to_run: `ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`
      })
    }
    
    return res.status(200).json({ ok: true, errors: [err1?.message, err2?.message] })
  } catch (e) {
    return res.status(200).json({ 
      ok: false, 
      error: e.message,
      sql_to_run: `ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`
    })
  }
}
