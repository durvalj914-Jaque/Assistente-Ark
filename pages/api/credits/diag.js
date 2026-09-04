import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  // Introspectar assinaturas das funções de crédito
  const { data: fn } = await db.rpc('pg_proc_introspect', {}).then(r => r).catch(() => ({ data: null }))
  // Fallback: usar from() com tabela para pegar schema de colunas
  const [{ data: cc }, { data: cp }, { data: cul }] = await Promise.all([
    db.from('conversation_credits').select('*').limit(1),
    db.from('credit_purchases').select('*').limit(1),
    db.from('credit_usage_log').select('*').limit(1),
  ])

  return res.status(200).json({
    conversation_credits: cc?.[0] || { columns: Object.keys(cc?.[0] || {}) },
    credit_purchases: cp?.[0] || { columns: Object.keys(cp?.[0] || {}) },
    credit_usage_log: cul?.[0] || { columns: Object.keys(cul?.[0] || {}) },
    cc_error: cc ? null : 'table error',
  })
}
