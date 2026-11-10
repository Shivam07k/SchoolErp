-- ============================================================
-- Front Office — Core Schema
-- Migration: sql/80_frontoffice_core.sql
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS school_frontoffice_contact (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  relation TEXT,
  address TEXT,
  notes TEXT,
  blacklist_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_frontoffice_contact_phone ON school_frontoffice_contact(app_id, phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_frontoffice_enquiry_source (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_enquiry (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  contact_id INT REFERENCES school_frontoffice_contact(id) ON DELETE SET NULL,
  child_name TEXT,
  class_sought TEXT,
  source_id INT REFERENCES school_frontoffice_enquiry_source(id),
  stage TEXT NOT NULL DEFAULT 'New' CHECK (stage IN ('New','Contacted','Visit Scheduled','Visited','Applied','Admitted','Lost')),
  owner TEXT,
  next_follow_up_date DATE,
  outcome TEXT,
  lost_reason TEXT,
  admission_id INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_frontoffice_enquiry_stage ON school_frontoffice_enquiry(app_id, stage, next_follow_up_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_frontoffice_followup (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  enquiry_id INT REFERENCES school_frontoffice_enquiry(id) ON DELETE CASCADE,
  follow_up_date DATE,
  mode TEXT,
  note TEXT,
  next_date DATE,
  done_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_visit (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  contact_id INT REFERENCES school_frontoffice_contact(id),
  purpose TEXT,
  host_user TEXT,
  expected BOOLEAN DEFAULT false,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  pass_number TEXT,
  id_type TEXT,
  photo TEXT,
  items_carried TEXT,
  status TEXT DEFAULT 'expected' CHECK (status IN ('expected','checked_in','checked_out','denied')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_preapproval (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  visitor_name TEXT,
  host_user TEXT,
  date_window_start TIMESTAMPTZ,
  date_window_end TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_gatepass (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  student_id INT,
  date DATE,
  time TIMESTAMPTZ,
  reason TEXT,
  taken_by_person_id INT,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_authorised_person (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  student_id INT,
  name TEXT,
  relation TEXT,
  phone TEXT,
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_blacklist (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  contact_id INT REFERENCES school_frontoffice_contact(id),
  reason TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_complaint_category (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  default_owner TEXT,
  due_days INT DEFAULT 3
);

CREATE TABLE IF NOT EXISTS school_frontoffice_complaint (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  contact_id INT REFERENCES school_frontoffice_contact(id),
  student_id INT,
  category_id INT REFERENCES school_frontoffice_complaint_category(id),
  priority TEXT DEFAULT 'medium',
  description TEXT,
  channel TEXT,
  owner TEXT,
  due_date DATE,
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open','Assigned','In Progress','Resolved','Closed','Reopened')),
  confidential BOOLEAN DEFAULT false,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_complaint_action (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  complaint_id INT REFERENCES school_frontoffice_complaint(id) ON DELETE CASCADE,
  action_date TIMESTAMPTZ DEFAULT now(),
  action TEXT,
  by_user TEXT,
  note TEXT,
  attachment TEXT
);

CREATE TABLE IF NOT EXISTS school_frontoffice_escalation (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  complaint_id INT REFERENCES school_frontoffice_complaint(id) ON DELETE CASCADE,
  from_user TEXT,
  to_user TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  reason TEXT
);

CREATE TABLE IF NOT EXISTS school_frontoffice_call_log (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  direction TEXT CHECK (direction IN ('in','out')),
  contact_id INT REFERENCES school_frontoffice_contact(id),
  number TEXT,
  call_time TIMESTAMPTZ DEFAULT now(),
  duration INT,
  purpose TEXT,
  handled_by TEXT,
  outcome TEXT,
  linked_enquiry_id INT REFERENCES school_frontoffice_enquiry(id),
  linked_complaint_id INT REFERENCES school_frontoffice_complaint(id),
  linked_appointment_id INT
);

CREATE TABLE IF NOT EXISTS school_frontoffice_host_availability (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  host_user TEXT,
  weekday INT CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME,
  end_time TIME,
  slot_length INT DEFAULT 30,
  break_start TIME,
  break_end TIME
);

CREATE TABLE IF NOT EXISTS school_frontoffice_appointment_block (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  host_user TEXT,
  block_date DATE,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS school_frontoffice_appointment (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  contact_id INT REFERENCES school_frontoffice_contact(id),
  student_id INT,
  host_user TEXT,
  purpose TEXT,
  appointment_date DATE,
  slot_time TIME,
  status TEXT DEFAULT 'Requested' CHECK (status IN ('Requested','Confirmed','Done','Cancelled','No-show')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_setting (
  app_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  PRIMARY KEY (app_id, key)
);

CREATE TABLE IF NOT EXISTS school_frontoffice_notification (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  kind TEXT,
  contact_id INT,
  enquiry_id INT,
  recipient TEXT,
  title TEXT,
  message TEXT,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_frontoffice_audit (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT,
  action TEXT,
  entity TEXT,
  entity_id INT,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMIT;
