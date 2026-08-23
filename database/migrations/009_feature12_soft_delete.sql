-- 009_soft_delete.sql
-- Trash semantics for applications: deletes set deleted_at instead of removing
-- rows, enabling reliable undo and protecting against accidental mass loss.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_applications_user_active
  ON applications(user_id)
  WHERE deleted_at IS NULL;

-- === DOWN ===
-- DROP INDEX IF EXISTS idx_applications_user_active;
-- ALTER TABLE applications DROP COLUMN IF EXISTS deleted_at;
