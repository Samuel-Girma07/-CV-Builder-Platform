-- 004_feature5_redflags.sql

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS red_flag_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS red_flags JSONB DEFAULT '[]'::jsonb;
