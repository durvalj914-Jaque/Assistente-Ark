// Planos e produtos Google Play
export const PLANS = {
  free: {
    label: 'Free',
    price: 0,
    max_bots: 1,
    max_messages_month: 500,
    google_product_id: null,
    features: ['1 bot', '500 msgs/mês', 'Painel básico', 'Suporte por e-mail']
  },
  starter: {
    label: 'Starter',
    price: 9700,          // centavos BRL
    max_bots: 3,
    max_messages_month: 5000,
    google_product_id: 'ark_starter_monthly',
    features: ['3 bots', '5.000 msgs/mês', 'Editor de fluxos', 'Analytics', 'Suporte prioritário']
  },
  pro: {
    label: 'Pro',
    price: 29700,
    max_bots: 10,
    max_messages_month: 25000,
    google_product_id: 'ark_pro_monthly',
    features: ['10 bots', '25.000 msgs/mês', 'Fluxos avançados', 'Portal do cliente', 'Webhook + API', 'Suporte VIP']
  },
  enterprise: {
    label: 'Enterprise',
    price: null,
    max_bots: 999,
    max_messages_month: 999999,
    google_product_id: 'ark_enterprise_monthly',
    features: ['Bots ilimitados', 'Msgs ilimitadas', 'SLA 99.9%', 'Onboarding dedicado', 'Gerente de conta']
  }
}

export const GOOGLE_PLAY_PACKAGE = 'com.arkiel.assistenteark'

export function getPlanByProductId(productId) {
  return Object.entries(PLANS).find(([, p]) => p.google_product_id === productId)?.[0] || 'free'
}

export function checkLimit(tenant, usage, botCount = 0, field) {
  const plan = PLANS[tenant?.plan] || PLANS.free
  if (field === 'messages') return (usage?.messages || 0) < plan.max_messages_month
  if (field === 'bots')     return botCount < plan.max_bots
  return true
}

export function usagePercent(tenant, usage) {
  const plan = PLANS[tenant?.plan] || PLANS.free
  if (plan.max_messages_month >= 999999) return 0
  return Math.min(Math.round(((usage?.messages || 0) / plan.max_messages_month) * 100), 100)
}

export function isPlanActive(tenant) {
  if (!tenant) return false
  if (tenant.plan === 'free') return true
  if (tenant.status !== 'active') return false
  if (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date()) return false
  return true
}
