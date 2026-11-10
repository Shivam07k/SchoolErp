/* Migration 31: Attendance source tracking
   Adds source columns to registers and entries per the M14 plan
   (register: source; entry: source). Idempotent. */

BEGIN;

ALTER TABLE school_attendance_register ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE school_attendance_entry ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

COMMENT ON COLUMN school_attendance_register.source IS 'How the register was created: manual, system_premark, import, discipline.';
COMMENT ON COLUMN school_attendance_entry.source IS 'How the entry was set: manual, system_premark, correction, import.';

COMMIT;
