/**
 * /api/mercadopago/oauth/init
 * Inicia OAuth do Mercado Pago (um clique) — PKCE desativado no painel
 */
import { createClient } from '@supabase/supabase-js'

const MP_CLIENT_ID = '3158906703766924'
const REDIRECT_URI = 'https://arkiel.com.br/api/mercadopago/oauth/callback'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const client = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  
  const { data: { user } } = await client.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })
  
  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle()
  
  if (!member) return res.status(400).json({ error: 'Tenant não encontrado' })
  
  // Encode return_to in state so callback knows where to redirect
  const returnTo = req.query.return_to || 'admin'
  const state = `${member.tenant_id}|${returnTo}`
  const authUrl = `https://auth.mercadopago.com/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
  
  return res.status(200).json({ authUrl })
}
