-- LGPD nível 3: 2FA (TOTP) para o platform admin (2026-10-15)
-- totp_secret guarda o segredo CIFRADO (AES-256-GCM, lib/aiSecret.js) — nunca em texto plano.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
