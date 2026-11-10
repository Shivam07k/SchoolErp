/* Migration 32: Attendance Module Completion
   Closes the remaining plan gaps:
   - separation of duties + reporting cutoff settings
   - expanded status policy catalogue (approved leave, event, half day)
   - correction flagging after reporting cutoff
   - staff shift policy + derived minutes
   - durable notification outbox (idempotent, retryable)
   - staff availability signal for timetable substitution
   Idempotent. */

BEGIN;

/* ============================================================
   1. Attendance settings - governance fields
   ============================================================ */
ALTER TABLE school_attendance_settings
  ADD COLUMN IF NOT EXISTS separation_of_duties BOOLEAN DEFAULT true;
ALTER TABLE school_attendance_settings
  ADD COLUMN IF NOT EXISTS report_cutoff_days INT DEFAULT 2;
ALTER TABLE school_attendance_settings
  ADD COLUMN IF NOT EXISTS min_attendance_percent NUMERIC(5,2) DEFAULT 75.00;

COMMENT ON COLUMN school_attendance_settings.separation_of_duties IS 'When true a correction requester cannot approve their own correction.';
COMMENT ON COLUMN school_attendance_settings.report_cutoff_days IS 'Corrections after this many days past the register date are flagged as after-cutoff.';
COMMENT ON COLUMN school_attendance_settings.min_attendance_percent IS 'Default defaulter report threshold; configurable per report.';

/* ============================================================
   2. Expanded attendance status catalogue
   ============================================================ */
INSERT INTO school_attendance_policy (app_id, code, label, category, is_active, requires_reason, counts_as_present, sort_order)
SELECT c.app_id, p.code, p.label, p.category, true,
       CASE WHEN p.category IN ('excused', 'activity', 'partial') THEN true ELSE false END,
       CASE WHEN p.category IN ('present', 'late', 'partial', 'activity') THEN true ELSE false END,
       p.sort_order
FROM school_campuses c
CROSS JOIN LATERAL (
    VALUES
        ('LV',    'Approved Leave',   'excused',  9),
        ('MED',   'Medical Leave',    'excused', 10),
        ('EVT',   'Event / Activity', 'activity', 11),
        ('HD',    'Half Day',         'partial',  12),
        ('OD',    'On Duty',          'present',  13)
) AS p(code, label, category, sort_order)
ON CONFLICT (app_id, code) DO NOTHING;

/* ============================================================
   3. Correction governance fields
   ============================================================ */
ALTER TABLE school_attendance_correction
  ADD COLUMN IF NOT EXISTS after_cutoff BOOLEAN DEFAULT false;
ALTER TABLE school_attendance_correction
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE school_attendance_correction
  ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS ix_school_attendance_correction_batch
  ON school_attendance_correction (batch_id);

COMMENT ON COLUMN school_attendance_correction.batch_id IS 'Groups individually attributable bulk correction requests.';

/* ============================================================
   4. Staff shift policy (effective-dated)
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_staff_shift (
  id                      SERIAL PRIMARY KEY,
  app_id                  TEXT NOT NULL,
  campus_id               INT REFERENCES school_campuses(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  start_time              TIME NOT NULL,
  end_time                TIME NOT NULL,
  grace_minutes           INT NOT NULL DEFAULT 10,
  half_day_after_minutes  INT NOT NULL DEFAULT 240,
  expected_minutes        INT NOT NULL DEFAULT 480,
  effective_from          DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to            DATE,
  is_active               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_shift_app_campus_name
  ON school_staff_shift (app_id, COALESCE(campus_id, 0), name);
CREATE INDEX IF NOT EXISTS ix_school_staff_shift_app_campus
  ON school_staff_shift (app_id, campus_id, is_active);

COMMENT ON TABLE school_staff_shift IS 'Effective-dated staff work shift policy. Used to derive late/early/half-day values.';

/* Seed a default general shift per campus */
INSERT INTO school_staff_shift (app_id, campus_id, name, start_time, end_time, grace_minutes, half_day_after_minutes, expected_minutes, effective_from)
SELECT c.app_id, c.id, 'General', '08:30', '16:30', 10, 240, 480, CURRENT_DATE
FROM school_campuses c
ON CONFLICT (app_id, COALESCE(campus_id, 0), name) DO NOTHING;

/* Derived staff minutes + source + link shift */
ALTER TABLE school_staff_attendance
  ADD COLUMN IF NOT EXISTS late_minutes INT DEFAULT 0;
ALTER TABLE school_staff_attendance
  ADD COLUMN IF NOT EXISTS early_minutes INT DEFAULT 0;
ALTER TABLE school_staff_attendance
  ADD COLUMN IF NOT EXISTS worked_minutes INT DEFAULT 0;
ALTER TABLE school_staff_attendance
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_school_staff_attendance_shift'
  ) THEN
    ALTER TABLE school_staff_attendance
      ADD CONSTRAINT fk_school_staff_attendance_shift
      FOREIGN KEY (shift_id) REFERENCES school_staff_shift(id) ON DELETE SET NULL;
  END IF;
END $$;

/* ============================================================
   5. Durable notification outbox (attendance events)
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_attendance_outbox (
  id                BIGSERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL,
  idempotency_key   TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  student_id        INT REFERENCES school_students(id) ON DELETE SET NULL,
  employee_id       INT REFERENCES school_hr_employees(id) ON DELETE SET NULL,
  register_id       INT REFERENCES school_attendance_register(id) ON DELETE SET NULL,
  correction_id     INT REFERENCES school_attendance_correction(id) ON DELETE SET NULL,
  recipient         TEXT,
  channel           TEXT NOT NULL DEFAULT 'app',
  template_code     TEXT,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'suppressed')),
  attempts          INT NOT NULL DEFAULT 0,
  next_retry_at     TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  processed_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_attendance_outbox_key
  ON school_attendance_outbox (app_id, idempotency_key);
CREATE INDEX IF NOT EXISTS ix_school_attendance_outbox_status
  ON school_attendance_outbox (app_id, status, next_retry_at);
CREATE INDEX IF NOT EXISTS ix_school_attendance_outbox_register
  ON school_attendance_outbox (register_id);

COMMENT ON TABLE school_attendance_outbox IS 'Idempotent outbox for attendance notifications. Marking never blocks on provider delivery.';

/* Add config to notification log for shared communication compatibility */
ALTER TABLE school_notification_log
  ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

/* ============================================================
   6. Staff availability signal for timetable substitution
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_staff_availability (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL,
  employee_id         INT NOT NULL REFERENCES school_hr_employees(id) ON DELETE CASCADE,
  availability_date   DATE NOT NULL,
  availability_type   TEXT NOT NULL
                      CHECK (availability_type IN ('absent', 'leave', 'on_duty', 'training', 'partial')),
  source              TEXT NOT NULL DEFAULT 'attendance',
  staff_attendance_id INT REFERENCES school_staff_attendance(id) ON DELETE SET NULL,
  staff_leave_id      INT REFERENCES school_staff_leave(id) ON DELETE SET NULL,
  published           BOOLEAN NOT NULL DEFAULT false,
  published_at        TIMESTAMPTZ,
  note                TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_availability_emp_date
  ON school_staff_availability (app_id, employee_id, availability_date);
CREATE INDEX IF NOT EXISTS ix_school_staff_availability_date
  ON school_staff_availability (app_id, availability_date, published);

COMMENT ON TABLE school_staff_availability IS 'Staff unavailability published by attendance for the timetable substitution workflow.';

COMMIT;
