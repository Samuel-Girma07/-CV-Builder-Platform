-- Add must_change_password column for temporary password recovery workflow
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
