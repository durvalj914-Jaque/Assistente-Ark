-- ============================================================
-- ASSISTENTE ARK — Schema Completo v3.0
-- Execute no SQL Editor do Supabase (idempotente)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  text NOT NULL,
  slug                  text UNIQUE NOT NULL,
  plan                  text DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
  status                text DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','trial')),
  owner_id              uuid REFERENCES auth.users(id),
  max_bots              int DEFAULT 1,
  max_messages_month    int DEFAULT 500,
  -- Google Billing
  google_order_id       text,
  google_product_id     text,
  google_purchase_token text,
  google_subscription_id text,
  billing_provider      text DEFAULT 'none' CHECK (billing_provider IN ('none','google_play','google_iap')),
  plan_expires_at       timestamptz,
  trial_ends_at         timestamptz,
  -- Meta
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ============================================================
-- TENANT_MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- ============================================================
-- BOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS bots (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name                  text NOT NULL DEFAULT 'Meu Bot',
  status                text DEFAULT 'inactive' CHECK (status IN ('active','inactive','paused')),
  phone_number_id       text,
  access_token          text,
  waba_id               text,
  webhook_verify_token  text DEFAULT 'ark_secret',
  greeting              text DEFAULT 'Olá! Como posso ajudar? 🤖',
  fallback_message      text DEFAULT 'Não entendi. Pode repetir?',
  human_takeover_keyword text DEFAULT 'humano',
  flow                  jsonb DEFAULT '{"name":"Fluxo Principal","nodes":[]}'::jsonb,
  total_messages        int DEFAULT 0,
  active_sessions       int DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  name        text,
  email       text,
  tags        text[] DEFAULT '{}',
  metadata    jsonb DEFAULT '{}',
  opt_in      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id          uuid REFERENCES bots(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES contacts(id) ON DELETE CASCADE,
  status          text DEFAULT 'bot' CHECK (status IN ('open','bot','no_bot','human','closed','awaiting_payment_amount')),
  current_node_id text,
  session_data    jsonb DEFAULT '{}',
  last_message    text,
  last_message_at timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  bot_id          uuid REFERENCES bots(id),
  contact_id      uuid REFERENCES contacts(id),
  direction       text CHECK (direction IN ('inbound','outbound')),
  type            text DEFAULT 'text',
  content         text,
  meta_message_id text,
  status          text DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- USAGE (consumo mensal por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage (
  id                            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  month                         text NOT NULL,
  messages                      int DEFAULT 0,
  conversations                 int DEFAULT 0,
  business_initiated_conversations int DEFAULT 0,
  service_messages              int DEFAULT 0,
  total_messages                int DEFAULT 0,
  marketing_conversations       int DEFAULT 0,
  utility_conversations         int DEFAULT 0,
  auth_conversations            int DEFAULT 0,
  meta_cost_brl                 numeric(10,4) DEFAULT 0,
  updated_at                    timestamptz DEFAULT now(),
  UNIQUE(tenant_id, month)
);

-- Tabela para rastrear janelas de conversa únicas da Meta (evita dupla contagem)
CREATE TABLE IF NOT EXISTS conversation_windows (
  id            text NOT NULL,           -- Meta conversation.id
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id        uuid REFERENCES bots(id) ON DELETE SET NULL,
  origin_type   text NOT NULL,           -- marketing | utility | authentication | service
  category      text,                    -- pricing.category da Meta
  phone_number  text,                    -- phone_number_id que enviou
  opened_at     timestamptz DEFAULT now(),
  expires_at    timestamptz,             -- conversation.expiration_timestamp
  cost_brl      numeric(10,4) DEFAULT 0,
  month         text NOT NULL,           -- YYYY-MM
  UNIQUE(id, month)
);

CREATE INDEX IF NOT EXISTS idx_conv_windows_tenant_month 
  ON conversation_windows(tenant_id, month);

-- ============================================================
-- BILLING_EVENTS (auditoria de pagamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_events (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL,
  event_type      text NOT NULL,
  order_id        text,
  product_id      text,
  purchase_token  text,
  amount_cents    int,
  currency        text DEFAULT 'BRL',
  status          text DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','refunded')),
  raw_payload     jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage          ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER AS $$
  SELECT array_agg(tenant_id) FROM tenant_members WHERE user_id = auth.uid();
$$;

-- Tenants
DROP POLICY IF EXISTS "tenant_select" ON tenants;
DROP POLICY IF EXISTS "tenant_insert" ON tenants;
DROP POLICY IF EXISTS "tenant_update" ON tenants;
CREATE POLICY "tenant_select" ON tenants FOR SELECT USING (id = ANY(get_user_tenant_ids()));
CREATE POLICY "tenant_insert" ON tenants FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tenant_update" ON tenants FOR UPDATE USING (id = ANY(get_user_tenant_ids()));

-- Demais tabelas
DROP POLICY IF EXISTS "members_select" ON tenant_members;
DROP POLICY IF EXISTS "members_insert" ON tenant_members;
CREATE POLICY "members_select" ON tenant_members FOR SELECT USING (tenant_id = ANY(get_user_tenant_ids()));
CREATE POLICY "members_insert" ON tenant_members FOR INSERT WITH CHECK (tenant_id = ANY(get_user_tenant_ids()));

DROP POLICY IF EXISTS "bots_all" ON bots;
CREATE POLICY "bots_all" ON bots FOR ALL USING (tenant_id = ANY(get_user_tenant_ids()));
DROP POLICY IF EXISTS "contacts_all" ON contacts;
CREATE POLICY "contacts_all" ON contacts FOR ALL USING (tenant_id = ANY(get_user_tenant_ids()));
DROP POLICY IF EXISTS "conversations_all" ON conversations;
CREATE POLICY "conversations_all" ON conversations FOR ALL USING (tenant_id = ANY(get_user_tenant_ids()));
DROP POLICY IF EXISTS "messages_all" ON messages;
CREATE POLICY "messages_all" ON messages FOR ALL USING (tenant_id = ANY(get_user_tenant_ids()));
DROP POLICY IF EXISTS "usage_all" ON usage;
CREATE POLICY "usage_all" ON usage FOR ALL USING (tenant_id = ANY(get_user_tenant_ids()));
DROP POLICY IF EXISTS "billing_all" ON billing_events;
CREATE POLICY "billing_all" ON billing_events FOR ALL USING (tenant_id = ANY(get_user_tenant_ids()));

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bots_tenant              ON bots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bots_phone_id            ON bots(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_phone    ON contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant     ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact    ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status     ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation    ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created         ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_month       ON usage(tenant_id, month);
CREATE INDEX IF NOT EXISTS idx_billing_tenant           ON billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_order            ON billing_events(order_id);

-- ============================================================
-- FUNÇÕES
-- ============================================================
CREATE OR REPLACE FUNCTION increment_usage(p_tenant_id uuid, p_month text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO usage(tenant_id, month, messages)
  VALUES (p_tenant_id, p_month, 1)
  ON CONFLICT(tenant_id, month)
  DO UPDATE SET messages = usage.messages + 1, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_tenant_id uuid;
  company_name  text;
  company_slug  text;
BEGIN
  company_name := COALESCE(NEW.raw_user_meta_data->>'company', 'Minha Empresa');
  company_slug := lower(regexp_replace(company_name, '[^a-z0-9]', '-', 'g'))
                  || '-' || substr(NEW.id::text, 1, 6);
  INSERT INTO tenants(name, slug, owner_id, plan)
  VALUES (company_name, company_slug, NEW.id, 'free')
  RETURNING id INTO new_tenant_id;
  INSERT INTO tenant_members(tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner');
  INSERT INTO bots(tenant_id, name)
  VALUES (new_tenant_id, 'Bot Principal');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_tenant();


-- ============================================================
-- CONVERSATION COST TRACKING FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION track_conversation(
  p_conversation_id text,
  p_tenant_id uuid,
  p_bot_id uuid DEFAULT NULL,
  p_origin_type text DEFAULT 'utility',
  p_category text DEFAULT NULL,
  p_phone_number text DEFAULT NULL,
  p_month text DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_month text := COALESCE(p_month, to_char(now(), 'YYYY-MM'));
  v_exists boolean;
  v_cost numeric(10,4) := 0;
  v_result json;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM conversation_windows 
    WHERE id = p_conversation_id AND month = v_month
  ) INTO v_exists;
  
  IF v_exists THEN
    RETURN json_build_object('already_counted', true, 'conversation_id', p_conversation_id);
  END IF;
  
  -- Custos Meta Brasil (USD → BRL @ ~5.50)
  CASE p_origin_type
    WHEN 'marketing'       THEN v_cost := 0.3438;
    WHEN 'utility'         THEN v_cost := 0.0374;
    WHEN 'authentication'  THEN v_cost := 0.0374;
    WHEN 'service'         THEN v_cost := 0;
    WHEN 'referral'        THEN v_cost := 0;
    WHEN 'customer_initiated' THEN v_cost := 0;
    ELSE v_cost := 0.0374;
  END CASE;
  
  INSERT INTO conversation_windows (id, tenant_id, bot_id, origin_type, category, phone_number, month, cost_brl)
  VALUES (p_conversation_id, p_tenant_id, p_bot_id, p_origin_type, p_category, p_phone_number, v_month, v_cost)
  ON CONFLICT (id, month) DO NOTHING;
  
  INSERT INTO usage (tenant_id, month, business_initiated_conversations, total_messages, meta_cost_brl)
  VALUES (p_tenant_id, v_month, 1, 1, v_cost)
  ON CONFLICT (tenant_id, month)
  DO UPDATE SET
    business_initiated_conversations = usage.business_initiated_conversations + 1,
    total_messages = usage.total_messages + 1,
    meta_cost_brl = usage.meta_cost_brl + v_cost,
    updated_at = now();
  
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
    'already_counted', false, 'conversation_id', p_conversation_id,
    'origin_type', p_origin_type, 'cost_brl', v_cost, 'month', v_month
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION get_usage_detailed(p_tenant_id uuid, p_month text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result json;
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
    'meta_cost_brl', COALESCE(u.meta_cost_brl, 0)
  ) INTO result
  FROM usage u WHERE u.tenant_id = p_tenant_id AND u.month = p_month;
  
  IF result IS NULL THEN
    result := json_build_object(
      'messages', 0, 'conversations', 0, 'business_initiated_conversations', 0,
      'service_messages', 0, 'total_messages', 0, 'marketing_conversations', 0,
      'utility_conversations', 0, 'auth_conversations', 0, 'meta_cost_brl', 0
    );
  END IF;
  RETURN result;
END;
$$;
