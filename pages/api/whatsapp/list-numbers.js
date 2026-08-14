/**
 * GET /api/whatsapp/list-numbers
 * Lista todos os números de telefone na WABA compartilhada.
 * Requer: sessão autenticada (platform_admin)
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

const SHARED_WABA_ID = process.env.ARKIEL_SHARED_WABA_ID || '1867398900635798'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles')
    .select('platform_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.platform_admin) {
    return res.status(403).json({ error: 'Apenas administradores' })
  }

  const metaToken = process.env.META_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN_2
  if (!metaToken) return res.status(500).json({ error: 'Token da Meta não configurado' })

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v25.0/${SHARED_WABA_ID}/phone_numbers?fields=id,verified_name,display_phone_number,code_verification_status,platform_type,quality_rating,throughput,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${metaToken}` } }
    )
    const data = await resp.json()

    if (data.error) return res.status(500).json({ error: data.error.message })

    // Também buscar qual bot está usando cada número
    const numbers = await Promise.all((data.data || []).map(async (n) => {
      const { data: bot } = await db.from('bots')
        .select('id, name, tenant_id, status')
        .eq('phone_number_id', n.id)
        .maybeSingle()

      let tenantName = null
      if (bot?.tenant_id) {
        const { data: tenant } = await db.from('tenants')
          .select('name')
          .eq('id', bot.tenant_id)
          .maybeSingle()
        tenantName = tenant?.name
      }

      return {
        ...n,
        status: n.code_verification_status === 'VERIFIED' ? 'active' : 'pending',
        bot: bot ? { ...bot, tenant_name: tenantName } : null,
      }
    }))

    return res.status(200).json({ numbers })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
