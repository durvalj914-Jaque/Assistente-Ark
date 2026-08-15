/**
 * POST /api/contacts/delete
 * Exclui um contato usando service role key (bypassa RLS).
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { contact_id } = req.body
  if (!contact_id) return res.status(400).json({ error: 'contact_id é obrigatório' })

  // Verificar autenticação
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Verificar permissão
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado' })

  // Buscar o contato
  const { data: contact, error: contactErr } = await db.from('contacts')
    .select('id, tenant_id, name, phone')
    .eq('id', contact_id)
    .maybeSingle()

  if (contactErr) return res.status(500).json({ error: contactErr.message })
  if (!contact) return res.status(404).json({ error: 'Contato não encontrado' })

  // Verificar tenant
  if (!profile.is_platform_admin) {
    const { data: member } = await db.from('tenant_members')
      .select('tenant_id').eq('user_id', user.id).eq('tenant_id', contact.tenant_id).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão para este tenant' })
  }

  // Excluir
  const { error: deleteErr } = await db.from('contacts').delete().eq('id', contact_id)

  if (deleteErr) return res.status(500).json({ error: deleteErr.message })

  return res.status(200).json({ ok: true, deleted: true, contact })
}
