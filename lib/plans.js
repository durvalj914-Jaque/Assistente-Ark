export const PLANS = {
  free: {
    label: 'Free',
    price: 0,
    max_bots: 1,
    max_messages_month: 1000,
    features: ['1 bot', '1.000 mensagens/mês', 'Painel básico', 'Suporte por e-mail']
  },
  pro: {
    label: 'Pro',
    price: 97,
    max_bots: 5,
    max_messages_month: 20000,
    features: ['5 bots', '20.000 mensagens/mês', 'Editor de fluxo avançado', 'Portal do cliente', 'Suporte prioritário']
  },
  enterprise: {
    label: 'Enterprise',
    price: null,
    max_bots: 999,
    max_messages_month: 999999,
    features: ['Bots ilimitados', 'Mensagens ilimitadas', 'Dedicado + SLA', 'Integrações customizadas', 'Gerente de conta']
  }
}

export function checkLimit(tenant, usage, field) {
  const plan = PLANS[tenant.plan] || PLANS.free
  if (field === 'messages') return (usage?.messages || 0) < plan.max_messages_month
  if (field === 'bots') return true
  return true
}
