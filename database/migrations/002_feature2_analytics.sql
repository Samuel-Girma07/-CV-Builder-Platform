-- Up
ALTER TABLE applications ADD COLUMN channel TEXT DEFAULT 'cold_apply';

CREATE TABLE application_status_history (
  id SERIAL PRIMARY KEY,
  application_id INT REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill history for existing applications
INSERT INTO application_status_history (application_id, status, changed_at)
SELECT id, status, created_at FROM applications;

-- Down
-- DROP TABLE application_status_history;
-- ALTER TABLE applications DROP COLUMN channel;
