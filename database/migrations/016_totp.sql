-- ============================================
-- Migration 016: TOTP two-factor authentication
-- The TOTP seed is stored AES-256-GCM encrypted (key derived from JWT_SECRET).
-- ============================================

-- === UP ===

ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;

-- === DOWN (rollback) ===
-- ALTER TABLE users DROP COLUMN IF EXISTS totp_enabled;
-- ALTER TABLE users DROP COLUMN IF EXISTS totp_secret_enc;
