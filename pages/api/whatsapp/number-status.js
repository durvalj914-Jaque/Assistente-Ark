/**
 * POST /api/whatsapp/number-status
 * Saúde do número conectado: qualidade (Meta), limite de mensagens/24h,
 * status do nome verificado, modo da conta. Buscado direto na Graph API
 * com o token do próprio bot — nada de token da plataforma exposto.
 * Body: { bot_id: string }
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

const GRAPH = 'https://graph.facebook.com/v25.0'

const QUALITY = {
  GREEN:  { label: 'Excelente', emoji: '🟢', desc: 'Sem sinalizações recentes da Meta' },
  YELLOW: { label: 'Média',     emoji: '🟡', desc: 'A Meta recebeu alguns bloqueios/sinalizações — cuidado com disparos em massa' },
  RED:    { label: 'Baixa',     emoji: '🔴', desc: 'Número em risco — revise suas mensagens antes que a Meta restrinja o envio' },
  UNKNOWN:{ label: 'Desconhecida', emoji: '⚪', desc: 'A Meta ainda não avaliou este número' },
}

const TIER = {
  TIER_250: '250 conversas iniciadas / 24h',
  TIER_1K: '1.000 conversas iniciadas / 24h',
  TIER_10K: '10.000 conversas iniciadas / 24h',
  TIER_100K: '100.000 conversas iniciadas / 24h',
  TIER_UNLIMITED: 'Ilimitado',
}

const NAME_STATUS = {
  APPROVED: '✅ Nome verificado aprovado',
  PENDING: '⏳ Nome em revisão',
  NONE: 'Sem nome verificado',
  REJECTED: '❌ Nome rejeitado — fale com o suporte',
  DECLINED: '⚠️ Nome recusado pela Meta — o número segue funcionando; fale com o suporte pra reabrir',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Sessão inválida' })

  const { bot_id } = req.body || {}
  if (!bot_id) return res.status(400).json({ error: 'bot_id é obrigatório' })

  const db = supabaseAdmin()

  // Garante que o bot pertence a um tenant do usuário
  const { data: member } = await db.from('tenant_members').select('tenant_id, role').eq('user_id', user.id).limit(1).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Sem tenant vinculado' })

  const { data: bot } = await db.from('bots')
    .select('id, tenant_id, phone_number_id, access_token, name')
    .eq('id', bot_id)
    .eq('tenant_id', member.tenant_id)
    .maybeSingle()
  if (!bot) return res.status(403).json({ error: 'Sem acesso a este bot' })
  if (!bot.phone_number_id) return res.status(400).json({ error: 'Bot sem número conectado' })

  // Token do próprio bot; fallback para o system user da plataforma (WABA compartilhada)
  const accessToken = bot.access_token || process.env.META_SYSTEM_USER_TOKEN
  if (!accessToken) return res.status(500).json({ error: 'Token de acesso indisponível' })

  try {
    const fields = 'verified_name,display_phone_number,quality_rating,name_status,messaging_limit_tier,account_membership_status,account_mode,platform_type'
    const r = await fetch(`${GRAPH}/${bot.phone_number_id}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d?.error?.message || `Erro ${r.status} na Graph API`)

    const q = QUALITY[d.quality_rating] || QUALITY.UNKNOWN
    return res.json({
      ok: true,
      number: d.display_phone_number || null,
      verified_name: d.verified_name || bot.name,
      quality: { code: d.quality_rating || 'UNKNOWN', ...q },
      messaging_limit: TIER[d.messaging_limit_tier] || (d.messaging_limit_tier || 'Não informado'),
      name_status: NAME_STATUS[d.name_status] || (d.name_status || 'Não informado'),
      account_mode: d.account_mode || null,
    })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}
