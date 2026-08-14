/**
 * POST /api/conversations/start
 * Cria (ou reutiliza) uma conversa para um contato, permitindo iniciar chat
 * mesmo sem o cliente ter enviado mensagem antes.
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { contact_id } = req.body
  if (!contact_id) return res.status(400).json({ error: 'contact_id é obrigatório' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()

  // Buscar perfil e tenant
  const { data: profile } = await db.from('profiles').select('id, is_platform_admin').eq('id', user.id).maybeSingle()
  let tenantId = null
  if (!profile?.is_platform_admin) {
    const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!member) return res.status(403).json({ error: 'Sem permissão' })
    tenantId = member.tenant_id
  }

  // Buscar o contato
  let contactQuery = db.from('contacts').select('id, tenant_id, phone, name').eq('id', contact_id)
  if (tenantId) contactQuery = contactQuery.eq('tenant_id', tenantId)

  const { data: contact, error: contactErr } = await contactQuery.maybeSingle()
  if (contactErr) return res.status(500).json({ error: contactErr.message })
  if (!contact) return res.status(404).json({ error: 'Contato não encontrado' })

  if (!contact.phone) return res.status(400).json({ error: 'Contato sem número de telefone' })

  // Buscar um bot do tenant
  let botQuery = db.from('bots').select('id, name, phone_number_id, access_token, status').eq('tenant_id', contact.tenant_id)
  if (tenantId) botQuery = botQuery.eq('tenant_id', tenantId)

  const { data: bots } = await botQuery.order('created_at', { ascending: true }).limit(1)
  const bot = bots?.[0]
  if (!bot) return res.status(400).json({ error: 'Nenhum bot encontrado para este tenant' })

  // Verificar se já existe conversa aberta
  const { data: existing } = await db.from('conversations')
    .select('*')
    .eq('tenant_id', contact.tenant_id)
    .eq('contact_id', contact.id)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return res.status(200).json({ ok: true, conversation_id: existing.id, existing: true })
  }

  // Criar nova conversa
  const { data: newConv, error: convErr } = await db.from('conversations')
    .insert({
      tenant_id: contact.tenant_id,
      bot_id: bot.id,
      contact_id: contact.id,
      status: 'human',
      last_message: 'Conversa iniciada manualmente',
      last_message_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (convErr) return res.status(500).json({ error: convErr.message })

  return res.status(200).json({ ok: true, conversation_id: newConv.id, existing: false })
}
