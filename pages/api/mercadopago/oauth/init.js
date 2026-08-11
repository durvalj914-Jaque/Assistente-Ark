/**
 * /api/mercadopago/oauth/init
 * Inicia o fluxo de OAuth do Mercado Pago com PKCE
 */
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const MP_CLIENT_ID = '4905810356503706'
const REDIRECT_URI = 'https://arkiel.com.br/api/mercadopago/oauth/callback'

function base64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

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
  
  // Generate PKCE code_verifier and code_challenge
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest())
  
  // Set code_verifier in a cookie (needed for token exchange)
  res.setHeader('Set-Cookie', `mp_code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
  
  const authUrl = `https://auth.mercadopago.com.br/authorization?client_id=${MP_CLIENT_ID}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${member.tenant_id}&code_challenge=${codeChallenge}&code_challenge_method=S256`
  
  return res.status(200).json({ authUrl })
}
