
-- ============================================================
-- CONVERSATION COST TRACKING
-- Captura custos reais da Meta por tipo de conversa
-- ============================================================

-- 1. Adicionar colunas de custo por tipo na tabela usage
ALTER TABLE usage 
  ADD COLUMN IF NOT EXISTS marketing_conversations int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS utility_conversations int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auth_conversations int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_cost_brl numeric(10,4) DEFAULT 0;

-- 2. Tabela para rastrear janelas de conversa únicas (evita dupla contagem)
CREATE TABLE IF NOT EXISTS conversation_windows (
  id            text PRIMARY KEY,           -- Meta conversation.id
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id        uuid REFERENCES bots(id) ON DELETE SET NULL,
  origin_type   text NOT NULL,               -- marketing | utility | authentication | service
  category      text,                        -- pricing.category da Meta
  phone_number  text,                        -- número que recebeu
  opened_at     timestamptz DEFAULT now(),
  expires_at    timestamptz,                  -- conversation.expiration_timestamp
  cost_brl      numeric(10,4) DEFAULT 0,
  month         text NOT NULL,                -- YYYY-MM para query rápida
  UNIQUE(id, month)
);

-- Índice para busca por tenant + mês
CREATE INDEX IF NOT EXISTS idx_conv_windows_tenant_month 
  ON conversation_windows(tenant_id, month);

-- 3. Função para registrar uma nova conversa business-initiated
-- Verifica se a conversation_id já foi contada, se não, incrementa e calcula custo
CREATE OR REPLACE FUNCTION track_conversation(
  p_conversation_id text,
  p_tenant_id uuid,
  p_bot_id uuid DEFAULT NULL,
  p_origin_type text DEFAULT 'utility',
  p_category text DEFAULT NULL,
  p_phone_number text DEFAULT NULL,
  p_month text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month text := COALESCE(p_month, to_char(now(), 'YYYY-MM'));
  v_exists boolean;
  v_cost numeric(10,4) := 0;
  v_result json;
BEGIN
  -- Verificar se esta conversation window já foi contada
  SELECT EXISTS(
    SELECT 1 FROM conversation_windows 
    WHERE id = p_conversation_id AND month = v_month
  ) INTO v_exists;
  
  IF v_exists THEN
    RETURN json_build_object('already_counted', true, 'conversation_id', p_conversation_id);
  END IF;
  
  -- Calcular custo em BRL baseado no tipo
  -- Preços Meta Brasil (USD → BRL @ ~5.50)
  CASE p_origin_type
    WHEN 'marketing'       THEN v_cost := 0.3438;  -- $0.0625 * 5.50
    WHEN 'utility'         THEN v_cost := 0.0374;  -- $0.0068 * 5.50
    WHEN 'authentication'  THEN v_cost := 0.0374;  -- $0.0068 * 5.50
    WHEN 'service'         THEN v_cost := 0;       -- Grátis
    WHEN 'referral'        THEN v_cost := 0;       -- Grátis
    WHEN 'customer_initiated' THEN v_cost := 0;    -- Grátis
    ELSE v_cost := 0.0374; -- Default: utility price
  END CASE;
  
  -- Registrar a conversation window
  INSERT INTO conversation_windows (id, tenant_id, bot_id, origin_type, category, phone_number, month, cost_brl)
  VALUES (p_conversation_id, p_tenant_id, p_bot_id, p_origin_type, p_category, p_phone_number, v_month, v_cost)
  ON CONFLICT (id, month) DO NOTHING;
  
  -- Incrementar contadores na tabela usage
  INSERT INTO usage (tenant_id, month, business_initiated_conversations, total_messages, meta_cost_brl)
  VALUES (p_tenant_id, v_month, 1, 1, v_cost)
  ON CONFLICT (tenant_id, month)
  DO UPDATE SET
    business_initiated_conversations = usage.business_initiated_conversations + 1,
    total_messages = usage.total_messages + 1,
    meta_cost_brl = usage.meta_cost_brl + v_cost,
    updated_at = now();
  
  -- Incrementar contador específico por tipo
  IF p_origin_type = 'marketing' THEN
    UPDATE usage SET marketing_conversations = marketing_conversations + 1 
    WHERE tenant_id = p_tenant_id AND month = v_month;
  ELSIF p_origin_type = 'utility' THEN
    UPDATE usage SET utility_conversations = utility_conversations + 1 
    WHERE tenant_id = p_tenant_id AND month = v_month;
  ELSIF p_origin_type = 'authentication' THEN
    UPDATE usage SET auth_conversations = auth_conversations + 1 
    WHERE tenant_id = p_tenant_id AND month = v_month;
  END IF;
  
  SELECT json_build_object(
    'already_counted', false,
    'conversation_id', p_conversation_id,
    'origin_type', p_origin_type,
    'cost_brl', v_cost,
    'month', v_month
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- 4. Função para obter custo detalhado
CREATE OR REPLACE FUNCTION get_usage_detailed(p_tenant_id uuid, p_month text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'messages', COALESCE(u.messages, 0),
    'conversations', COALESCE(u.conversations, 0),
    'business_initiated_conversations', COALESCE(u.business_initiated_conversations, 0),
    'service_messages', COALESCE(u.service_messages, 0),
    'total_messages', COALESCE(u.total_messages, 0),
    'marketing_conversations', COALESCE(u.marketing_conversations, 0),
    'utility_conversations', COALESCE(u.utility_conversations, 0),
    'auth_conversations', COALESCE(u.auth_conversations, 0),
    'meta_cost_brl', COALESCE(u.meta_cost_brl, 0),
    -- Estimar receita (preço do plano cobre o custo)
    'estimated_margin', COALESCE(u.meta_cost_brl, 0) > 0
  ) INTO result
  FROM usage u
  WHERE u.tenant_id = p_tenant_id AND u.month = p_month;
  
  IF result IS NULL THEN
    result := json_build_object(
      'messages', 0, 'conversations', 0,
      'business_initiated_conversations', 0, 'service_messages', 0,
      'total_messages', 0, 'marketing_conversations', 0,
      'utility_conversations', 0, 'auth_conversations', 0,
      'meta_cost_brl', 0
    );
  END IF;
  
  RETURN result;
END;
$$;

-- RLS na tabela conversation_windows
ALTER TABLE conversation_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own conversation windows" ON conversation_windows
  FOR SELECT USING (tenant_id IN (
    SELECT tm.tenant_id FROM tenant_members tm 
    JOIN auth.users u ON tm.user_id = u.id
    WHERE u.id = auth.uid()
  ));
