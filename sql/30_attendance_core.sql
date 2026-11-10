/* Migration 30: Attendance Core
   Implements the canonical attendance workflow with registers, entries,
   policies, calendar context, leave, corrections, and staff attendance. */

BEGIN;

/* ============================================================
   1. Attendance Policy & Status Catalogue
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_attendance_policy (
    id              SERIAL PRIMARY KEY,
    app_id          TEXT NOT NULL,
    code            TEXT NOT NULL,
    label           TEXT NOT NULL,
    category        TEXT NOT NULL CHECK (category IN ('present', 'absent', 'late', 'partial', 'excused', 'activity', 'other')),
    is_active       BOOLEAN DEFAULT true,
    requires_reason BOOLEAN DEFAULT false,
    counts_as_present BOOLEAN DEFAULT false,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_attendance_policy_app_code
    ON school_attendance_policy (app_id, code);
CREATE INDEX IF NOT EXISTS ix_school_attendance_policy_app_active
    ON school_attendance_policy (app_id, is_active);

COMMENT ON TABLE school_attendance_policy IS 'Configurable attendance status codes per tenant. Maps to physical-present/absent/late/excused/activity categories.';

/* Seed default policies */
INSERT INTO school_attendance_policy (app_id, code, label, category, is_active, requires_reason, counts_as_present, sort_order)
SELECT c.app_id, p.code, p.label, p.category, true,
       CASE WHEN p.category IN ('excused', 'activity') THEN true ELSE false END,
       CASE WHEN p.category IN ('present', 'late', 'partial', 'activity') THEN true ELSE false END,
       p.sort_order
FROM school_campuses c
CROSS JOIN LATERAL (
    VALUES
        ('P', 'Present', 'present', 1),
        ('A', 'Absent', 'absent', 2),
        ('L', 'Late', 'late', 3),
        ('E', 'Excused', 'excused', 4),
        ('EA', 'Early Departure', 'partial', 5),
        ('SA', 'School Activity', 'activity', 6),
        ('EL', 'Excused Late', 'late', 7),
        ('O', 'Other', 'other', 8)
) AS p(code, label, category, sort_order)
ON CONFLICT (app_id, code) DO NOTHING;

/* ============================================================
   2. Attendance Register
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_attendance_register (
    id              SERIAL PRIMARY KEY,
    app_id          TEXT NOT NULL,
    academic_year_id INT NOT NULL REFERENCES school_academic_years(id) ON DELETE RESTRICT,
    campus_id       INT REFERENCES school_campuses(id) ON DELETE SET NULL,
    section_id      INT NOT NULL REFERENCES school_sections(id) ON DELETE RESTRICT,
    session_id      INT REFERENCES school_timetable_versions(id) ON DELETE SET NULL, -- optional period/session context
    register_date   DATE NOT NULL,
    state           TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'submitted', 'finalized', 'cancelled')),
    version         INT NOT NULL DEFAULT 1,
    source          TEXT DEFAULT 'manual',
    created_by      TEXT,
    submitted_by    TEXT,
    finalized_by    TEXT,
    submitted_at    TIMESTAMPTZ,
    finalized_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_attendance_register_context
    ON school_attendance_register (app_id, academic_year_id, section_id, register_date, COALESCE(session_id, 0));
CREATE INDEX IF NOT EXISTS ix_school_attendance_register_app_date
    ON school_attendance_register (app_id, register_date);
CREATE INDEX IF NOT EXISTS ix_school_attendance_register_section_date
    ON school_attendance_register (section_id, register_date);

COMMENT ON TABLE school_attendance_register IS 'Attendance register per section/date. One register per section per date (or session).';

/* ============================================================
   3. Attendance Register Entry
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_attendance_entry (
    id              SERIAL PRIMARY KEY,
    app_id          TEXT NOT NULL,
    register_id     INT NOT NULL REFERENCES school_attendance_register(id) ON DELETE CASCADE,
    student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE RESTRICT,
    policy_id       INT NOT NULL REFERENCES school_attendance_policy(id) ON DELETE RESTRICT,
    late_minutes    INT DEFAULT 0 CHECK (late_minutes >= 0),
    partial_minutes INT DEFAULT 0 CHECK (partial_minutes >= 0),
    remark          TEXT,
    source          TEXT DEFAULT 'manual',
    marked_by       TEXT,
    marked_at       TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_attendance_entry_register_student
    ON school_attendance_entry (register_id, student_id);
CREATE INDEX IF NOT EXISTS ix_school_attendance_entry_student
    ON school_attendance_entry (student_id);
CREATE INDEX IF NOT EXISTS ix_school_attendance_entry_policy
    ON school_attendance_entry (policy_id);

COMMENT ON TABLE school_attendance_entry IS 'Individual attendance entry within a register. One entry per student per register.';

/* ============================================================
   4. Calendar Context (School Days & Holidays)
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_calendar_event (
    id              SERIAL PRIMARY KEY,
    app_id          TEXT NOT NULL,
    campus_id       INT REFERENCES school_campuses(id) ON DELETE SET NULL,
    event_date      DATE NOT NULL,
    event_type      TEXT NOT NULL CHECK (event_type IN ('holiday', 'closure', 'half_day', 'event', 'exam', 'break')),
    label           TEXT NOT NULL,
    description     TEXT,
    applies_to_all  BOOLEAN DEFAULT true,
    section_ids     INT[],
    created_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_calendar_event_app_date_type
    ON school_calendar_event (app_id, event_date, event_type);
CREATE INDEX IF NOT EXISTS ix_school_calendar_event_app_date
    ON school_calendar_event (app_id, event_date);

COMMENT ON TABLE school_calendar_event IS 'School calendar events: holidays, closures, half-days, exams, etc. Determines instructional days.';

/* ============================================================
   5. Student Leave Requests
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_student_leave (
    id              SERIAL PRIMARY KEY,
    app_id          TEXT NOT NULL,
    student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
    leave_type      TEXT NOT NULL CHECK (leave_type IN ('medical', 'personal', 'emergency', 'family', 'other')),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    supporting_doc  TEXT, -- file reference
    created_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_school_student_leave_student_date
    ON school_student_leave (student_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS ix_school_student_leave_status
    ON school_student_leave (status);

COMMENT ON TABLE school_student_leave IS 'Student leave requests. Approved leave affects attendance register eligibility.';

/* ============================================================
   6. Attendance Corrections (Audit Trail)
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_attendance_correction (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL,
    entry_id            INT NOT NULL REFERENCES school_attendance_entry(id) ON DELETE RESTRICT,
    register_id         INT NOT NULL REFERENCES school_attendance_register(id) ON DELETE RESTRICT,
    student_id          INT NOT NULL REFERENCES school_students(id) ON DELETE RESTRICT,
    old_policy_id       INT REFERENCES school_attendance_policy(id),
    new_policy_id       INT REFERENCES school_attendance_policy(id),
    old_late_minutes    INT,
    new_late_minutes    INT,
    old_partial_minutes INT,
    new_partial_minutes INT,
    old_remark          TEXT,
    new_remark          TEXT,
    reason              TEXT NOT NULL,
    requested_by        TEXT NOT NULL,
    requested_at        TIMESTAMPTZ DEFAULT now(),
    reviewed_by         TEXT,
    reviewed_at         TIMESTAMPTZ,
    decision            TEXT CHECK (decision IN ('approved', 'rejected')),
    decision_reason     TEXT,
    processed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_school_attendance_correction_entry
    ON school_attendance_correction (entry_id);
CREATE INDEX IF NOT EXISTS ix_school_attendance_correction_register
    ON school_attendance_correction (register_id);
CREATE INDEX IF NOT EXISTS ix_school_attendance_correction_status
    ON school_attendance_correction (decision);

COMMENT ON TABLE school_attendance_correction IS 'Correction requests for attendance entries. Immutable audit trail.';

/* ============================================================
   7. Staff Leave (must be created before staff_attendance for FK)
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_staff_leave (
    id              SERIAL PRIMARY KEY,
    app_id          TEXT NOT NULL,
    employee_id     INT NOT NULL REFERENCES school_hr_employees(id) ON DELETE CASCADE,
    leave_type      TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'maternity', 'paternity', 'study', 'other')),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approved_by     TEXT,
    approved_at     TIMESTAMPTZ,
    created_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_school_staff_leave_emp_date
    ON school_staff_leave (employee_id, start_date, end_date);

/* ============================================================
   7. Staff Attendance (Separate from Student)
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_staff_attendance (
    id              SERIAL PRIMARY KEY,
    app_id          TEXT NOT NULL,
    employee_id     INT NOT NULL REFERENCES school_hr_employees(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    check_in        TIMESTAMPTZ,
    check_out       TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave', 'on_duty')),
    leave_id        INT REFERENCES school_staff_leave(id) ON DELETE SET NULL,
    shift_id        INT, -- future: reference to shift schedule
    marked_by       TEXT,
    marked_at       TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_staff_attendance_emp_date
    ON school_staff_attendance (app_id, employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS ix_school_staff_attendance_app_date
    ON school_staff_attendance (app_id, attendance_date);

COMMENT ON TABLE school_staff_attendance IS 'Staff attendance records. Separate from student attendance; linked to HR.';

/* ============================================================
   8. Attendance Policy Settings (Per Tenant/Campus)
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_attendance_settings (
    id                      SERIAL PRIMARY KEY,
    app_id                  TEXT NOT NULL,
    campus_id               INT REFERENCES school_campuses(id) ON DELETE SET NULL,
    default_session_type    TEXT DEFAULT 'daily' CHECK (default_session_type IN ('daily', 'period')),
    late_threshold_minutes  INT DEFAULT 15,
    partial_threshold_minutes INT DEFAULT 120,
    auto_finalize_at        TIME, -- time of day to auto-finalize
    finalize_days_after     INT DEFAULT 0, -- 0 = manual only
    require_reason_for      TEXT[] DEFAULT ARRAY['absent', 'late', 'excused'],
    notify_parents_on       TEXT[] DEFAULT ARRAY['absent', 'late'],
    notification_channels   TEXT[] DEFAULT ARRAY['app'],
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_attendance_settings_app_campus
    ON school_attendance_settings (app_id, campus_id);

COMMENT ON TABLE school_attendance_settings IS 'Attendance policy settings per tenant/campus.';

/* ============================================================
   9. Seed Default Attendance Policies
   ============================================================ */
INSERT INTO school_attendance_policy (app_id, code, label, category, is_active, requires_reason, counts_as_present, sort_order)
SELECT c.app_id, p.code, p.label, p.category, true,
       CASE WHEN p.category IN ('excused', 'activity') THEN true ELSE false END,
       CASE WHEN p.category IN ('present', 'late', 'partial', 'activity') THEN true ELSE false END,
       p.sort_order
FROM school_campuses c
CROSS JOIN LATERAL (
    VALUES
        ('P', 'Present', 'present', 1),
        ('A', 'Absent', 'absent', 2),
        ('L', 'Late', 'late', 3),
        ('E', 'Excused', 'excused', 4),
        ('EA', 'Early Departure', 'partial', 5),
        ('SA', 'School Activity', 'activity', 6),
        ('EL', 'Excused Late', 'late', 7),
        ('O', 'Other', 'other', 8)
) AS p(code, label, category, sort_order)
ON CONFLICT (app_id, code) DO NOTHING;

/* ============================================================
   10. Backfill: Migrate existing school_attendance to new model
   ============================================================ */
/* Create baseline registers from existing attendance data */
WITH base_registers AS (
    INSERT INTO school_attendance_register (app_id, academic_year_id, section_id, register_date, state, version, created_by)
    SELECT DISTINCT
        a.app_id,
        ay.id AS academic_year_id,
        s.section_id,
        a.attendance_date,
        'finalized' AS state,
        1 AS version,
        'system_migration_30' AS created_by
    FROM school_attendance a
    JOIN school_students s ON s.id = a.student_id AND s.app_id = a.app_id
    JOIN school_student_enrollments e ON e.student_id = s.id AND e.app_id = a.app_id
        AND e.section_id IS NOT NULL
    JOIN school_academic_years ay ON ay.id = e.academic_year_id AND ay.app_id = a.app_id
    ON CONFLICT (app_id, academic_year_id, section_id, register_date, COALESCE(session_id, 0)) DO NOTHING
    RETURNING id, app_id, academic_year_id, section_id, register_date
),
migrated_entries AS (
    INSERT INTO school_attendance_entry (app_id, register_id, student_id, policy_id, late_minutes, partial_minutes, remark, marked_by)
    SELECT 
        a.app_id,
        br.id AS register_id,
        a.student_id,
        p.id AS policy_id,
        0 AS late_minutes,
        0 AS partial_minutes,
        a.remarks AS remark,
        a.marked_by
    FROM school_attendance a
    JOIN school_students s ON s.id = a.student_id AND s.app_id = a.app_id
    JOIN school_student_enrollments e ON e.student_id = s.id AND e.app_id = a.app_id
        AND e.section_id IS NOT NULL
    JOIN school_academic_years ay ON ay.id = e.academic_year_id AND ay.app_id = a.app_id
    JOIN base_registers br ON br.app_id = a.app_id AND br.section_id = e.section_id AND br.register_date = a.attendance_date
    JOIN school_attendance_policy p ON p.app_id = a.app_id AND p.code = CASE 
        WHEN a.status = 'P' THEN 'P'
        WHEN a.status = 'A' THEN 'A'
        WHEN a.status = 'L' THEN 'L'
        ELSE 'P'
    END
    WHERE NOT EXISTS (
        SELECT 1 FROM school_attendance_entry ee
        WHERE ee.app_id = a.app_id AND ee.student_id = a.student_id AND ee.register_id = br.id
    )
)
SELECT 1;

/* ============================================================
   11. Default Attendance Settings
   ============================================================ */
INSERT INTO school_attendance_settings (app_id, campus_id, default_session_type, late_threshold_minutes, partial_threshold_minutes)
SELECT c.app_id, c.id, 'daily', 15, 120
FROM school_campuses c
ON CONFLICT (app_id, campus_id) DO NOTHING;

COMMIT;