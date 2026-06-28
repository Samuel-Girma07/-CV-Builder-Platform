-- Create cv_versions table to store raw PDF data and parsability reports
CREATE TABLE IF NOT EXISTS cv_versions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_data BYTEA NOT NULL,
  parsability_report JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cv_versions_user ON cv_versions(user_id);
