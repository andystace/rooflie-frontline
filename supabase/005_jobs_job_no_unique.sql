-- =============================================
-- Job number uniqueness (anti-dupe backstop)
-- Run this SQL in the Supabase SQL Editor
-- =============================================

-- The app already refuses to import a job number that's already in
-- Frontline (see CsvImport.jsx). This is the database-level backstop so
-- that can never be bypassed — e.g. by two people importing at once, or
-- any future code path that forgets the check.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_job_no_unique ON jobs (job_no);
