// ── Autenticação server-side para API routes ──────────────────────────────
// requireUser: valida Bearer JWT
// requireTenant: valida JWT + membership do tenant (mata IDOR cross-tenant)
// requirePlatformAdmin: valida JWT + profiles.is_platform_admin
import { supabaseAdmin } from './supabase'

export function bearerToken(req) {
  const h = req.headers.authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

export async function requireUser(req, res) {
  const token = bearerToken(req)
  if (!token) { res.status(401).json({ error: 'Não autenticado' }); return null }
  let user = null
  try {
    const r = await supabaseAdmin().auth.getUser(token)
    user = r?.data?.user
  } catch (_) {}
  if (!user) { res.status(401).json({ error: 'Sessão inválida' }); return null }
  return user
}

// Valida que o usuário logado é membro do tenant alvo (recebido por query/body).
// Uso: const auth = await requireTenant(req, res); if (!auth) return;
export async function requireTenant(req, res, tenantId) {
  const user = await requireUser(req, res)
  if (!user) return null
  const tid = tenantId || req.query?.tenant_id || req.query?.tenantId || req.body?.tenant_id || req.body?.tenantId
  if (!tid || typeof tid !== 'string') { res.status(400).json({ error: 'tenant_id é obrigatório' }); return null }
  const { data: member } = await supabaseAdmin()
    .from('tenant_members')
    .select('tenant_id, role')
    .eq('tenant_id', tid)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) { res.status(403).json({ error: 'Sem acesso a este tenant' }); return null }
  return { user, tenant_id: tid, role: member.role }
}

export async function requirePlatformAdmin(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null
  const { data: profile } = await supabaseAdmin()
    .from('profiles')
    .select('is_platform_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_platform_admin) { res.status(403).json({ error: 'Acesso restrito' }); return null }
  return user
}

// Rate limit simples em memória (por instância serverless — mitiga rajadas)
const _buckets = new Map()
export function rateLimit(key, limit = 60, windowMs = 60000) {
  const now = Date.now()
  let b = _buckets.get(key, limit)
  if (!b || now - b.start > windowMs) { b = { start: now, count: 0 }; _buckets.set(key, b) }
  b.count++
  if (b.count > limit) return false
  if (_buckets.size > 5000) for (const [k, v] of _buckets) { if (now - v.start > windowMs) _buckets.delete(k) }
  return true
}

export function clientKey(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
}
