-- ============================================
-- CV Builder Platform - Database Schema
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table (stores structured CV data as JSONB)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parsed_json_data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user UNIQUE (user_id)
);

-- Applications table (stores job applications and generated cover letters)
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_user ON applications(user_id);

-- CV versions table (stores uploaded PDFs and their ATS X-Ray parsability reports)
CREATE TABLE IF NOT EXISTS cv_versions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_data BYTEA,
  parsability_report JSONB,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cv_versions_user ON cv_versions(user_id);
