-- Add assigned_by and assigned_at to school_user_roles
ALTER TABLE school_user_roles 
ADD COLUMN IF NOT EXISTS assigned_by TEXT;

ALTER TABLE school_user_roles 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT now();

-- Add campus_id to school_staff
ALTER TABLE school_staff 
ADD COLUMN IF NOT EXISTS campus_id INT REFERENCES school_campuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_school_staff_campus ON school_staff (campus_id) WHERE campus_id IS NOT NULL;