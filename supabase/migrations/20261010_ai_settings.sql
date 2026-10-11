-- ═══════════════════════════════════════════════════════════════════════════
-- IA por tenant (aba "IA") — configuração de provedor de IA do próprio B2B.
-- A plataforma é gratuita: o custo da IA fica com o cliente (chave API dele).
-- A chave API é gravada SEMPRE criptografada (AES-256-GCM, lib/aiSecret.js) e
-- só o service role lê/insere; o frontend nunca vê a chave (só has_key).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'openai',
  model text,
  api_key_encrypted text,
  custom_base_url text,
  persona_instructions text,
  temperature numeric NOT NULL DEFAULT 0.4,
  max_tokens int NOT NULL DEFAULT 600,
  ai_handled_count int NOT NULL DEFAULT 0,
  last_test_ok boolean,
  last_test_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

COMMENT ON TABLE public.ai_settings IS 'Configuração de IA por tenant (aba IA): provedor, modelo e chave criptografada do próprio B2B.';

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

-- Membros do tenant podem LER a própria config (a chave vem criptografada e a
-- API nunca a devolve ao frontend). Escrita só via service role (API routes).
DROP POLICY IF EXISTS "ai_settings tenant read" ON public.ai_settings;
CREATE POLICY "ai_settings tenant read" ON public.ai_settings
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- Policies RLS rodam com os privilégios de quem consulta: garante execute.
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;

-- publicação realtime não precisa: aba IA não usa realtime.
