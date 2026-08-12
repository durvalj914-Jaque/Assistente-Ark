import { supabase, supabaseAdmin } from '../../../lib/supabase'
import { generatePixCode } from '../../../lib/pix'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })
  
  const db = supabaseAdmin()
  const { conversation_id } = req.body
  
  const { data: conv } = await db.from('conversations').select('id, tenant_id, bot_id, contact_id').eq('id', conversation_id).maybeSingle()
  if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' })
  
  const { data: tenant, error: terr } = await db.from('tenants').select('id, name, pix_key, merchant_name, merchant_city').eq('id', conv.tenant_id).maybeSingle()
  
  // Also check if columns exist
  const { error: colErr } = await db.from('tenants').select('pix_key').limit(1)
  
  const finalPixKey = tenant?.pix_key
  const finalName = (tenant?.merchant_name || tenant?.name || 'Arkiel').substring(0, 25)
  const finalCity = (tenant?.merchant_city || 'SAO PAULO').substring(0, 15)
  
  let pixCode = null
  if (finalPixKey) {
    pixCode = generatePixCode({ 
      pixKey: finalPixKey, 
      merchantName: finalName, 
      merchantCity: finalCity, 
      amount: 1.00, 
      txid: 'ARKDIAG001',
      description: 'Teste'
    })
  }
  
  return res.status(200).json({
    tenant: tenant ? { id: tenant.id, name: tenant.name, pix_key: tenant.pix_key, merchant_name: tenant.merchant_name, merchant_city: tenant.merchant_city } : null,
    tenant_error: terr?.message,
    column_error: colErr?.message,
    finalPixKey,
    finalName,
    finalCity,
    pixCode,
  })
}
