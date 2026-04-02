-- ============================================================
-- ASSISTENTE ARK — SaaS Schema (Supabase)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS (empresas/clientes do SaaS)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,  -- ex: "empresa-abc"
  plan        text DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  status      text DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  owner_id    uuid REFERENCES auth.users(id),
  -- Limites por plano
  max_bots    int DEFAULT 1,
  max_messages_month int DEFAULT 1000,
  -- Billing
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Meta
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================================
-- MEMBROS DE CADA TENANT
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
-- BOTS (cada tenant pode ter N bots conforme plano)
-- ============================================================
CREATE TABLE IF NOT EXISTS bots (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name                text NOT NULL DEFAULT 'Meu Bot',
  status              text DEFAULT 'inactive' CHECK (status IN ('active','inactive','paused')),
  -- Meta API
  phone_number_id     text,
  access_token        text,
  waba_id             text,
  webhook_verify_token text DEFAULT 'ark_secret',
  -- Configurações
  greeting            text DEFAULT 'Olá! Como posso ajudar? 🤖',
  fallback_message    text DEFAULT 'Não entendi. Pode repetir?',
  human_takeover_keyword text DEFAULT 'humano',
  -- Fluxo (JSON)
  flow                jsonb DEFAULT '{"name":"Fluxo Principal","nodes":[]}'::jsonb,
  -- Stats cache
  total_messages      int DEFAULT 0,
  active_sessions     int DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ============================================================
-- CONTATOS (clientes do bot de cada tenant)
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
-- CONVERSAS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id      uuid REFERENCES bots(id) ON DELETE CASCADE,
  contact_id  uuid REFERENCES contacts(id) ON DELETE CASCADE,
  status      text DEFAULT 'open' CHECK (status IN ('open','bot','human','closed')),
  current_node_id text,
  session_data jsonb DEFAULT '{}',
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- MENSAGENS
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
-- USAGE (controle de consumo mensal)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE,
  month       text NOT NULL,  -- formato: "2024-04"
  messages    int DEFAULT 0,
  conversations int DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, month)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS uuid[] LANGUAGE sql SECURITY DEFINER AS $$
  SELECT array_agg(tenant_id) FROM tenant_members WHERE user_id = auth.uid();
$$;

-- Policies: tenants
CREATE POLICY "tenant_select" ON tenants FOR SELECT
  USING (id = ANY(get_user_tenant_ids()));
CREATE POLICY "tenant_insert" ON tenants FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tenant_update" ON tenants FOR UPDATE
  USING (id = ANY(get_user_tenant_ids()));

-- Policies: tenant_members
CREATE POLICY "members_select" ON tenant_members FOR SELECT
  USING (tenant_id = ANY(get_user_tenant_ids()));
CREATE POLICY "members_insert" ON tenant_members FOR INSERT
  WITH CHECK (tenant_id = ANY(get_user_tenant_ids()));

-- Policies: bots
CREATE POLICY "bots_select" ON bots FOR SELECT
  USING (tenant_id = ANY(get_user_tenant_ids()));
CREATE POLICY "bots_all" ON bots FOR ALL
  USING (tenant_id = ANY(get_user_tenant_ids()));

-- Policies: contacts
CREATE POLICY "contacts_all" ON contacts FOR ALL
  USING (tenant_id = ANY(get_user_tenant_ids()));

-- Policies: conversations
CREATE POLICY "conversations_all" ON conversations FOR ALL
  USING (tenant_id = ANY(get_user_tenant_ids()));

-- Policies: messages
CREATE POLICY "messages_all" ON messages FOR ALL
  USING (tenant_id = ANY(get_user_tenant_ids()));

-- Policies: usage
CREATE POLICY "usage_all" ON usage FOR ALL
  USING (tenant_id = ANY(get_user_tenant_ids()));

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bots_tenant ON bots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_phone ON contacts(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_month ON usage(tenant_id, month);

-- ============================================================
-- FUNÇÃO: incrementar uso mensal
-- ============================================================
CREATE OR REPLACE FUNCTION increment_usage(p_tenant_id uuid, p_month text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO usage(tenant_id, month, messages, conversations)
  VALUES (p_tenant_id, p_month, 1, 0)
  ON CONFLICT(tenant_id, month)
  DO UPDATE SET messages = usage.messages + 1, updated_at = now();
END;
$$;

-- ============================================================
-- FUNÇÃO: criar tenant + owner ao registrar
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_tenant_id uuid;
  company_name text;
  company_slug text;
BEGIN
  company_name := COALESCE(NEW.raw_user_meta_data->>'company', 'Minha Empresa');
  company_slug := lower(regexp_replace(company_name, '[^a-z0-9]', '-', 'g')) || '-' || substr(NEW.id::text, 1, 6);
  
  INSERT INTO tenants(name, slug, owner_id, plan)
  VALUES (company_name, company_slug, NEW.id, 'free')
  RETURNING id INTO new_tenant_id;
  
  INSERT INTO tenant_members(tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner');
  
  -- Cria bot padrão
  INSERT INTO bots(tenant_id, name)
  VALUES (new_tenant_id, 'Bot Principal');
  
  RETURN NEW;
END;
$$;

-- Trigger: quando usuário é criado no Supabase Auth, cria tenant automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_tenant();
