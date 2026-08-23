-- ============================================
-- Migration 013: Application follow-up reminders
-- ============================================

-- === UP ===

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  -- pending | sent | dismissed
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  remind_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_pending
  ON reminders(user_id, remind_at)
  WHERE status = 'pending';

-- Opt-in for the weekly pipeline digest email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_opt_in BOOLEAN NOT NULL DEFAULT true;

-- === DOWN (rollback) ===
-- DROP INDEX IF EXISTS idx_reminders_user_pending;
-- DROP TABLE IF EXISTS reminders;
-- ALTER TABLE users DROP COLUMN IF EXISTS digest_opt_in;
