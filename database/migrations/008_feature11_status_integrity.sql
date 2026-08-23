-- 008_status_integrity.sql
-- 1) Normalize legacy free-text statuses (pre-validation rows and the old
--    lowercase default from migration 001) onto the canonical set.
-- 2) Enforce the canonical set at the database level so no client can
--    silently break funnel analytics again.

-- Case-insensitive normalization of known variants first
UPDATE applications SET status = 'Applied'      WHERE lower(status) = 'applied';
UPDATE applications SET status = 'Interviewing' WHERE lower(status) = 'interviewing';
UPDATE applications SET status = 'Offered/Hired'
  WHERE lower(status) IN ('offered/hired', 'offered', 'offer', 'hired');
UPDATE applications SET status = 'Rejected'     WHERE lower(status) = 'rejected';

-- Any remaining outlier (arbitrary junk values) falls back to the default
-- stage so the constraint below can always validate.
UPDATE applications
SET status = 'Applied'
WHERE status NOT IN ('Applied', 'Interviewing', 'Offered/Hired', 'Rejected');

-- Same cleanup for the history table the funnel reads from.
UPDATE application_status_history
SET status = CASE lower(status)
    WHEN 'applied' THEN 'Applied'
    WHEN 'interviewing' THEN 'Interviewing'
    WHEN 'offered/hired' THEN 'Offered/Hired'
    WHEN 'offered' THEN 'Offered/Hired'
    WHEN 'hired' THEN 'Offered/Hired'
    WHEN 'rejected' THEN 'Rejected'
    ELSE status
  END
WHERE lower(status) IN ('applied','interviewing','offered/hired','offered','hired','rejected');

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

-- === DOWN ===
-- ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_allowed;
