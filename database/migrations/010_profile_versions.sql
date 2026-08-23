-- ============================================
-- Migration 010: Profile version history
-- Snapshots of the structured CV profile so users can audit changes
-- and roll back destructive edits or bad AI parses.
-- ============================================

-- === UP ===

CREATE TABLE IF NOT EXISTS profile_versions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parsed_json_data JSONB NOT NULL,
  -- What produced this snapshot: manual_save | ai_parse | ai_summary | restore
  trigger VARCHAR(30) NOT NULL DEFAULT 'manual_save',
  -- Set when this row was created by restoring an older version.
  restored_from INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_versions_user
  ON profile_versions(user_id, created_at DESC);

-- === DOWN (rollback) ===
-- DROP INDEX IF EXISTS idx_profile_versions_user;
-- DROP TABLE IF EXISTS profile_versions;
