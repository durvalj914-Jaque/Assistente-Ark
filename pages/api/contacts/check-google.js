/**
 * GET /api/contacts/check-google?tenant_id=xxx
 * Verifica se o tenant tem tokens do Google salvos.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const { tenant_id } = req.query
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })

  // Verificar auth
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  // Verificar permissão
  const { data: profile } = await supabaseAdmin()
    .from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
  const isPlatformAdmin = profile?.is_platform_admin || false

  if (!isPlatformAdmin) {
    const { data: member } = await supabaseAdmin()
      .from('tenant_members').select('tenant_id').eq('user_id', user.id).eq('tenant_id', tenant_id).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
  }

  const { data } = await supabaseAdmin()
    .from('google_contacts_auth')
    .select('tenant_id, expires_at')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  return res.status(200).json({ connected: !!data })
}
