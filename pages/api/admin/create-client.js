/**
 * POST /api/admin/create-client
 * Cria uma nova empresa (tenant) do zero, já com um bot padrão, pra equipe
 * Arkiel deixar pronto antes mesmo do cliente entrar na plataforma.
 * Body: { company_name, owner_email, plan }
 * Header: Authorization: Bearer <supabase_session_token>
 *
 * Regra chave: NÃO cria o vínculo do usuário direto (a menos que ele já tenha
 * conta). Em vez disso insere um convite pendente em `tenant_invites` — o
 * mesmo mecanismo usado pra convidar membros de equipe. O trigger
 * `handle_new_user_tenant` (que roda a cada novo login/cadastro) já verifica
 * convites pendentes por e-mail ANTES de criar um tenant novo automático.
 * Isso evita qualquer risco de duplicar/misturar contas quando o cliente
 * entrar de verdade com o Google.
 */
import crypto from 'crypto'
import { requirePlatformAdmin } from '../../../lib/adminAuth'

const VALID_PLANS = ['free', 'starter', 'pro', 'enterprise']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requirePlatformAdmin(req, res)
  if (!ctx) return
  const { db, user } = ctx

  const { company_name, owner_email, plan } = req.body || {}
  if (!company_name?.trim()) return res.status(400).json({ error: 'Nome da empresa é obrigatório' })
  if (!owner_email?.trim() || !owner_email.includes('@')) return res.status(400).json({ error: 'E-mail do responsável é obrigatório e precisa ser válido' })

  const email = owner_email.trim().toLowerCase()
  const finalPlan = VALID_PLANS.includes(plan) ? plan : 'free'

  // Verifica se já existe alguém com esse e-mail cadastrado na plataforma
  const { data: existingProfile } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existingProfile) {
    const { data: existingMembership } = await db
      .from('tenant_members').select('tenant_id').eq('user_id', existingProfile.id).maybeSingle()
    if (existingMembership) {
      return res.status(409).json({ error: 'Esse e-mail já está vinculado a uma empresa existente no Assistente Ark. Se for pra migrar de conta, avise a equipe técnica.' })
    }
  }

  const apiKey = 'ark_live_' + crypto.randomUUID().replace(/-/g, '')

  const { data: tenant, error: tErr } = await db
    .from('tenants')
    .insert({ name: company_name.trim(), plan: finalPlan, status: 'active', api_key: apiKey })
    .select().single()
  if (tErr) return res.status(500).json({ error: 'Erro ao criar empresa: ' + tErr.message })

  const { data: bot, error: bErr } = await db
    .from('bots')
    .insert({
      tenant_id: tenant.id,
      name: 'Meu Bot',
      status: 'inactive',
      greeting: 'Olá! Sou seu assistente virtual 🤖',
      fallback_message: 'Não entendi 🤔. Digite *0* para voltar ao menu.',
      human_takeover_keyword: 'humano',
    })
    .select().single()
  if (bErr) {
    // desfaz o tenant se o bot não pôde ser criado, pra não deixar lixo pela metade
    await db.from('tenants').delete().eq('id', tenant.id)
    return res.status(500).json({ error: 'Erro ao criar bot padrão: ' + bErr.message })
  }

  let linkedExisting = false
  if (existingProfile) {
    const { error: mErr } = await db.from('tenant_members').insert({ tenant_id: tenant.id, user_id: existingProfile.id, role: 'owner' })
    if (mErr) return res.status(500).json({ error: 'Empresa criada, mas falhou ao vincular o usuário existente: ' + mErr.message })
    linkedExisting = true
  } else {
    const { error: iErr } = await db.from('tenant_invites').insert({ tenant_id: tenant.id, email, role: 'owner', invited_by: user.id })
    if (iErr) return res.status(500).json({ error: 'Empresa criada, mas falhou ao registrar o convite: ' + iErr.message })
  }

  return res.status(200).json({ tenant, bot, linked_existing: linkedExisting })
}
