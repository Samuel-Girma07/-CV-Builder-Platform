-- ============================================
-- Migration 012: Mock interview transcript
-- Coach/candidate turns; candidate rows may carry a structured critique.
-- ============================================

-- === UP ===

CREATE TABLE IF NOT EXISTS interview_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  -- coach | candidate
  role VARCHAR(10) NOT NULL,
  -- Zero-based index of the question this turn belongs to.
  question_index INTEGER,
  content TEXT NOT NULL,
  -- { rating, strengths[], improvements[], sample_answer } on candidate turns.
  critique JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interview_messages_session ON interview_messages(session_id, id);

-- === DOWN (rollback) ===
-- DROP INDEX IF EXISTS idx_interview_messages_session;
-- DROP TABLE IF EXISTS interview_messages;
