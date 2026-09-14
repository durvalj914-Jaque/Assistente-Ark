-- ═══════════════════════════════════════════════════════════════════
-- MIGRAÇÃO DE SEGURANÇA — pentest 2026-09-13
-- 1) RLS das tabelas novas (USING(true) público → tenant-scoped)
-- 2) Tokens do Google protegidos em nível de coluna
-- 3) RPC atômica do motor ACP (FOR UPDATE — mata TOCTOU)
-- 4) Índice p/ dedupe do webhook; 5) password grant desativado
-- ═══════════════════════════════════════════════════════════════════

-- 0. índice de dedupe do webhook (messages.meta_message_id)
create index if not exists idx_messages_meta_message_id on public.messages(meta_message_id);

-- unique em commission_cycles.tenant_id (necessário p/ RPC race-safe)
create unique index if not exists commission_cycles_tenant_uidx on public.commission_cycles(tenant_id);

-- ── 1. derrubar policies públicas e recriar tenant-scoped ──
DROP POLICY IF EXISTS appointments_all ON public.appointments;
DROP POLICY IF EXISTS booking_settings_all ON public.booking_settings;
DROP POLICY IF EXISTS services_all ON public.services;
DROP POLICY IF EXISTS marketing_messages_all ON public.marketing_messages;
DROP POLICY IF EXISTS receipts_all ON public.payment_receipts;
DROP POLICY IF EXISTS calendar_connections_all ON public.calendar_connections;
DROP POLICY IF EXISTS "Users manage payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS google_contacts_auth_all ON public.google_contacts_auth;
DROP POLICY IF EXISTS wor_select ON public.whatsapp_onboarding_requests;
DROP POLICY IF EXISTS wor_insert ON public.whatsapp_onboarding_requests;
DROP POLICY IF EXISTS wor_update ON public.whatsapp_onboarding_requests;
DROP POLICY IF EXISTS service_role_all_cycles ON public.commission_cycles;
DROP POLICY IF EXISTS service_role_all_events ON public.commission_events;
DROP POLICY IF EXISTS plans_service_all ON public.plans;
DROP POLICY IF EXISTS bots_insert ON public.bots;
DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
DROP POLICY IF EXISTS tenant_invites_insert ON public.tenant_invites;

-- helper de membership (mesma expressão das tabelas core)
CREATE OR REPLACE FUNCTION public.is_tenant_member(ptenant uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ select exists (select 1 from tenant_members where user_id = auth.uid() and tenant_id = ptenant) $$;

-- CRUD tenant-scoped p/ as tabelas com tenant_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'appointments','booking_settings','services','marketing_messages',
    'payment_receipts','whatsapp_onboarding_requests','payment_methods'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id))', t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id))', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id))', t||'_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_tenant_member(tenant_id))', t||'_delete', t);
  END LOOP;
END $$;

-- calendar_connections: CRUD tenant-scoped (tokens protegidos por coluna abaixo)
DROP POLICY IF EXISTS calendar_connections_select ON public.calendar_connections;
CREATE POLICY calendar_connections_select ON public.calendar_connections FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS calendar_connections_insert ON public.calendar_connections;
CREATE POLICY calendar_connections_insert ON public.calendar_connections FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS calendar_connections_update ON public.calendar_connections;
CREATE POLICY calendar_connections_update ON public.calendar_connections FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS calendar_connections_delete ON public.calendar_connections;
CREATE POLICY calendar_connections_delete ON public.calendar_connections FOR DELETE TO authenticated USING (public.is_tenant_member(tenant_id));

-- commission_cycles / commission_events: leitura p/ membros; escrita só service-role
DROP POLICY IF EXISTS commission_cycles_select ON public.commission_cycles;
CREATE POLICY commission_cycles_select ON public.commission_cycles FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS commission_events_select ON public.commission_events;
CREATE POLICY commission_events_select ON public.commission_events FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

-- google_contacts_auth: NENHUMA policy p/ authenticated (só service-role) — guarda tokens
-- (nenhuma policy criada)

-- whatsapp_onboarding_requests recria com nomes legados
DROP POLICY IF EXISTS wor_select ON public.whatsapp_onboarding_requests;
CREATE POLICY wor_select ON public.whatsapp_onboarding_requests FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS wor_insert ON public.whatsapp_onboarding_requests;
CREATE POLICY wor_insert ON public.whatsapp_onboarding_requests FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS wor_update ON public.whatsapp_onboarding_requests;
CREATE POLICY wor_update ON public.whatsapp_onboarding_requests FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id));

-- plans: matriz pública p/ usuários logados; escrita apenas service-role
DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans FOR SELECT TO authenticated USING (true);

-- bots/products: inserção só por membro do tenant
DROP POLICY IF EXISTS bots_insert ON public.bots;
CREATE POLICY bots_insert ON public.bots FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));

-- push_subscriptions: usuário só mexe nas próprias inscrições
DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- tenant_invites: membro do tenant convida e lista
DROP POLICY IF EXISTS tenant_invites_select ON public.tenant_invites;
CREATE POLICY tenant_invites_select ON public.tenant_invites FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS tenant_invites_insert ON public.tenant_invites;
CREATE POLICY tenant_invites_insert ON public.tenant_invites FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS tenant_invites_update ON public.tenant_invites;
CREATE POLICY tenant_invites_update ON public.tenant_invites FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id));

-- ── 2. tokens do Google: revogar leitura das colunas sensíveis ──
REVOKE SELECT (access_token, refresh_token) ON public.calendar_connections FROM authenticated, anon;
REVOKE SELECT ON public.google_contacts_auth FROM authenticated, anon;

-- ── 3. RPC atômica do ACP (FOR UPDATE — concorrência segura) ──
CREATE OR REPLACE FUNCTION public.process_commission_cycle(
  p_tenant uuid, p_gross numeric, p_fee numeric,
  p_order_id uuid DEFAULT null, p_payment_id uuid DEFAULT null
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record; v_sub jsonb; v_threshold numeric; v_commission numeric;
  v_net numeric; v_total numeric; v_len numeric; v_cycles int; v_comm numeric; v_frag numeric;
BEGIN
  IF p_tenant IS NULL OR p_gross IS NULL OR p_gross <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid input');
  END IF;

  SELECT * INTO c FROM commission_cycles WHERE tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    BEGIN
      INSERT INTO commission_cycles (tenant_id, cycle_threshold, commission_amount, accumulated_net, total_cycles_completed, total_commission_earned)
      VALUES (p_tenant, 10, 0.50, 0, 0, 0);
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    SELECT * INTO c FROM commission_cycles WHERE tenant_id = p_tenant FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'cycle create failed'); END IF;
  END IF;

  BEGIN
    SELECT subscription INTO v_sub FROM tenants WHERE id = p_tenant;
    v_threshold := coalesce(nullif(v_sub->'limits'->>'commission_cycle_threshold','')::numeric, c.cycle_threshold);
    v_commission := coalesce(nullif(v_sub->'limits'->>'commission_amount','')::numeric, c.commission_amount);
  EXCEPTION WHEN OTHERS THEN
    v_threshold := c.cycle_threshold; v_commission := c.commission_amount;
  END;
  IF v_threshold IS NULL OR v_threshold <= 0 THEN v_threshold := 10; END IF;
  IF v_commission IS NULL OR v_commission < 0 THEN v_commission := 0.50; END IF;

  v_net   := round(greatest(p_gross - coalesce(p_fee, 0), 0), 2);
  v_total := round(coalesce(c.accumulated_net, 0) + v_net, 2);
  v_len   := round(v_threshold + v_commission, 2);
  v_cycles := floor((v_total + 0.000000001) / v_len)::int;
  v_comm  := round(v_cycles * v_commission, 2);
  v_frag  := round(v_total - (v_cycles * v_len), 2);

  UPDATE commission_cycles SET
    accumulated_net = v_frag,
    total_cycles_completed = coalesce(total_cycles_completed, 0) + v_cycles,
    total_commission_earned = round(coalesce(total_commission_earned, 0) + v_comm, 2),
    last_cycle_at = CASE WHEN v_cycles > 0 THEN now() ELSE last_cycle_at END,
    updated_at = now()
  WHERE id = c.id;

  INSERT INTO commission_events (tenant_id, cycle_id, order_id, payment_id, gross_amount, processor_fee, net_amount, cycles_this_payment, commission_this_payment, fragmentation_carry)
  VALUES (p_tenant, c.id, p_order_id, p_payment_id, round(p_gross, 2), round(coalesce(p_fee, 0), 2), v_net, v_cycles, v_comm, v_frag);

  RETURN jsonb_build_object(
    'ok', true, 'net_this_payment', v_net, 'cycles_completed', v_cycles,
    'commission_amount', v_comm, 'fragmentation_carry', v_frag,
    'threshold', v_threshold, 'commission_per_cycle', v_commission, 'cycle_length', v_len
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.process_commission_cycle(uuid, numeric, numeric, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_commission_cycle(uuid, numeric, numeric, uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid) FROM public, anon, authenticated;

-- ── 4. desativa password grant (auth é 100% Google OAuth) ──
UPDATE auth.users SET encrypted_password = NULL WHERE encrypted_password IS NOT NULL;
