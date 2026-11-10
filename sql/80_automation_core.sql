-- ============================================================
-- Automation Center — Core Schema (Step 1)
-- Rules, templates, providers, schedules, execution logs
-- ============================================================

-- Automation Rules
CREATE TABLE IF NOT EXISTS school_automation_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  event_type        TEXT NOT NULL,                    -- trigger type
  event_config      JSONB DEFAULT '{}',               -- trigger-specific config
  conditions        JSONB DEFAULT '{}',               -- filter conditions
  channels          TEXT[] NOT NULL DEFAULT '{}',     -- ['sms','email','push','in_app','webhook']
  templates         JSONB DEFAULT '{}',               -- per-channel template IDs or inline content
  is_active         BOOLEAN DEFAULT true,
  schedule_cron     TEXT,                             -- optional cron for scheduled rules
  schedule_timezone TEXT DEFAULT 'Asia/Kolkata',
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  run_count         INT DEFAULT 0,
  success_count     INT DEFAULT 0,
  failure_count     INT DEFAULT 0,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_automation_rule_app ON school_automation_rule (app_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_school_automation_rule_active ON school_automation_rule (app_id, is_active) WHERE deleted_at IS NULL AND is_active;
CREATE INDEX IF NOT EXISTS idx_school_automation_rule_next ON school_automation_rule (next_run_at) WHERE is_active AND schedule_cron IS NOT NULL;

-- Automation Templates (for rules - separate from communication templates)
CREATE TABLE IF NOT EXISTS school_automation_template (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'in_app', 'webhook')),
  subject           TEXT,                             -- for email/push
  body_text         TEXT,                             -- for sms/email/push/in_app
  body_html         TEXT,                             -- for email
  variables         JSONB DEFAULT '[]',               -- available variables
  webhook_url       TEXT,                             -- for webhook channel
  webhook_method    TEXT DEFAULT 'POST',
  webhook_headers   JSONB DEFAULT '{}',
  is_system         BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_automation_template_app ON school_automation_template (app_id, channel) WHERE deleted_at IS NULL;

-- Channel Providers (SMS/Email/Push gateways)
CREATE TABLE IF NOT EXISTS school_automation_provider (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push')),
  provider_type     TEXT NOT NULL,                    -- 'twilio', 'sendgrid', 'fcm', 'custom', etc.
  config            JSONB NOT NULL DEFAULT '{}',      -- provider-specific credentials/config
  is_default        BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  is_test_mode      BOOLEAN DEFAULT false,
  last_tested_at    TIMESTAMPTZ,
  test_status       TEXT,                             -- 'success', 'failed', 'pending'
  test_message      TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_automation_provider_app ON school_automation_provider (app_id, channel) WHERE deleted_at IS NULL;

-- Automation Runs (execution history)
CREATE TABLE IF NOT EXISTS school_automation_run (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  rule_id           INT REFERENCES school_automation_rule(id) ON DELETE SET NULL,
  trigger_type      TEXT NOT NULL,                    -- 'manual', 'schedule', 'event'
  trigger_ref       TEXT,                             -- event reference (e.g., invoice_id, student_id)
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'partial', 'failed')),
  total_actions     INT DEFAULT 0,
  success_actions   INT DEFAULT 0,
  failed_actions    INT DEFAULT 0,
  error_summary     TEXT,
  started_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  triggered_by      TEXT                              -- user id or 'system'
);

CREATE INDEX IF NOT EXISTS idx_school_automation_run_app ON school_automation_run (app_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_automation_run_rule ON school_automation_run (rule_id, started_at DESC);

-- Automation Logs (individual notification deliveries)
CREATE TABLE IF NOT EXISTS school_automation_log (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  run_id            INT NOT NULL REFERENCES school_automation_run(id) ON DELETE CASCADE,
  rule_id           INT REFERENCES school_automation_rule(id) ON DELETE SET NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'in_app', 'webhook')),
  provider_id       INT REFERENCES school_automation_provider(id) ON DELETE SET NULL,
  template_id       INT REFERENCES school_automation_template(id) ON DELETE SET NULL,
  recipient_type    TEXT NOT NULL,                    -- 'student', 'parent', 'staff', 'custom'
  recipient_id      TEXT,                             -- user/student ID or phone/email
  recipient_name    TEXT,
  subject           TEXT,
  body_text         TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  provider_msg_id   TEXT,
  error_message     TEXT,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_automation_log_app ON school_automation_log (app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_automation_log_run ON school_automation_log (run_id);

-- Seed System Templates
INSERT INTO school_automation_template (app_id, code, name, channel, subject, body_text, variables, is_system, created_by)
VALUES
  ('default', 'fee_due_soon_sms', 'Fee Due Soon - SMS', 'sms', NULL,
   'Dear {{parent_name}}, fee of {{amount}} for {{student_name}} is due on {{due_date}}. Please pay on time. - {{school_name}}',
   '["parent_name", "student_name", "amount", "due_date", "school_name"]', true, 'SYSTEM'),
  ('default', 'fee_overdue_sms', 'Fee Overdue - SMS', 'sms', NULL,
   'URGENT: Fee of {{amount}} for {{student_name}} was due on {{due_date}} ({{days_overdue}} days overdue). Pay now to avoid penalty. - {{school_name}}',
   '["parent_name", "student_name", "amount", "due_date", "days_overdue", "school_name"]', true, 'SYSTEM'),
  ('default', 'attendance_absent_sms', 'Student Absent - SMS', 'sms', NULL,
   'Dear {{parent_name}}, {{student_name}} ({{class_name}}) was absent on {{date}}. Please contact school if this is unexpected. - {{school_name}}',
   '["parent_name", "student_name", "class_name", "date", "school_name"]', true, 'SYSTEM'),
  ('default', 'fee_due_soon_email', 'Fee Due Soon - Email', 'email',
   'Fee Payment Reminder for {{student_name}}',
   'Dear {{parent_name}},\n\nThis is a reminder that the fee of ₹{{amount}} for {{student_name}} ({{class_name}}) is due on {{due_date}}.\n\nPlease make the payment at your earliest convenience.\n\nRegards,\n{{school_name}}',
   '["parent_name", "student_name", "class_name", "amount", "due_date", "school_name"]', true, 'SYSTEM'),
  ('default', 'attendance_absent_email', 'Student Absent - Email', 'email',
   'Attendance Alert: {{student_name}} Absent',
   'Dear {{parent_name}},\n\n{{student_name}} ({{class_name}}) was marked absent on {{date}}.\n\nIf this is an error, please contact the school office.\n\nRegards,\n{{school_name}}',
   '["parent_name", "student_name", "class_name", "date", "school_name"]', true, 'SYSTEM')
ON CONFLICT (app_id, code) DO NOTHING;

-- Seed default providers (empty configs - user must configure)
INSERT INTO school_automation_provider (app_id, code, name, channel, provider_type, config, is_default, is_active, created_by)
VALUES
  ('default', 'sms_twilio', 'Twilio SMS', 'sms', 'twilio', '{"account_sid": "", "auth_token": "", "from_number": ""}', true, false, 'SYSTEM'),
  ('default', 'email_sendgrid', 'SendGrid Email', 'email', 'sendgrid', '{"api_key": "", "from_email": "", "from_name": ""}', true, false, 'SYSTEM'),
  ('default', 'push_fcm', 'Firebase FCM', 'push', 'fcm', '{"server_key": "", "project_id": ""}', true, false, 'SYSTEM')
ON CONFLICT (app_id, code) DO NOTHING;