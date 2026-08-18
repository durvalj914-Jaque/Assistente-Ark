/**
 * GET  /api/conversations/status          — lista status do tenant (ativos, 24h)
 * POST /api/conversations/status          — cria novo status
 * DELETE /api/conversations/status?id=xxx  — deleta status
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Resolver tenant
  const { data: member } = await db.from('tenant_members')
    .select('tenant_id').eq('user_id', user.id)
    .order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Sem permissão' })
  const tenantId = member.tenant_id

  if (req.method === 'GET') {
    // Buscar status das últimas 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: statuses, error } = await db.from('status_updates')
      .select('id, content, type, media_id, bg_color, created_at, author_name, author_role')
      .eq('tenant_id', tenantId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      // Se a tabela não existir, retorna vazio
      if (error.message.includes('does not exist') || error.code === 'PGRST205') {
        return res.status(200).json({ statuses: [] })
      }
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ statuses: statuses || [] })
  }

  if (req.method === 'POST') {
    const { content, type, bg_color, media_id } = req.body
    if (!content && !media_id) return res.status(400).json({ error: 'Conteúdo é obrigatório' })

    const { data: profile } = await db.from('profiles')
      .select('full_name, role').eq('id', user.id).maybeSingle()

    const { data: status, error } = await db.from('status_updates').insert({
      tenant_id: tenantId,
      content: content || '',
      type: type || 'text',
      media_id: media_id || null,
      bg_color: bg_color || '#1f2c34',
      author_name: profile?.full_name || user.email?.split('@')[0] || 'Admin',
      author_role: profile?.role || 'admin',
    }).select().single()

    if (error) {
      if (error.message.includes('does not exist') || error.code === 'PGRST205') {
        return res.status(500).json({ error: 'Tabela status_updates não encontrada. Execute a migration.' })
      }
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ status })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id é obrigatório' })

    const { error } = await db.from('status_updates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
