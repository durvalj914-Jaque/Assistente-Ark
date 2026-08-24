import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const db = createClient(url, key, { auth: { persistSession: false } })
  
  // Tentar criar a tabela via insert (se não existir, cria via SQL)
  // Primeiro tentar ler
  const { data: existing, error: readErr } = await db.from('plan_addons').select('id').limit(1)
  
  if (readErr) {
    // Tabela não existe, criar via RPC
    const { error: createErr } = await db.rpc('exec_sql', {
      query: `CREATE TABLE IF NOT EXISTS plan_addons (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        billing_type TEXT DEFAULT 'one_time',
        category TEXT DEFAULT 'conversas',
        quantity INT DEFAULT 1,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );`
    })
    
    if (createErr) {
      // Se RPC não existe, tentar via rest
      return res.status(500).json({ 
        error: 'Não foi possível criar a tabela automaticamente',
        details: createErr.message,
        hint: 'Crie a tabela plan_addons manualmente no Supabase Dashboard'
      })
    }
    
    // Adicionar RLS
    await db.rpc('exec_sql', { query: `ALTER TABLE plan_addons ENABLE ROW LEVEL SECURITY;` })
    await db.rpc('exec_sql', { query: `CREATE POLICY "Admins can manage addons" ON plan_addons FOR ALL USING (auth.role() = 'service_role');` })
  }
  
  // Verificar se já tem dados
  const { data: addons, error } = await db.from('plan_addons').select('*').order('created_at', { ascending: true })
  
  if (error) return res.status(500).json({ error: error.message })
  
  // Se vazio, popular com pacotes iniciais
  if (addons.length === 0) {
    const seedData = [
      { name: 'Pacote 1.000 Conversas', description: 'Mil conversas iniciadas adicionais', price: 49.90, billing_type: 'one_time', category: 'conversas', quantity: 1000, active: true },
      { name: 'Pacote 5.000 Conversas', description: 'Cinco mil conversas iniciadas adicionais', price: 199.00, billing_type: 'one_time', category: 'conversas', quantity: 5000, active: true },
      { name: 'Bot Adicional', description: 'Um bot extra além do limite do plano', price: 29.90, billing_type: 'monthly', category: 'bots', quantity: 1, active: true },
      { name: 'IA Premium', description: 'Acesso ao modelo GPT-4 para respostas inteligentes', price: 39.90, billing_type: 'monthly', category: 'features', quantity: 1, active: true },
      { name: 'Catálogo WhatsApp', description: 'Sincronização automática de catálogo no WhatsApp', price: 19.90, billing_type: 'monthly', category: 'features', quantity: 1, active: true },
      { name: 'Webhook + API', description: 'Acesso à API e webhooks para integrações customizadas', price: 24.90, billing_type: 'monthly', category: 'features', quantity: 1, active: true },
    ]
    
    const { data: inserted, error: insErr } = await db.from('plan_addons').insert(seedData).select('*')
    if (insErr) return res.status(500).json({ error: insErr.message })
    return res.status(200).json({ created: true, addons: inserted })
  }
  
  return res.status(200).json({ created: false, addons })
}
