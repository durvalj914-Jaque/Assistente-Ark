import { supabase, supabaseAdmin } from '../../../lib/supabase'

/**
 * POST /api/mercadopago/force-disconnect
 * 1. Pega o token atual do tenant (se existir)
 * 2. Revoga na API do MP
 * 3. Limpa mp_access_token no banco
 * 4. Retorna sucesso
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Não autenticado' })
  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Sessão inválida' })

  const db = supabaseAdmin()
  const { data: member } = await db.from('tenant_members').select('tenant_id').eq('user_id', user.id).maybeSingle()
  if (!member) return res.status(403).json({ error: 'Sem tenant' })

  const { data: tenant } = await db.from('tenants').select('id, mp_access_token').eq('id', member.tenant_id).maybeSingle()

  let revoked = false
  let revokeError = null

  // Se tem token, tentar revogar na API do MP
  if (tenant?.mp_access_token) {
    try {
      const parsed = JSON.parse(tenant.mp_access_token)
      const accessToken = parsed.access_token

      if (accessToken) {
        const revokeRes = await fetch('https://api.mercadopago.com/oauth/revoke', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: '3158906703766924',
            client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET_3,
            token: accessToken,
          })
        })
        revoked = revokeRes.ok
        if (!revoked) {
          const errData = await revokeRes.json().catch(() => ({}))
          revokeError = errData.message || errData.error || `HTTP ${revokeRes.status}`
        }
      }
    } catch (e) {
      revokeError = e.message
    }
  }

  // Independente de revogar ou não, limpar no banco
  const { error: updateError } = await db.from('tenants')
    .update({ mp_access_token: null })
    .eq('id', member.tenant_id)

  if (updateError) return res.status(500).json({ error: 'Erro ao limpar token: ' + updateError.message })

  return res.status(200).json({
    ok: true,
    revoked_on_mp: revoked,
    revoke_error: revokeError,
    message: revoked 
      ? 'Mercado Pago desconectado e autorização revogada com sucesso!' 
      : 'Token limpo do banco. Para reconectar, vá em Configurações do MP e remova o app Arkiel se necessário.',
  })
}
