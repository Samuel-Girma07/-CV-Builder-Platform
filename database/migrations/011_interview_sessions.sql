-- ============================================
-- Migration 011: Mock interview sessions
-- Practice interviews coached against the candidate's real CV.
-- ============================================

-- === UP ===

CREATE TABLE IF NOT EXISTS interview_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  -- behavioral | technical | mixed
  mode VARCHAR(20) NOT NULL DEFAULT 'mixed',
  -- active | completed | abandoned
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  question_count INTEGER NOT NULL DEFAULT 5,
  score INTEGER,
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_app ON interview_sessions(application_id);

-- === DOWN (rollback) ===
-- DROP INDEX IF EXISTS idx_interview_sessions_app;
-- DROP INDEX IF EXISTS idx_interview_sessions_user;
-- DROP TABLE IF EXISTS interview_sessions;
