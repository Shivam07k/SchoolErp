-- ============================================================
-- Reports & Analytics — Core Schema (Step 1)
-- Creates tables for saved reports, schedules, executions, dashboard widgets
-- ============================================================

-- Report Templates (saved custom reports)
CREATE TABLE IF NOT EXISTS school_analytics_template (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT NOT NULL CHECK (category IN ('student', 'attendance', 'fees', 'exam', 'custom')),
  data_source       TEXT NOT NULL,                    -- 'students', 'attendance', 'fees', 'exams', 'custom_sql'
  query_config      JSONB NOT NULL DEFAULT '{}',      -- columns, filters, grouping, sorting
  ui_config         JSONB NOT NULL DEFAULT '{}',      -- chart type, display options
  is_system         BOOLEAN DEFAULT false,            -- system templates cannot be deleted
  is_active         BOOLEAN DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_analytics_template_app ON school_analytics_template (app_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_school_analytics_template_cat ON school_analytics_template (app_id, category) WHERE deleted_at IS NULL;

-- Report Schedules (automated runs)
CREATE TABLE IF NOT EXISTS school_analytics_schedule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  template_id       INT NOT NULL REFERENCES school_analytics_template(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  cron_expression   TEXT NOT NULL,                    -- e.g., '0 8 * * 1' (weekly Monday 8AM)
  timezone          TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  parameters        JSONB DEFAULT '{}',               -- runtime parameters
  recipients        JSONB DEFAULT '[]',               -- [{type: 'email', value: '...'}, {type: 'user', value: 123}]
  format            TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx', 'pdf')),
  is_active         BOOLEAN DEFAULT true,
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_analytics_schedule_app ON school_analytics_schedule (app_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_school_analytics_schedule_next ON school_analytics_schedule (next_run_at) WHERE is_active;

-- Report Executions (history of runs)
CREATE TABLE IF NOT EXISTS school_analytics_execution (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  template_id       INT REFERENCES school_analytics_template(id) ON DELETE SET NULL,
  schedule_id       INT REFERENCES school_analytics_schedule(id) ON DELETE SET NULL,
  triggered_by      TEXT NOT NULL,                    -- 'manual', 'schedule', 'api'
  triggered_by_id   TEXT,                             -- user id or 'system'
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  parameters        JSONB DEFAULT '{}',
  row_count         INT DEFAULT 0,
  file_id           INT,                              -- reference to school_uploads if file stored
  file_name         TEXT,
  file_size         BIGINT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_school_analytics_execution_app ON school_analytics_execution (app_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_analytics_execution_template ON school_analytics_execution (template_id, started_at DESC);

-- Dashboard Widgets (per-user pinned report widgets)
CREATE TABLE IF NOT EXISTS school_analytics_widget (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  user_id           TEXT NOT NULL,
  template_id       INT REFERENCES school_analytics_template(id) ON DELETE CASCADE,
  title             TEXT,
  position          INT DEFAULT 0,
  width             INT DEFAULT 6,                    -- 1-12 grid columns
  height            INT DEFAULT 4,                    -- row units
  config            JSONB DEFAULT '{}',               -- widget-specific config
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_analytics_widget_user ON school_analytics_widget (app_id, user_id) WHERE is_active;

-- ============================================================
-- Helper Views for Common Reports (matching actual schema)
-- ============================================================

-- Student summary view (enrollment + demographics)
CREATE OR REPLACE VIEW school_v_student_summary AS
SELECT
  s.id,
  s.admission_no,
  s.first_name,
  s.last_name,
  s.gender,
  s.dob,
  s.category,
  s.religion,
  s.blood_group,
  s.status,
  s.admission_date,
  s.class_id,
  c.name AS class_name,
  s.section_id,
  sec.name AS section_name,
  s.roll_no,
  s.transport_required,
  s.hostel_required,
  s.campus_id
FROM school_students s
LEFT JOIN school_classes c ON c.id = s.class_id
LEFT JOIN school_sections sec ON sec.id = s.section_id
WHERE s.deleted_at IS NULL;

-- Attendance summary view
CREATE OR REPLACE VIEW school_v_attendance_summary AS
SELECT
  ae.student_id,
  ar.register_date AS date,
  ar.section_id,
  sec.name AS section_name,
  sec.class_id,
  c.name AS class_name,
  ap.code AS status_code,
  ap.category AS status_category,
  ae.late_minutes,
  ae.remark
FROM school_attendance_entry ae
JOIN school_attendance_register ar ON ar.id = ae.register_id AND ar.cancelled_at IS NULL
JOIN school_sections sec ON sec.id = ar.section_id
JOIN school_classes c ON c.id = sec.class_id
JOIN school_attendance_policy ap ON ap.id = ae.policy_id;

-- Fee summary view (using actual tables - simplified)
CREATE OR REPLACE VIEW school_v_fee_summary AS
SELECT
  fi.id AS invoice_id,
  fi.title AS invoice_no,
  fi.student_id,
  s.admission_no,
  s.first_name,
  s.last_name,
  s.class_id,
  c.name AS class_name,
  s.section_id,
  sec.name AS section_name,
  NULL::int AS fee_head_id,
  NULL::text AS fee_head_name,
  fi.amount,
  fi.paid_amount,
  (fi.amount - fi.paid_amount) AS balance,
  fi.due_date,
  fi.created_at AS invoice_date,
  fi.status,
  CASE
    WHEN fi.status = 'paid' THEN 'paid'
    WHEN fi.due_date < CURRENT_DATE AND fi.status != 'paid' THEN 'overdue'
    WHEN fi.due_date <= CURRENT_DATE + 7 AND fi.status != 'paid' THEN 'due_soon'
    ELSE 'pending'
  END AS dues_status,
  GREATEST(CURRENT_DATE - fi.due_date, 0) AS days_overdue
FROM school_fee_invoices fi
JOIN school_students s ON s.id = fi.student_id AND s.deleted_at IS NULL
LEFT JOIN school_classes c ON c.id = s.class_id
LEFT JOIN school_sections sec ON sec.id = s.section_id;

-- Exam summary view (using marks and exam tables)
CREATE OR REPLACE VIEW school_v_exam_summary AS
SELECT
  m.id AS result_id,
  m.student_id,
  s.admission_no,
  s.first_name,
  s.last_name,
  s.class_id,
  c.name AS class_name,
  s.section_id,
  sec.name AS section_name,
  e.id AS term_id,
  e.name AS term_name,
  m.marks_obtained,
  m.max_marks,
  CASE WHEN m.max_marks > 0 THEN round((m.marks_obtained::numeric / m.max_marks) * 100, 2) ELSE 0 END AS percentage,
  '' AS grade,
  NULL AS rank_class,
  NULL AS rank_section,
  'completed' AS status,
  m.entered_at AS published_at
FROM school_marks m
JOIN school_students s ON s.id = m.student_id AND s.deleted_at IS NULL
JOIN school_exam e ON e.id = m.exam_id AND e.deleted_at IS NULL
LEFT JOIN school_classes c ON c.id = s.class_id
LEFT JOIN school_sections sec ON sec.id = s.section_id;

-- ============================================================
-- Seed System Templates
-- ============================================================

INSERT INTO school_analytics_template (app_id, code, name, description, category, data_source, query_config, ui_config, is_system, created_by)
VALUES
  ('default', 'student_enrollment', 'Student Enrollment Summary', 'Enrollment by class, section, gender, category', 'student', 'students',
   '{"columns":["class_name","section_name","gender","category","count"],"groupBy":["class_name","section_name","gender","category"],"filters":{}}',
   '{"chartType":"bar","xAxis":"class_name","yAxis":"count","series":"gender"}', true, 'SYSTEM'),
  ('default', 'attendance_daily', 'Daily Attendance Summary', 'Present/Absent/Late by date and class', 'attendance', 'attendance',
   '{"columns":["date","class_name","section_name","status_category","count"],"groupBy":["date","class_name","section_name","status_category"],"filters":{}}',
   '{"chartType":"stackedBar","xAxis":"date","yAxis":"count","series":"status_category"}', true, 'SYSTEM'),
  ('default', 'fees_collection', 'Fee Collection Report', 'Daily/Monthly collection by fee head and payment mode', 'fees', 'fees',
   '{"columns":["invoice_date","sum_amount"],"groupBy":["invoice_date"],"filters":{}}',
   '{"chartType":"line","xAxis":"invoice_date","yAxis":"sum_amount"}', true, 'SYSTEM'),
  ('default', 'exam_results', 'Exam Results Summary', 'Pass/Fail, averages, rankings by term and class', 'exam', 'exams',
   '{"columns":["term_name","class_name","count","avg_percentage"],"groupBy":["term_name","class_name"],"filters":{}}',
   '{"chartType":"groupedBar","xAxis":"class_name","yAxis":"avg_percentage","series":"term_name"}', true, 'SYSTEM')
ON CONFLICT (app_id, code) DO NOTHING;