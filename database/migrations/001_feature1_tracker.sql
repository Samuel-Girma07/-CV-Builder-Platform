-- ============================================
-- Migration 001: Feature 1 — Excel-Style Application Tracker
-- Created: 2026-07-04
-- ============================================

-- === UP ===

-- Add custom_fields JSONB column to applications for user-defined columns
ALTER TABLE applications ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';

-- Add status column to applications for pipeline tracking
ALTER TABLE applications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied';

-- Table to persist per-user column order and visibility preferences
CREATE TABLE IF NOT EXISTS user_table_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  column_order JSONB DEFAULT '[]'::jsonb,
  hidden_columns JSONB DEFAULT '[]'::jsonb,
  custom_column_defs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- === DOWN (rollback) ===
-- DROP TABLE IF EXISTS user_table_preferences;
-- ALTER TABLE applications DROP COLUMN IF EXISTS custom_fields;
-- ALTER TABLE applications DROP COLUMN IF EXISTS status;
