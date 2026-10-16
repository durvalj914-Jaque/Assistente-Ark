/**
 * POST /api/admin/2fa — TOTP 2FA do platform admin (LGPD art. 46: segurança do acesso a dados).
 * Body: { action: 'setup' | 'confirm' | 'verify' | 'disable', code? }
 *
 *   setup   → gera segredo pendente (criptografado) e devolve secret + otpauth:// pro app
 *   confirm → valida o primeiro código do app e ATIVA o 2FA (totp_enabled=true)
 *   verify  → checagem do portão de acesso ao /painel (rate limit rígido)
 *   disable → desativa (exige código válido; também apaga o segredo)
 *
 * Auth: Authorization: Bearer <session> (requirePlatformAdmin). O segredo nunca
 * sai em texto plano do banco: é cifrado com AES-256-GCM (lib/aiSecret.js).
 */
import { requirePlatformAdmin, rateLimit } from '../../../lib/serverAuth'
import { supabaseAdmin } from '../../../lib/supabase'
import { generateSecret, verifyTotp } from '../../../lib/totp'
import { encryptSecret, decryptSecret } from '../../../lib/aiSecret'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requirePlatformAdmin(req, res, { skip2fa: true })
  if (!user) return
  const db = supabaseAdmin()
  const { data: profile } = await db.from('profiles').select('id,email,totp_secret,totp_enabled,totp_last_ok').eq('id', user.id).maybeSingle()
  if (!profile) return res.status(404).json({ error: 'Perfil não encontrado' })

  const action = req.body?.action
  const code = String(req.body?.code || '').trim()

  // check → o portão do /painel pergunta ao servidor se a sessão 2FA ainda vale
  if (action === 'check') {
    if (!profile.totp_enabled) return res.status(200).json({ ok: true })
    const last = profile.totp_last_ok ? new Date(profile.totp_last_ok).getTime() : 0
    return res.status(200).json({ ok: !!last && Date.now() - last <= 8 * 3600 * 1000 })
  }

  if (action === 'setup') {
    if (profile.totp_enabled) return res.status(400).json({ error: '2FA já está ativo. Para trocar o segredo, desative primeiro.' })
    const secret = generateSecret()
    const { error } = await db.from('profiles').update({ totp_secret: encryptSecret(secret), totp_enabled: false, updated_at: new Date().toISOString() }).eq('id', user.id)
    if (error) return res.status(500).json({ error: 'Falha ao salvar o segredo: ' + error.message })
    const otpauth = `otpauth://totp/AssistenteArk:${encodeURIComponent(profile.email)}?secret=${secret}&issuer=Assistente%20Ark&algorithm=SHA1&digits=6&period=30`
    return res.status(200).json({ ok: true, secret, otpauth })
  }

  if (action === 'confirm') {
    const secret = decryptSecret(profile.totp_secret)
    if (!secret) return res.status(400).json({ error: 'Gere o segredo primeiro (action: setup)' })
    if (!verifyTotp(secret, code)) return res.status(400).json({ error: 'Código inválido. Confira a hora do celular e tente de novo.' })
    const { error } = await db.from('profiles').update({ totp_enabled: true, totp_last_ok: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, enabled: true })
  }

  if (action === 'verify') {
    if (!profile.totp_enabled) return res.status(200).json({ ok: true, enabled: false })
    if (!rateLimit('2fa-verify-' + user.id, 6, 5 * 60 * 1000)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 5 minutos.' })
    const secret = decryptSecret(profile.totp_secret)
    if (!secret || !verifyTotp(secret, code)) return res.status(401).json({ error: 'Código inválido' })
    await db.from('profiles').update({ totp_last_ok: new Date().toISOString() }).eq('id', user.id)
    return res.status(200).json({ ok: true })
  }

  if (action === 'disable') {
    if (!profile.totp_enabled) return res.status(400).json({ error: '2FA não está ativo' })
    const secret = decryptSecret(profile.totp_secret)
    if (!verifyTotp(secret, code)) return res.status(400).json({ error: 'Código inválido — não é possível desativar sem um código válido' })
    await db.from('profiles').update({ totp_secret: null, totp_enabled: false, totp_last_ok: null, updated_at: new Date().toISOString() }).eq('id', user.id)
    return res.status(200).json({ ok: true, enabled: false })
  }

  return res.status(400).json({ error: 'action inválida: setup | confirm | verify | disable' })
}
