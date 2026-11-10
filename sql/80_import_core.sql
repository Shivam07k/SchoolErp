-- ============================================================
-- Import & Export — Core Schema (Step 1)
-- Jobs, templates, row results, history
-- ============================================================

-- Import Jobs
CREATE TABLE IF NOT EXISTS school_import_job (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  import_type       TEXT NOT NULL CHECK (import_type IN ('students', 'fees', 'attendance')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'validated', 'committing', 'completed', 'failed', 'cancelled')),
  file_name         TEXT,
  file_size         BIGINT,
  file_checksum     TEXT,
  total_rows        INT DEFAULT 0,
  valid_rows        INT DEFAULT 0,
  error_rows        INT DEFAULT 0,
  warning_rows      INT DEFAULT 0,
  committed_rows    INT DEFAULT 0,
  rollback_rows     INT DEFAULT 0,
  config            JSONB DEFAULT '{}',
  error_summary     TEXT,
  started_at        TIMESTAMPTZ,
  validated_at      TIMESTAMPTZ,
  committed_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_import_job_app ON school_import_job (app_id, created_at DESC) WHERE deleted_at IS NULL;

-- Import Row Results (per-row validation/commit results)
CREATE TABLE IF NOT EXISTS school_import_row (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  job_id            INT NOT NULL REFERENCES school_import_job(id) ON DELETE CASCADE,
  row_number        INT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'invalid', 'warning', 'committed', 'skipped', 'error')),
  raw_data          JSONB,                                  -- original row data
  validated_data    JSONB,                                  -- validated/transformed data
  errors            JSONB DEFAULT '[]',                     -- field-level errors
  warnings          JSONB DEFAULT '[]',                     -- field-level warnings
  entity_id         INT,                                    -- created/updated entity ID
  entity_type       TEXT,                                   -- 'student', 'fee_invoice', 'attendance_entry'
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_import_row_job ON school_import_row (job_id, row_number);
CREATE INDEX IF NOT EXISTS idx_school_import_row_status ON school_import_row (job_id, status);

-- Export Jobs
CREATE TABLE IF NOT EXISTS school_export_job (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  export_type       TEXT NOT NULL,                          -- data source identifier
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  format            TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx', 'pdf')),
  file_name         TEXT,
  file_size         BIGINT,
  row_count         INT DEFAULT 0,
  filters           JSONB DEFAULT '{}',
  columns           JSONB DEFAULT '[]',
  error_message     TEXT,
  started_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_export_job_app ON school_export_job (app_id, created_at DESC) WHERE deleted_at IS NULL;

-- Export Templates (saved export configurations)
CREATE TABLE IF NOT EXISTS school_export_template (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  export_type       TEXT NOT NULL,                          -- 'students', 'attendance', 'fees', 'exams', 'custom_sql'
  query_config      JSONB NOT NULL DEFAULT '{}',            -- columns, filters, sorting
  format            TEXT NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx', 'pdf')),
  is_system         BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_export_template_app ON school_export_template (app_id) WHERE deleted_at IS NULL;

-- Seed System Export Templates
INSERT INTO school_export_template (app_id, code, name, description, export_type, query_config, format, is_system, created_by)
VALUES
  ('default', 'students_full', 'All Students Export', 'Complete student list with all fields', 'students',
   '{"columns":["admission_no","first_name","last_name","gender","dob","class_name","section_name","roll_no","status","admission_date","guardian_name","guardian_phone","address"],"filters":{}}',
   'csv', true, 'SYSTEM'),
  ('default', 'attendance_daily', 'Daily Attendance Export', 'Attendance for a specific date', 'attendance',
   '{"columns":["date","class_name","section_name","admission_no","first_name","last_name","roll_no","status_code","late_minutes","remark"],"filters":{}}',
   'csv', true, 'SYSTEM'),
  ('default', 'fees_outstanding', 'Outstanding Fees Export', 'All unpaid/overdue invoices', 'fees',
   '{"columns":["invoice_no","admission_no","first_name","last_name","class_name","section_name","fee_head_name","amount","paid_amount","balance","due_date","status","days_overdue"],"filters":{"dues_status":["overdue","due_soon","pending"]}}',
   'csv', true, 'SYSTEM'),
  ('default', 'exam_results', 'Exam Results Export', 'Results for a term', 'exams',
   '{"columns":["term_name","class_name","section_name","admission_no","first_name","last_name","subject_name","marks_obtained","max_marks","percentage","grade"],"filters":{}}',
   'csv', true, 'SYSTEM')
ON CONFLICT (app_id, code) DO NOTHING;