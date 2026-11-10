-- Add campus_id to school_users
ALTER TABLE school_users 
ADD COLUMN IF NOT EXISTS campus_id INT REFERENCES school_campuses(id) ON DELETE SET NULL;

ALTER TABLE school_users
ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_school_users_campus ON school_users (campus_id) WHERE campus_id IS NOT NULL;