-- ============================================================
-- CV Builder Platform - Database Bootstrap
-- ============================================================
-- Single idempotent entry point for fresh installs. Safe to run
-- multiple times and against databases provisioned from either
-- the historical schema.sql or the numbered migrations.
--
--   psql -U <user> -d <database> -f database/bootstrap.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Core tables (final shape)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  must_change_password BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parsed_json_data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  job_description TEXT,
  ats_match_score INTEGER DEFAULT 0,
  missing_skills JSONB DEFAULT '[]'::jsonb,
  selected_tone VARCHAR(50),
  generated_cover_letter TEXT,
  tailored_cv_profile JSONB,
  interview_prep_guide JSONB,
  channel TEXT DEFAULT 'cold_apply',
  status TEXT NOT NULL DEFAULT 'Applied',
  red_flag_score INTEGER DEFAULT 0,
  red_flags JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. Support tables
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_table_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  column_order JSONB DEFAULT '[]'::jsonb,
  hidden_columns JSONB DEFAULT '[]'::jsonb,
  custom_column_defs JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS application_status_history (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  location VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cv_versions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_data BYTEA NOT NULL,
  parsability_report JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL DEFAULT 'mixed',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  question_count INTEGER NOT NULL DEFAULT 5,
  score INTEGER,
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interview_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,
  question_index INTEGER,
  content TEXT NOT NULL,
  critique JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_versions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parsed_json_data JSONB NOT NULL,
  trigger VARCHAR(30) NOT NULL DEFAULT 'manual_save',
  restored_from INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. Legacy-database reconciliation
--    No-ops on fresh installs; repairs databases created from
--    the original schema.sql before the feature migrations.
-- ------------------------------------------------------------

ALTER TABLE applications ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'cold_apply';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS red_flag_score INTEGER DEFAULT 0;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS red_flags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_opt_in BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  remind_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS app_activities (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Normalize legacy free-text statuses onto the canonical set.
UPDATE applications SET status = 'Applied'      WHERE lower(status) = 'applied';
UPDATE applications SET status = 'Interviewing' WHERE lower(status) = 'interviewing';
UPDATE applications SET status = 'Offered/Hired'
  WHERE lower(status) IN ('offered/hired', 'offered', 'offer', 'hired');
UPDATE applications SET status = 'Rejected'     WHERE lower(status) = 'rejected';
UPDATE applications
SET status = 'Applied'
WHERE status NOT IN ('Applied', 'Interviewing', 'Offered/Hired', 'Rejected');

-- Backfill status history once per application (guarded against re-runs).
INSERT INTO application_status_history (application_id, status, changed_at)
SELECT a.id, a.status, COALESCE(a.created_at, NOW())
FROM applications a
WHERE NOT EXISTS (
  SELECT 1 FROM application_status_history h WHERE h.application_id = a.id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_status_allowed'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_status_allowed
      CHECK (status IN ('Applied', 'Interviewing', 'Offered/Hired', 'Rejected'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);

CREATE INDEX IF NOT EXISTS idx_applications_user_active
  ON applications(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_app ON interviews(application_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_app ON interview_sessions(application_id);

CREATE INDEX IF NOT EXISTS idx_interview_messages_session ON interview_messages(session_id, id);

CREATE INDEX IF NOT EXISTS idx_reminders_user_pending
  ON reminders(user_id, remind_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_app_contacts_app ON app_contacts(application_id);

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

CREATE INDEX IF NOT EXISTS idx_cv_versions_user ON cv_versions(user_id);

CREATE INDEX IF NOT EXISTS idx_profile_versions_user
  ON profile_versions(user_id, created_at DESC);
