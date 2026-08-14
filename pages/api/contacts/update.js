/**
 * POST /api/contacts/update
 * Atualiza um contato (name, email, etc) usando service role key no server.
 * O frontend não consegue atualizar direto via Supabase client por causa do RLS.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { contact_id, name, email, organization, job_title, opt_in } = req.body
  if (!contact_id) return res.status(400).json({ error: 'contact_id é obrigatório' })

  // Verificar autenticação
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Verificar permissão: buscar perfil
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado' })

  // Buscar o contato
  const { data: contact, error: contactErr } = await db.from('contacts')
    .select('id, tenant_id, name')
    .eq('id', contact_id)
    .maybeSingle()

  if (contactErr) return res.status(500).json({ error: contactErr.message })
  if (!contact) return res.status(404).json({ error: 'Contato não encontrado' })

  // Se não for platform_admin, verificar se pertence ao mesmo tenant
  if (!profile.is_platform_admin) {
    const { data: member } = await db.from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', contact.tenant_id)
      .maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão para este tenant' })
  }

  // Montar objeto de update
  const updateData = {}
  if (name !== undefined) updateData.name = name
  if (email !== undefined) updateData.email = email
  if (organization !== undefined) updateData.organization = organization
  if (job_title !== undefined) updateData.job_title = job_title
  if (opt_in !== undefined) updateData.opt_in = opt_in
  updateData.updated_at = new Date().toISOString()

  if (Object.keys(updateData).length === 1) { // only updated_at
    return res.status(400).json({ error: 'Nada para atualizar' })
  }

  // Atualizar
  const { data: updated, error: updateErr } = await db.from('contacts')
    .update(updateData)
    .eq('id', contact_id)
    .select()
    .single()

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.status(200).json({ ok: true, contact: updated })
}
