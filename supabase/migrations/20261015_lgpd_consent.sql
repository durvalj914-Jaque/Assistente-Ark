-- LGPD: consentimento explícito no primeiro acesso (2026-10-15)
-- Aplicado em produção via Management API em 15/10/2026.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;
