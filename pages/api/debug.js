export default async function handler(req, res) {
  const checks = {
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    whatsapp_token: !!process.env.WHATSAPP_ACCESS_TOKEN,
    whatsapp_phone: process.env.WHATSAPP_PHONE_NUMBER_ID || 'missing',
    webhook_verify: process.env.WEBHOOK_VERIFY_TOKEN || 'missing',
    supabase_url_val: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0,40) || 'missing',
    service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0,20) || 'missing',
  }

  // Tentar criar o client e fazer uma query simples
  let dbTest = null
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
    const { data, error } = await db.from('tenants').select('id,name').limit(1)
    dbTest = error ? `ERROR: ${error.message}` : `OK: ${JSON.stringify(data)}`
  } catch(e) {
    dbTest = `EXCEPTION: ${e.message}`
  }

  res.status(200).json({ checks, dbTest, ts: new Date().toISOString() })
}
