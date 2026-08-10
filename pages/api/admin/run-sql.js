import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  // First check what columns payments has
  const { data: columns, error: colError } = await supabase
    .from('payments')
    .select('*')
    .limit(1)
  
  // Try inserting a test row with all columns to see which ones fail
  const testCols = {
    conversation_id: null,
    contact_id: null, 
    description: 'test',
    method: 'pix',
    payment_ref: 'test123',
    metadata: { test: true },
    mp_preference_id: null,
    mp_checkout_url: null
  }
  
  // Try adding columns by inserting - this won't work for DDL
  // But let's at least report what's missing
  
  return res.status(200).json({
    existing_columns: columns?.[0] ? Object.keys(columns[0]) : 'no rows',
    error: colError?.message,
    note: 'Need to run DDL to add missing columns'
  })
}
