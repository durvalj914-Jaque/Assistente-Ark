/**
 * lib/commissionEngine.js
 * 
 * ACP — Acumulador Cíclico Progressivo (motor de receita da Arkiel).
 * 
 * Modelo CICLO PROTEGIDO (bolso cheio) — nomenclatura oficial: ACP: a cada R$ X (cycle_threshold) LÍQUIDOS que o
 * cliente B2B põe no bolso, a Arkiel colhe os PRÓXIMOS R$ Y (commission_amount) do fluxo.
 * Um ciclo completo consome R$ X + R$ Y do fluxo recebido (ex: 10,00 + 0,50 = 10,50).
 *
 * Assim o B2B sempre vê notas cheias no bolso (nunca 9,50), e a taxa da Arkiel sai
 * do fluxo seguinte — take efetivo = Y / (X + Y)  (ex: 0,50 / 10,50 ≈ 4,76%).
 *
 * Fragmentação: o que não completa um ciclo fica acumulado (carryforward) para o próximo pagamento.
 */

/**
 * Processa um pagamento aprovado e calcula a comissão por ciclos.
 * 
 * @param {object} db - Supabase admin client
 * @param {object} payment - { tenant_id, order_id, payment_id, gross_amount, processor_fee, payment_method }
 * @returns {object} { cycles_completed, commission_amount, fragmentation_carry, total_accumulated }
 */
export async function processCommissionCycle(db, payment) {
  const { tenant_id, gross_amount, processor_fee = 0, order_id = null, payment_id = null } = payment || {}
  if (!tenant_id || !gross_amount) return { ok: false, error: 'Missing required fields' }

  // ── RPC atômica: FOR UPDATE no banco mata a corrida de pagamentos simultâneos ──
  const { data: r, error } = await db
    .rpc('process_commission_cycle', {
      p_tenant: tenant_id,
      p_gross: Number(gross_amount),
      p_fee: Number(processor_fee) || 0,
      p_order_id: order_id || null,
      p_payment_id: payment_id || null,
    })
    .maybeSingle()

  if (error) {
    console.error('[commissionEngine] RPC falhou:', error?.message)
    return { ok: false, error: error?.message }
  }
  if (!r?.ok) return { ok: false, error: r?.error || 'rpc error' }

  console.log(`[commissionEngine] Tenant ${tenant_id}: net=${r.net_this_payment}, cycles=${r.cycles_completed}, commission=${r.commission_amount}, frag=${r.fragmentation_carry}`)

  return {
    ok: true,
    net_this_payment: Number(r.net_this_payment),
    cycles_completed: Number(r.cycles_completed),
    commission_amount: Number(r.commission_amount),
    fragmentation_carry: Number(r.fragmentation_carry),
    threshold: Number(r.threshold),
    commission_per_cycle: Number(r.commission_per_cycle),
    cycle_length: Number(r.cycle_length),
    atomic: true,
  }
}

/**
 * Busca ou cria config de comissão para um tenant
 */
export async function getCommissionConfig(db, tenant_id) {
  let { data: cycle } = await db.from('commission_cycles')
    .select('*')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (!cycle) {
    const { data: newCycle } = await db.from('commission_cycles').insert({
      tenant_id,
      cycle_threshold: 10.00,
      commission_amount: 0.50,
      accumulated_net: 0,
      total_cycles_completed: 0,
      total_commission_earned: 0,
    }).select().single()
    cycle = newCycle
  }

  return {
    cycle_threshold: Number(cycle.cycle_threshold),
    commission_amount: Number(cycle.commission_amount),
    accumulated_net: Number(cycle.accumulated_net),
    total_cycles_completed: cycle.total_cycles_completed || 0,
    total_commission_earned: Number(cycle.total_commission_earned || 0),
    last_cycle_at: cycle.last_cycle_at,
  }
}
