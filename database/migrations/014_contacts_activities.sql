-- ============================================
-- Migration 014: Application contacts & activity log
-- People involved per application plus a typed interaction timeline.
-- ============================================

-- === UP ===

CREATE TABLE IF NOT EXISTS app_contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(120),
  email VARCHAR(255),
  phone VARCHAR(60),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_contacts_app ON app_contacts(application_id);

CREATE TABLE IF NOT EXISTS app_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_activities_app
  ON app_activities(application_id, occurred_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'app_activities_kind_allowed'
  ) THEN
    ALTER TABLE app_activities
      ADD CONSTRAINT app_activities_kind_allowed
      CHECK (kind IN ('note', 'call', 'email', 'interview', 'offer', 'rejection'));
  END IF;
END $$;

-- === DOWN (rollback) ===
-- ALTER TABLE app_activities DROP CONSTRAINT IF EXISTS app_activities_kind_allowed;
-- DROP INDEX IF EXISTS idx_app_activities_app;
-- DROP TABLE IF EXISTS app_activities;
-- DROP INDEX IF EXISTS idx_app_contacts_app;
-- DROP TABLE IF EXISTS app_contacts;
