/**
 * POST /api/privacy/export — LGPD, art. 18 (acesso e portabilidade).
 * Exporta, em JSON, os dados do titular solicitado:
 *
 *   scope=tenant  → todos os dados do tenant do usuário logado (titular = cliente da plataforma)
 *   scope=contact → dados de um contato final (titular que conversa com o bot),
 *                   usado pela equipe Arkiel/DPO para atender pedidos enviados a
 *                   arkieltech@gmail.com. Parâmetros: contact_id OU phone.
 *
 * Auth: Authorization: Bearer <supabase_session_token> (requireTenant).
 */
import { requireTenant } from '../../../lib/serverAuth'
import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = await requireTenant(req, res)
  if (!auth) return
  const db = supabaseAdmin()
  const { tenant_id } = auth
  const scope = req.body?.scope || 'tenant'

  const out = { generated_at: new Date().toISOString(), scope, tenant_id }

  async function grab(table, query, key) {
    const { data, error } = await query
    if (error) { out[key] = { error: error.message }; return }
    out[key] = data
  }

  if (scope === 'tenant') {
    // Dados da conta e da empresa (titular = usuário da plataforma)
    await grab('tenants', db.from('tenants').select('id,name,pix_key,merchant_name,merchant_city,plan,status,subscription,plan_expires_at,created_at').eq('id', tenant_id).maybeSingle(), 'empresa')
    await grab('tenant_members', db.from('tenant_members').select('tenant_id,role,created_at').eq('tenant_id', tenant_id), 'membros')
    await grab('bots', db.from('bots').select('id,name,status,phone_number_id,menu_style,persistent_message,greeting,fallback_message,human_takeover_keyword,flow,created_at').eq('tenant_id', tenant_id), 'bots')
    // Catálogo e serviços
    await grab('products', db.from('products').select('*').eq('tenant_id', tenant_id), 'produtos')
    await grab('services', db.from('services').select('*').eq('tenant_id', tenant_id), 'servicos')
    // Atividade
    await grab('conversations', db.from('conversations').select('*').eq('tenant_id', tenant_id), 'conversas')
    await grab('messages', db.from('messages').select('*').eq('tenant_id', tenant_id).limit(20000), 'mensagens')
    await grab('appointments', db.from('appointments').select('*').eq('tenant_id', tenant_id), 'agendamentos')
    await grab('whatsapp_orders', db.from('whatsapp_orders').select('*').eq('tenant_id', tenant_id), 'pedidos')
    await grab('payments', db.from('payments').select('*').eq('tenant_id', tenant_id), 'pagamentos')
    await grab('analytics_events', db.from('analytics_events').select('*').eq('tenant_id', tenant_id), 'eventos_analytics')
    await grab('marketing_messages', db.from('marketing_messages').select('*').eq('tenant_id', tenant_id), 'mensagens_marketing')
    await grab('flow_subscriptions', db.from('flow_subscriptions').select('*').eq('tenant_id', tenant_id), 'adesoes_sazonais')
    // Contatos são dados PESSOAIS de titulares finais: exportados como cumplicidade de portabilidade do tenant
    await grab('contacts', db.from('contacts').select('*').eq('tenant_id', tenant_id), 'contatos')
    return res.status(200).json(out)
  }

  if (scope === 'contact') {
    // Localizar o contato no tenant
    const contactId = req.body?.contact_id
    const phone = req.body?.phone
    let contactQuery = db.from('contacts').select('*').eq('tenant_id', tenant_id)
    contactQuery = contactId ? contactQuery.eq('id', contactId) : contactQuery.eq('phone', phone)
    const { data: contact } = await contactQuery.maybeSingle()
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado neste tenant' })

    out.contato = contact
    await grab('conversations', db.from('conversations').select('*').eq('tenant_id', tenant_id).eq('contact_id', contact.id), 'conversas')
    await grab('messages', db.from('messages').select('*').eq('tenant_id', tenant_id).eq('contact_id', contact.id).limit(20000), 'mensagens')
    await grab('appointments', db.from('appointments').select('*').eq('tenant_id', tenant_id).eq('contact_id', contact.id), 'agendamentos')
    await grab('whatsapp_orders', db.from('whatsapp_orders').select('*').eq('tenant_id', tenant_id).eq('contact_id', contact.id), 'pedidos')
    await grab('payment_receipts', db.from('payment_receipts').select('*').eq('tenant_id', tenant_id).eq('contact_id', contact.id), 'comprovantes')
    await grab('analytics_events', db.from('analytics_events').select('*').eq('tenant_id', tenant_id).eq('contact_id', contact.id), 'eventos_analytics')
    return res.status(200).json(out)
  }

  return res.status(400).json({ error: 'scope inválido: use "tenant" ou "contact"' })
}
