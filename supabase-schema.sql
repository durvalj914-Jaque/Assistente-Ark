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
  status          text DEFAULT 'bot' CHECK (status IN ('open','bot','human','closed')),
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
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  month         text NOT NULL,
  messages      int DEFAULT 0,
  conversations int DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(tenant_id, month)
);

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
