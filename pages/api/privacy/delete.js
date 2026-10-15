/**
 * POST /api/privacy/delete — LGPD, art. 18 (eliminação de dados).
 *
 *   scope=contact → elimina TODOS os dados pessoais de um contato final
 *                   (mensagens, conversas, agendamentos, pedidos, comprovantes,
 *                    analytics) e o registro do contato. Parâmetro: contact_id OU phone.
 *                   Pagamentos ficam ANONIMIZADOS (mantidos sem vínculo pessoal)
 *                   por obrigação fiscal — o titular é informado na política.
 *
 *   scope=tenant  → elimina a conta inteira do tenant (autoexclusão do cliente).
 *                   Exige body.confirm === 'EXCLUIR' como confirmação explícita.
 *                   Remove dados de todas as tabelas do tenant, a empresa, os
 *                   memberships e o profile do usuário. O login Google (auth.users)
 *                   permanece, mas sem membership nenhum acesso existe.
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
  const { tenant_id, user } = auth
  const scope = req.body?.scope

  // ── Exclusão de um contato final (titular que conversou com o bot) ──
  if (scope === 'contact') {
    const contactId = req.body?.contact_id
    const phone = req.body?.phone
    if (!contactId && !phone) return res.status(400).json({ error: 'Informe contact_id ou phone' })

    let q = db.from('contacts').select('id,phone,name').eq('tenant_id', tenant_id)
    q = contactId ? q.eq('id', contactId) : q.eq('phone', phone)
    const { data: contact } = await q.maybeSingle()
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado neste tenant' })
    const cid = contact.id

    const steps = {}
    async function wipe(label, fn) {
      const { error } = await fn
      steps[label] = error ? 'erro: ' + error.message : 'ok'
    }

    // Ordem: filhos primeiro
    await wipe('mensagens', db.from('messages').delete().eq('tenant_id', tenant_id).eq('contact_id', cid))
    await wipe('conversas', db.from('conversations').delete().eq('tenant_id', tenant_id).eq('contact_id', cid))
    await wipe('agendamentos', db.from('appointments').delete().eq('tenant_id', tenant_id).eq('contact_id', cid))
    await wipe('pedidos', db.from('whatsapp_orders').delete().eq('tenant_id', tenant_id).eq('contact_id', cid))
    await wipe('comprovantes', db.from('payment_receipts').delete().eq('tenant_id', tenant_id).eq('contact_id', cid))
    await wipe('analytics', db.from('analytics_events').delete().eq('tenant_id', tenant_id).eq('contact_id', cid))
    // Pagamentos: anonimiza (dados fiscais não podem ser eliminados), desvinculando o titular
    const { error: payErr } = await db.from('payments')
      .update({ customer_phone: 'anonimizado', customer_name: null, pix_qr_url: '{"anonymized":true}' })
      .eq('tenant_id', tenant_id).eq('customer_phone', contact.phone)
    steps['pagamentos_anonimizados'] = payErr ? 'erro: ' + payErr.message : 'ok'
    // Por último: o contato em si
    await wipe('contato', db.from('contacts').delete().eq('tenant_id', tenant_id).eq('id', cid))

    const hasErr = Object.values(steps).some(v => String(v).startsWith('erro'))
    return res.status(hasErr ? 500 : 200).json({
      ok: !hasErr, deleted_contact: { phone: contact.phone, name: contact.name }, steps,
    })
  }

  // ── Autoexclusão do cliente (conta + todos os dados do tenant) ──
  if (scope === 'tenant') {
    if (req.body?.confirm !== 'EXCLUIR') {
      return res.status(400).json({ error: 'Confirmação necessária: envie { "scope": "tenant", "confirm": "EXCLUIR" }. Esta ação é irreversível.' })
    }

    const steps = {}
    async function wipe(label, fn) {
      const { error } = await fn
      steps[label] = error ? 'erro: ' + error.message : 'ok'
    }

    await wipe('mensagens', db.from('messages').delete().eq('tenant_id', tenant_id))
    await wipe('conversas', db.from('conversations').delete().eq('tenant_id', tenant_id))
    await wipe('contatos', db.from('contacts').delete().eq('tenant_id', tenant_id))
    await wipe('agendamentos', db.from('appointments').delete().eq('tenant_id', tenant_id))
    await wipe('pedidos', db.from('whatsapp_orders').delete().eq('tenant_id', tenant_id))
    await wipe('comprovantes', db.from('payment_receipts').delete().eq('tenant_id', tenant_id))
    await wipe('analytics', db.from('analytics_events').delete().eq('tenant_id', tenant_id))
    await wipe('pagamentos', db.from('payments').delete().eq('tenant_id', tenant_id))
    await wipe('produtos', db.from('products').delete().eq('tenant_id', tenant_id))
    await wipe('servicos', db.from('services').delete().eq('tenant_id', tenant_id))
    await wipe('blocos_de_agenda', db.from('schedule_blocks').delete().eq('tenant_id', tenant_id))
    await wipe('marketing', db.from('marketing_messages').delete().eq('tenant_id', tenant_id))
    await wipe('adesoes_sazonais', db.from('flow_subscriptions').delete().eq('tenant_id', tenant_id))
    await wipe('config_ia', db.from('ai_settings').delete().eq('tenant_id', tenant_id))
    await wipe('push_tokens', db.from('push_subscriptions').delete().eq('tenant_id', tenant_id))
    await wipe('fcm_tokens', db.from('fcm_tokens').delete().eq('tenant_id', tenant_id))
    await wipe('conexoes_agenda', db.from('calendar_connections').delete().eq('tenant_id', tenant_id))
    await wipe('bots', db.from('bots').delete().eq('tenant_id', tenant_id))
    await wipe('membros', db.from('tenant_members').delete().eq('tenant_id', tenant_id))
    await wipe('convites', db.from('tenant_invites').delete().eq('tenant_id', tenant_id))
    await wipe('empresa', db.from('tenants').delete().eq('id', tenant_id))
    // Profile do solicitante (outras pessoas são removidas daqui, não da auth)
    await wipe('profile', db.from('profiles').delete().eq('id', user.id))

    const hasErr = Object.values(steps).some(v => String(v).startsWith('erro'))
    return res.status(hasErr ? 500 : 200).json({
      ok: !hasErr, message: hasErr
        ? 'A exclusão foi parcial — verifique steps e contate arkieltech@gmail.com'
        : 'Conta e dados eliminados. O login Google continua existindo, mas sem acesso a nenhum tenant. Recomendamos fazer logout.',
      steps,
    })
  }

  return res.status(400).json({ error: 'scope inválido: use "contact" ou "tenant"' })
}
