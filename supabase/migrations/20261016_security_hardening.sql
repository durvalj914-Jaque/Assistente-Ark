-- HARDENING DE SEGURANÇA (auditoria 16/10/2026) — JÁ APLICADO em produção via Management API.
-- 1) Escalada de privilégio fechada: authenticated só edita full_name/avatar_url/consent_accepted_at
REVOKE UPDATE, INSERT ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, consent_accepted_at) ON public.profiles TO authenticated;
REVOKE UPDATE (is_platform_admin), INSERT (is_platform_admin) ON public.profiles FROM authenticated, anon;
REVOKE UPDATE (totp_secret, totp_enabled), INSERT (totp_secret, totp_enabled) ON public.profiles FROM authenticated, anon;
-- 2) View painel_clientes: privada (service role) e security_invoker
REVOKE ALL ON public.painel_clientes FROM anon, authenticated;
ALTER VIEW public.painel_clientes SET (security_invoker = true);
-- 3) anon perde todo poder de escrita no schema public
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
-- 4) RPCs SECURITY DEFINER: EXECUTE só para service_role (exceto trigger functions)
-- (loop aplicado para: deduct_credit, get_credit_balance, get_usage, get_usage_detailed,
--  get_user_tenant_ids, purchase_credits, track_conversation, process_commission_cycle,
--  increment_usage, increment_business_conversation, regenerate_api_key)
-- 5) Todas as policies UPDATE ganharam WITH CHECK (proibe mover registro p/ outro tenant)
