/**
 * POST /api/contacts/init-table
 * Cria a tabela 'contacts' no Supabase se não existir.
 * Usa a service role key (server-side only). Requer platform admin.
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  // Verificar se a tabela já existe
  const { error: checkErr } = await db.from('contacts').select('id').limit(1)
  if (!checkErr) {
    return res.status(200).json({ ok: true, message: 'Tabela contacts já existe' })
  }

  // Criar via REST API do Supabase usando service role key
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada' })
  }

  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        google_resource_name TEXT UNIQUE,
        name TEXT, full_name TEXT, email TEXT, phone TEXT, phone_e164 TEXT,
        photo_url TEXT, organization TEXT, job_title TEXT, notes TEXT,
        raw_data JSONB, synced_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now(), created_by UUID
      );
      ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
      CREATE POLICY IF NOT EXISTS "contacts_read" ON contacts FOR SELECT USING (true);
      CREATE POLICY IF NOT EXISTS "contacts_insert" ON contacts FOR INSERT WITH CHECK (true);
      CREATE POLICY IF NOT EXISTS "contacts_update" ON contacts FOR UPDATE USING (true);
      CREATE POLICY IF NOT EXISTS "contacts_delete" ON contacts FOR DELETE USING (true);
      CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_e164);
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
    
    const data = await resp.json()
    if (!resp.ok) {
      // Se exec_sql não existe, tentar query direta
      const resp2 = await fetch(`${supaUrl}/pg/query`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql })
      })
      const data2 = await resp2.json()
      if (!resp2.ok) return res.status(500).json({ error: 'Falha ao criar tabela', detail: data2 })
    }
    
    return res.status(200).json({ ok: true, message: 'Tabela contacts criada' })
  } catch (e) {
    return res.status(500).json({ error: 'Não foi possível criar a tabela', detail: e.message })
  }
}
