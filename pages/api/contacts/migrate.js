/**
 * POST /api/contacts/migrate
 * Garante que a tabela contacts tem as colunas full_name e name.
 * Idempotente — pode ser chamado sem medo.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceKey || serviceKey.length < 20) {
    return res.status(200).json({ ok: true, message: 'Service key indisponível no client — pulando migração' })
  }

  try {
    const sql = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'full_name') THEN
          ALTER TABLE contacts ADD COLUMN full_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'name') THEN
          ALTER TABLE contacts ADD COLUMN name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'opt_in') THEN
          ALTER TABLE contacts ADD COLUMN opt_in BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'source') THEN
          ALTER TABLE contacts ADD COLUMN source TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'updated_at') THEN
          ALTER TABLE contacts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Migration note: %', SQLERRM;
      END $$;
    `
    
    const resp = await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query_text: sql })
    })
    
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      return res.status(500).json({ error: 'Falha na migração', detail: data })
    }
    
    // Copiar name -> full_name onde full_name for null
    const sql2 = `UPDATE contacts SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;`
    await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_text: sql2 })
    })
    
    // Copiar full_name -> name onde name for null
    const sql3 = `UPDATE contacts SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;`
    await fetch(`${supaUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_text: sql3 })
    })
    
    return res.status(200).json({ ok: true, message: 'Migração concluída — colunas full_name e name sincronizadas' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
