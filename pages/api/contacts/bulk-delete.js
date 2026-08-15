/**
 * POST /api/contacts/bulk-delete
 * Exclui multiplos contatos em massa usando service role key (bypassa RLS).
 * Body: { contact_ids: [id1, id2, ...] }
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { contact_ids } = req.body
  if (!contact_ids || !Array.isArray(contact_ids) || contact_ids.length === 0) {
    return res.status(400).json({ error: 'contact_ids deve ser um array nao vazio' })
  }

  // Verificar autenticacao
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Nao autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessao invalida' })

  const db = supabaseAdmin()

  // Verificar permissao
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(403).json({ error: 'Perfil nao encontrado' })

  // Se nao for platform_admin, verificar se todos os contatos pertencem a tenants do usuario
  if (!profile.is_platform_admin) {
    const { data: memberships } = await db.from('tenant_members')
      .select('tenant_id').eq('user_id', user.id)
    const tenantIds = (memberships || []).map(m => m.tenant_id)
    
    if (tenantIds.length === 0) return res.status(403).json({ error: 'Sem permissoes' })

    const { data: contactsToDelete } = await db.from('contacts')
      .select('id, tenant_id').in('id', contact_ids)
    
    const unauthorized = (contactsToDelete || []).filter(c => !tenantIds.includes(c.tenant_id))
    if (unauthorized.length > 0) {
      return res.status(403).json({ error: `Sem permissao para ${unauthorized.length} contato(s)` })
    }
  }

  // Excluir em massa
  const { error: deleteErr, count: deletedCount } = await db.from('contacts')
    .delete()
    .in('id', contact_ids)

  if (deleteErr) return res.status(500).json({ error: deleteErr.message })

  return res.status(200).json({
    ok: true,
    deleted: deletedCount || contact_ids.length,
    requested: contact_ids.length,
  })
}
