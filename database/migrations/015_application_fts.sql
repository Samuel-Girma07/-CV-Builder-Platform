-- ============================================
-- Migration 015: Full-text search over applications
-- Generated tsvector across title/company/description with a GIN index,
-- powering instant keyword search in the tracker grid.
-- ============================================

-- === UP ===

ALTER TABLE applications ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(job_title, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(job_description, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_applications_fts
  ON applications USING GIN (search_vector);

-- === DOWN (rollback) ===
-- DROP INDEX IF EXISTS idx_applications_fts;
-- ALTER TABLE applications DROP COLUMN IF EXISTS search_vector;
