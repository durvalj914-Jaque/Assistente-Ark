// Planos e produtos Google Play
// Agora também suporta planos dinâmicos via subscription (PIX/MP)

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
    price: 9700,
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

/**
 * Verifica limites — agora lê subscription dinâmica se existir.
 */
export function checkLimit(tenant, usage, botCount = 0, field) {
  // Primeiro tenta a subscription dinâmica
  let sub = null
  try { sub = JSON.parse(tenant?.subscription || '{}') } catch {}

  if (sub && sub.status === 'active') {
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
      // Expirou — cai pro plano free
    } else {
      const limits = sub.limits || {}
      if (field === 'messages') return (usage?.messages || 0) < (limits.max_messages_month || 0)
      if (field === 'bots') return botCount < (limits.max_bots || 0)
      if (field === 'contacts') return true // verificado separadamente se max_contacts > 0
      return true
    }
  }

  // Fallback para planos hardcoded
  const plan = PLANS[tenant?.plan] || PLANS.free
  if (field === 'messages') return (usage?.messages || 0) < plan.max_messages_month
  if (field === 'bots')     return botCount < plan.max_bots
  return true
}

export function usagePercent(tenant, usage) {
  // Tenta subscription dinâmica primeiro
  let sub = null
  try { sub = JSON.parse(tenant?.subscription || '{}') } catch {}

  if (sub && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())) {
    const max = sub.limits?.max_messages_month || 0
    if (max >= 999999) return 0
    if (max === 0) return 100
    return Math.min(Math.round(((usage?.messages || 0) / max) * 100), 100)
  }

  // Fallback
  const plan = PLANS[tenant?.plan] || PLANS.free
  if (plan.max_messages_month >= 999999) return 0
  return Math.min(Math.round(((usage?.messages || 0) / plan.max_messages_month) * 100), 100)
}

/**
 * Verifica se o plano está ativo — agora também aceita subscription dinâmica.
 */
export function isPlanActive(tenant) {
  if (!tenant) return false

  // Verifica subscription dinâmica primeiro
  let sub = null
  try { sub = JSON.parse(tenant?.subscription || '{}') } catch {}

  if (sub && sub.status === 'active') {
    if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
      // Expirou — não está ativo via subscription
    } else {
      return true
    }
  }

  // Fallback para plano hardcoded
  if (tenant.plan === 'free') return true
  if (tenant.status !== 'active') return false
  if (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date()) return false
  return true
}

/**
 * Retorna o label do plano ativo (dinâmico ou hardcoded).
 */
export function getActivePlanLabel(tenant) {
  let sub = null
  try { sub = JSON.parse(tenant?.subscription || '{}') } catch {}
  if (sub && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())) {
    return sub.plan_name || 'Personalizado'
  }
  return PLANS[tenant?.plan]?.label || 'Free'
}

/**
 * Retorna os limites efetivos do tenant (dinâmico ou hardcoded).
 */
export function getEffectiveLimits(tenant) {
  let sub = null
  try { sub = JSON.parse(tenant?.subscription || '{}') } catch {}
  if (sub && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) >= new Date())) {
    return {
      max_bots: sub.limits?.max_bots || 1,
      max_messages_month: sub.limits?.max_messages_month || 500,
      features: sub.limits?.features || [],
      source: 'subscription',
      plan_name: sub.plan_name,
      expires_at: sub.expires_at,
    }
  }
  const plan = PLANS[tenant?.plan] || PLANS.free
  return {
    max_bots: plan.max_bots,
    max_messages_month: plan.max_messages_month,
    features: plan.features,
    source: 'hardcoded',
    plan_name: plan.label,
    expires_at: tenant?.plan_expires_at,
  }
}
