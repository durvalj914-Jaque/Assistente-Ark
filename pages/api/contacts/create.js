/**
 * POST /api/contacts/create
 * Cria um novo contato manualmente usando service role key (bypassa RLS).
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tenant_id, name, phone, email } = req.body

  if (!tenant_id) return res.status(400).json({ error: 'tenant_id é obrigatório' })
  if (!phone && !email) return res.status(400).json({ error: 'Telefone ou e-mail é obrigatório' })

  // Verificar autenticação
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Verificar permissão no tenant
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(403).json({ error: 'Perfil não encontrado' })

  if (!profile.is_platform_admin) {
    const { data: member } = await db.from('tenant_members')
      .select('tenant_id').eq('user_id', user.id).eq('tenant_id', tenant_id).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão para este tenant' })
  }

  // Normalizar telefone
  let normalizedPhone = null
  if (phone) {
    normalizedPhone = phone.replace(/\D/g, '')
  }

  // Verificar se já existe contato com mesmo telefone no tenant
  if (normalizedPhone) {
    const { data: existing } = await db.from('contacts')
      .select('id, name, phone')
      .eq('tenant_id', tenant_id)
      .eq('phone', normalizedPhone)
      .maybeSingle()
    if (existing) {
      if (name && name !== existing.name) {
        const { data: updated, error: updErr } = await db.from('contacts')
          .update({ name, email: email || existing.email, updated_at: new Date().toISOString() })
          .eq('id', existing.id).select().single()
        if (updErr) return res.status(500).json({ error: updErr.message })
        return res.status(200).json({ ok: true, contact: updated, created: false, message: 'Contato já existia — atualizado.' })
      }
      return res.status(200).json({ ok: true, contact: existing, created: false, message: 'Contato já existe.' })
    }
  }

  // Criar novo contato
  const { data: contact, error: insertErr } = await db.from('contacts')
    .insert({
      tenant_id,
      name: name || null,
      phone: normalizedPhone,
      email: email || null,
      source: 'manual',
      opt_in: true,
    })
    .select()
    .single()

  if (insertErr) return res.status(500).json({ error: insertErr.message })

  return res.status(200).json({ ok: true, contact, created: true })
}
