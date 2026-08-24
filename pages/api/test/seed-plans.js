/**
 * GET /api/test/seed-plans — Cria planos starter, pro, enterprise na tabela plans
 * com limites alinhados com o lib/plans.js hardcoded
 * TEMPORÁRIO: rodar uma vez e remover
 */
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  // Primeiro, buscar planos existentes
  const { data: existing } = await db.from('plans').select('id, name').order('created_at', { ascending: true })
  const existingNames = (existing || []).map(p => p.name.toLowerCase())

  const plansToCreate = [
    {
      id: crypto.randomUUID(),
      name: 'Free',
      price: 0,
      billing_cycle: 'monthly',
      duration_days: null,
      description: 'Plano gratuito para começar',
      features: ['1 bot', '50 conversas iniciadas/mês', 'Painel básico', 'Suporte por e-mail'],
      resource_ids: [],
      limits: {
        max_bots: 1,
        max_messages_month: 500,
        max_conversations_month: 50,
        max_contacts: 100,
        has_catalog: false,
        has_pix: true,
        has_mercadopago: false,
        has_flow_editor: false,
        has_ai: false,
        has_human_transfer: true,
        has_push: false,
        has_multiuser: false,
        has_google_import: false,
        has_api: false,
        has_reports: false,
        storage_gb: 0.5,
        support_level: 'email',
        has_dedicated_number: false,
      },
      active: true,
    },
    {
      id: crypto.randomUUID(),
      name: 'Starter',
      price: 97,
      billing_cycle: 'monthly',
      duration_days: null,
      description: 'Para pequenos negócios',
      features: ['3 bots', '500 conversas iniciadas/mês', 'Editor de fluxos', 'Analytics', 'Suporte prioritário'],
      resource_ids: [],
      limits: {
        max_bots: 3,
        max_messages_month: 5000,
        max_conversations_month: 500,
        max_contacts: 1000,
        has_catalog: true,
        has_pix: true,
        has_mercadopago: true,
        has_flow_editor: true,
        has_ai: false,
        has_human_transfer: true,
        has_push: true,
        has_multiuser: false,
        has_google_import: true,
        has_api: false,
        has_reports: true,
        storage_gb: 2,
        support_level: 'priority',
        has_dedicated_number: false,
      },
      active: true,
    },
    {
      id: crypto.randomUUID(),
      name: 'Pro',
      price: 297,
      billing_cycle: 'monthly',
      duration_days: null,
      description: 'Para empresas em crescimento',
      features: ['10 bots', '2.000 conversas iniciadas/mês', 'Fluxos avançados', 'Portal do cliente', 'Webhook + API', 'Suporte VIP'],
      resource_ids: [],
      limits: {
        max_bots: 10,
        max_messages_month: 25000,
        max_conversations_month: 2000,
        max_contacts: 10000,
        has_catalog: true,
        has_pix: true,
        has_mercadopago: true,
        has_flow_editor: true,
        has_ai: true,
        has_human_transfer: true,
        has_push: true,
        has_multiuser: true,
        has_google_import: true,
        has_api: true,
        has_reports: true,
        storage_gb: 10,
        support_level: 'vip',
        has_dedicated_number: true,
      },
      active: true,
    },
    {
      id: crypto.randomUUID(),
      name: 'Enterprise',
      price: 0, // Contato direto
      billing_cycle: 'monthly',
      duration_days: null,
      description: 'Sob medida para grandes operações',
      features: ['Bots ilimitados', 'Conversas ilimitadas', 'SLA 99.9%', 'Onboarding dedicado', 'Gerente de conta'],
      resource_ids: [],
      limits: {
        max_bots: 999,
        max_messages_month: 999999,
        max_conversations_month: 999999,
        max_contacts: 999999,
        has_catalog: true,
        has_pix: true,
        has_mercadopago: true,
        has_flow_editor: true,
        has_ai: true,
        has_human_transfer: true,
        has_push: true,
        has_multiuser: true,
        has_google_import: true,
        has_api: true,
        has_reports: true,
        storage_gb: 100,
        support_level: 'dedicated',
        has_dedicated_number: true,
      },
      active: true,
    },
  ]

  const created = []
  const skipped = []

  for (const plan of plansToCreate) {
    if (existingNames.includes(plan.name.toLowerCase())) {
      // Atualizar plano existente
      const existingPlan = existing.find(p => p.name.toLowerCase() === plan.name.toLowerCase())
      const { error } = await db.from('plans').update({
        price: plan.price,
        billing_cycle: plan.billing_cycle,
        description: plan.description,
        features: plan.features,
        limits: plan.limits,
        active: plan.active,
      }).eq('id', existingPlan.id)
      if (error) {
        skipped.push(`${plan.name}: ${error.message}`)
      } else {
        created.push(`${plan.name} (atualizado)`)
      }
    } else {
      const { error } = await db.from('plans').insert(plan)
      if (error) {
        skipped.push(`${plan.name}: ${error.message}`)
      } else {
        created.push(`${plan.name} (criado)`)
      }
    }
  }

  return res.status(200).json({
    ok: true,
    created,
    skipped,
    message: 'Planos sincronizados com a tabela plans'
  })
}
