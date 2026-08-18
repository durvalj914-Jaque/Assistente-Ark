import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')

  const { supabase } = await import('../../../lib/supabase')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  // Check if user is admin
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'platform_admin' && profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas admins' })
  }

  // Execute raw SQL via Supabase's built-in exec_sql or via a stored procedure
  const sql = `
    CREATE TABLE IF NOT EXISTS public.status_updates (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'text',
      media_id TEXT,
      bg_color TEXT DEFAULT '#1f2c34',
      author_name TEXT DEFAULT 'Admin',
      author_role TEXT DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
    );
    ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
    CREATE POLICY IF NOT EXISTS "Tenants can read own status" ON public.status_updates
      FOR SELECT USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));
    CREATE POLICY IF NOT EXISTS "Tenants can insert own status" ON public.status_updates
      FOR INSERT WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));
    CREATE POLICY IF NOT EXISTS "Tenants can delete own status" ON public.status_updates
      FOR DELETE USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_members tm WHERE tm.user_id = auth.uid()));
    CREATE INDEX IF NOT EXISTS idx_status_tenant ON public.status_updates(tenant_id, created_at DESC);
  `

  // Try using a stored procedure or direct SQL execution
  // Supabase doesn't have a built-in exec_sql, but we can try the pg_exec function
  try {
    const { error } = await db.rpc('pg_exec', { sql })
    if (!error) return res.status(200).json({ ok: true, message: 'Tabela status_updates criada' })

    // If pg_exec doesn't exist, try another approach
    if (error.message.includes('Could not find the function') || error.message.includes('pg_exec')) {
      // Try using the PostgREST approach — create the table by inserting into it (won't work for DDL)
      // Last resort: return the SQL for manual execution
      return res.status(200).json({
        ok: false,
        message: 'Execute o SQL manualmente no Supabase SQL Editor:',
        sql
      })
    }
    return res.status(500).json({ error: error.message })
  } catch (e) {
    return res.status(500).json({ error: e.message, sql })
  }
}
