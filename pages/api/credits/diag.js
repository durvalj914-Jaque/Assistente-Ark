import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  // Buscar OpenAPI do PostgREST — descreve todas as colunas das tabelas
  const specRes = await fetch(SUPA_URL + '/rest/v1/', {
    headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY }
  })
  const spec = await specRes.json()

  const defs = spec.definitions || {}
  const out = {}
  for (const name of ['conversation_credits', 'credit_purchases', 'credit_usage_log']) {
    if (defs[name]) {
      out[name] = Object.keys(defs[name].properties).map(col => {
        const p = defs[name].properties[col]
        return col + ':' + (p.format || p.type || '?')
      })
    } else {
      out[name] = 'NOT FOUND IN SPEC'
    }
  }

  // Tentar descobrir assinatura de purchase_credits chamando com params inválidos
  let rpcTest = null
  try {
    const { error } = await db.rpc('purchase_credits', { __invalid_param: 'x' })
    rpcTest = error?.message || 'no error'
  } catch (e) { rpcTest = String(e) }

  return res.status(200).json({ tables: out, rpc_purchase_credits_error: rpcTest })
}
