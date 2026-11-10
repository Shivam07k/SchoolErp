/* ============================================================
   School / College ERP - Phase 1 core schema
   Tenant scope: app_id (one PostgreSQL database per company in the
   current engine, so app_id also keeps the door open for shared DBs).
   Safe to re-run: every object is IF NOT EXISTS.
   ============================================================ */

CREATE TABLE IF NOT EXISTS school_academic_years (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  name        text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, name)
);

CREATE TABLE IF NOT EXISTS school_classes (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  name        text NOT NULL,
  stream      text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, name)
);

CREATE TABLE IF NOT EXISTS school_sections (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL DEFAULT 'default',
  class_id      integer NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  name          text NOT NULL,
  capacity      integer NOT NULL DEFAULT 40,
  class_teacher text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, class_id, name)
);

CREATE TABLE IF NOT EXISTS school_subjects (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  code        text,
  name        text NOT NULL,
  class_id    integer REFERENCES school_classes(id) ON DELETE SET NULL,
  max_marks   integer NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_students (
  id              serial PRIMARY KEY,
  app_id          text NOT NULL DEFAULT 'default',
  admission_no    text NOT NULL,
  first_name      text NOT NULL,
  last_name       text NOT NULL DEFAULT '',
  gender          text,
  dob             date,
  class_id        integer REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id      integer REFERENCES school_sections(id) ON DELETE SET NULL,
  roll_no         text,
  guardian_name   text,
  guardian_phone  text,
  guardian_email  text,
  address         text,
  admission_date  date NOT NULL DEFAULT current_date,
  status          text NOT NULL DEFAULT 'active',
  photo_url       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, admission_no)
);

CREATE TABLE IF NOT EXISTS school_attendance (
  id               serial PRIMARY KEY,
  app_id           text NOT NULL DEFAULT 'default',
  student_id       integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  attendance_date  date NOT NULL,
  status           text NOT NULL DEFAULT 'present',
  remarks          text,
  marked_by        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, student_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS school_fee_heads (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, name)
);

CREATE TABLE IF NOT EXISTS school_fee_invoices (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL DEFAULT 'default',
  student_id    integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  title         text NOT NULL,
  amount        numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount   numeric(12,2) NOT NULL DEFAULT 0,
  due_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'unpaid',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_fee_payments (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  invoice_id  integer NOT NULL REFERENCES school_fee_invoices(id) ON DELETE CASCADE,
  student_id  integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  method      text NOT NULL DEFAULT 'cash',
  reference   text,
  paid_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_automation_rules (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL DEFAULT 'default',
  code          text NOT NULL,
  name          text NOT NULL,
  event_type    text NOT NULL,
  channels      text NOT NULL DEFAULT 'whatsapp',
  enabled       boolean NOT NULL DEFAULT true,
  template      text NOT NULL,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, code)
);

CREATE TABLE IF NOT EXISTS school_notification_log (
  id          bigserial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  rule_code   text NOT NULL,
  student_id  integer REFERENCES school_students(id) ON DELETE SET NULL,
  invoice_id  integer REFERENCES school_fee_invoices(id) ON DELETE SET NULL,
  channel     text NOT NULL DEFAULT 'whatsapp',
  recipient   text,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'queued',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_students_app       ON school_students (app_id);
CREATE INDEX IF NOT EXISTS idx_school_students_class     ON school_students (app_id, class_id, section_id);
CREATE INDEX IF NOT EXISTS idx_school_attendance_date    ON school_attendance (app_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_school_attendance_student ON school_attendance (app_id, student_id);
CREATE INDEX IF NOT EXISTS idx_school_invoices_status    ON school_fee_invoices (app_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_school_invoices_student   ON school_fee_invoices (app_id, student_id);
CREATE INDEX IF NOT EXISTS idx_school_payments_invoice   ON school_fee_payments (app_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_school_notif_rule         ON school_notification_log (app_id, rule_code, created_at DESC);
