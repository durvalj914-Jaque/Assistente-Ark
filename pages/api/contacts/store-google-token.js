/**
 * POST /api/contacts/store-google-token
 * Recebe o provider_token e provider_refresh_token da sessão Supabase
 * (obtidos via signInWithOAuth com scope contacts.readonly) e salva
 * na tabela google_contacts_auth para uso na sincronização.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body = req.body
  if (typeof body === 'string') body = JSON.parse(body)
  const { tenant_id, provider_token, provider_refresh_token } = body

  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })
  if (!provider_token) return res.status(400).json({ error: 'provider_token é obrigatório' })

  // Auth
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Verificar permissão
  const { data: profile } = await db.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado' })

  if (!profile.is_platform_admin) {
    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).eq('tenant_id', tenant_id).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão para este tenant' })
  }

  // Salvar tokens na tabela google_contacts_auth
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()

  const { error: upsertErr } = await db
    .from('google_contacts_auth')
    .upsert({
      tenant_id,
      access_token: provider_token,
      refresh_token: provider_refresh_token || null,
      expires_at: expiresAt,
      scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.profile',
      token_type: 'Bearer',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })

  if (upsertErr) {
    return res.status(500).json({ error: 'Erro ao salvar token: ' + upsertErr.message })
  }

  return res.status(200).json({ ok: true, message: 'Token do Google salvo com sucesso' })
}
