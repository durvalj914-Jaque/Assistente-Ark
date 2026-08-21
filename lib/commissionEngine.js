/**
 * lib/commissionEngine.js
 * 
 * Motor de comissionamento por ciclos.
 * 
 * Modelo: A cada R$ X (cycle_threshold) líquidos (após taxa do processador)
 * que o cliente B2B recebe no bolso, a Arkiel retém R$ Y (commission_amount) via split.
 * 
 * Fragmentação: valores que não completam um ciclo ficam acumulando para o próximo pagamento.
 */

/**
 * Processa um pagamento aprovado e calcula a comissão por ciclos.
 * 
 * @param {object} db - Supabase admin client
 * @param {object} payment - { tenant_id, order_id, payment_id, gross_amount, processor_fee, payment_method }
 * @returns {object} { cycles_completed, commission_amount, fragmentation_carry, total_accumulated }
 */
export async function processCommissionCycle(db, payment) {
  const { tenant_id, order_id, payment_id, gross_amount, processor_fee = 0 } = payment

  if (!tenant_id || !gross_amount) return { ok: false, error: 'Missing required fields' }

  // Net amount = what the B2B client actually pockets (gross - processor fee)
  const netThisPayment = Math.max(0, Number((gross_amount - processor_fee).toFixed(2)))

  // ── 1. Buscar ou criar o registro de ciclo do tenant ──
  let { data: cycle } = await db.from('commission_cycles')
    .select('*')
    .eq('tenant_id', tenant_id)
    .maybeSingle()

  if (!cycle) {
    // Criar com defaults (R$10 threshold, R$0,50 commission)
    const { data: newCycle, error } = await db.from('commission_cycles').insert({
      tenant_id,
      cycle_threshold: 10.00,
      commission_amount: 0.50,
      accumulated_net: 0,
      total_cycles_completed: 0,
      total_commission_earned: 0,
    }).select().single()

    if (error) return { ok: false, error: error.message }
    cycle = newCycle
  }

  // ── 2. Buscar config do plano ativo do tenant (se houver custom) ──
  try {
    const { data: tenant } = await db.from('tenants')
      .select('subscription')
      .eq('id', tenant_id)
      .maybeSingle()

    if (tenant?.subscription) {
      const sub = JSON.parse(tenant.subscription)
      if (sub?.limits?.commission_cycle_threshold) {
        cycle.cycle_threshold = Number(sub.limits.commission_cycle_threshold)
      }
      if (sub?.limits?.commission_amount) {
        cycle.commission_amount = Number(sub.limits.commission_amount)
      }
    }
  } catch {}

  const threshold = Number(cycle.cycle_threshold) || 10.00
  const commissionPer = Number(cycle.commission_amount) || 0.50

  // ── 3. Somar fragmentação anterior + net deste pagamento ──
  const prevAccumulated = Number(cycle.accumulated_net) || 0
  const totalAccumulated = Number((prevAccumulated + netThisPayment).toFixed(2))

  // ── 4. Calcular quantos ciclos completos ──
  const cyclesCompleted = Math.floor(totalAccumulated / threshold)
  const commissionThisPayment = Number((cyclesCompleted * commissionPer).toFixed(2))
  const newFragmentation = Number((totalAccumulated - (cyclesCompleted * threshold)).toFixed(2))

  // ── 5. Atualizar registro de ciclo ──
  const newTotalCycles = (cycle.total_cycles_completed || 0) + cyclesCompleted
  const newTotalCommission = Number(((cycle.total_commission_earned || 0) + commissionThisPayment).toFixed(2))

  await db.from('commission_cycles').update({
    accumulated_net: newFragmentation,
    total_cycles_completed: newTotalCycles,
    total_commission_earned: newTotalCommission,
    last_cycle_at: cyclesCompleted > 0 ? new Date().toISOString() : cycle.last_cycle_at,
    updated_at: new Date().toISOString(),
  }).eq('id', cycle.id)

  // ── 6. Registrar evento individual ──
  await db.from('commission_events').insert({
    tenant_id,
    cycle_id: cycle.id,
    order_id: order_id || null,
    payment_id: payment_id || null,
    gross_amount: Number(gross_amount.toFixed(2)),
    processor_fee: Number(processor_fee.toFixed(2)),
    net_amount: netThisPayment,
    cycles_this_payment: cyclesCompleted,
    commission_this_payment: commissionThisPayment,
    fragmentation_carry: newFragmentation,
  })

  console.log(`[commissionEngine] Tenant ${tenant_id}: net=${netThisPayment}, prev_frag=${prevAccumulated}, total=${totalAccumulated}, cycles=${cyclesCompleted}, commission=${commissionThisPayment}, new_frag=${newFragmentation}`)

  return {
    ok: true,
    net_this_payment: netThisPayment,
    previous_fragmentation: prevAccumulated,
    total_accumulated: totalAccumulated,
    cycles_completed: cyclesCompleted,
    commission_amount: commissionThisPayment,
    fragmentation_carry: newFragmentation,
    total_cycles: newTotalCycles,
    total_commission_earned: newTotalCommission,
    threshold,
    commission_per_cycle: commissionPer,
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
