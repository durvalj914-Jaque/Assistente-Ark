/**
 * GET /api/admin/clients
 * Lista todas as empresas (tenants) cadastradas na plataforma, com seus bots,
 * membros vinculados e convites pendentes — pra equipe Arkiel gerenciar tudo
 * numa tela só. Só a equipe Arkiel (is_platform_admin) pode chamar.
 * Header: Authorization: Bearer <supabase_session_token>
 */
import { requirePlatformAdmin } from '../../../lib/adminAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db } = ctx

  const [{ data: tenants, error: tErr }, { data: bots }, { data: members }, { data: invites }] = await Promise.all([
    db.from('tenants').select('*').order('created_at', { ascending: false }),
    db.from('bots').select('id, tenant_id, name, status, phone_number_id, waba_id, created_at'),
    db.from('tenant_members').select('tenant_id, role, user_id, profiles:user_id(email)'),
    db.from('tenant_invites').select('*').is('accepted_at', null),
  ])

  if (tErr) return res.status(500).json({ error: tErr.message })

  const clients = (tenants || []).map(t => ({
    ...t,
    bots: (bots || []).filter(b => b.tenant_id === t.id),
    members: (members || []).filter(m => m.tenant_id === t.id),
    pending_invites: (invites || []).filter(i => i.tenant_id === t.id),
  }))

  return res.status(200).json({ clients })
}
