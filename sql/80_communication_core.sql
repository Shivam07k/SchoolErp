-- ============================================================
-- Communication — Core Schema (Step 1–3)
-- Migration: sql/90_communication_core.sql, sql/91_communication_logs.sql
-- ============================================================
-- Creates templates, providers, settings, messages, recipients,
-- SMS logs, email logs, notice board, notice attachments,
-- notice reads, and app notifications.
-- Safe to re-run: every object is IF NOT EXISTS.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Templates, Providers & Settings (Step 1)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_communication_template (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'notice')),
  subject           TEXT,
  body_text         TEXT,
  body_html         TEXT,
  variables         JSONB DEFAULT '[]'::jsonb,
  language          TEXT NOT NULL DEFAULT 'en',
  is_active         BOOLEAN DEFAULT true,
  description       TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_template_code ON school_communication_template(app_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comm_template_channel ON school_communication_template(app_id, channel, is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_communication_provider (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('twilio', 'msg91', 'gupshup', 'sendgrid', 'mailgun', 'ses', 'postmark', 'firebase', 'onesignal', 'expo', 'custom')),
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push')),
  priority          INT DEFAULT 10,
  is_active         BOOLEAN DEFAULT true,
  is_default        BOOLEAN DEFAULT false,
  rate_limit_per_min INT,
  rate_limit_per_day INT,
  supports_webhook  BOOLEAN DEFAULT false,
  webhook_secret    TEXT,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_provider_code ON school_communication_provider(app_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comm_provider_channel ON school_communication_provider(app_id, channel, is_active, priority) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_communication_setting (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  setting_key       TEXT NOT NULL,
  setting_value     JSONB NOT NULL,
  description       TEXT,
  is_editable       BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, setting_key)
);

-- Default settings
INSERT INTO school_communication_setting (app_id, setting_key, setting_value, description)
VALUES
  ('default', 'default_sms_from', '"SCHOOL"', 'Default SMS sender ID'),
  ('default', 'default_email_from', '"noreply@school.edu"', 'Default email from address'),
  ('default', 'default_email_from_name', '"School ERP"', 'Default email from name'),
  ('default', 'sms_rate_limit_per_min', '30', 'Max SMS per minute per provider'),
  ('default', 'email_rate_limit_per_min', '60', 'Max emails per minute per provider'),
  ('default', 'push_rate_limit_per_min', '100', 'Max push per minute per provider'),
  ('default', 'retry_max_attempts', '3', 'Max retry attempts for failed sends'),
  ('default', 'retry_delay_minutes', '5', 'Delay between retries in minutes'),
  ('default', 'opt_out_keyword', '"STOP"', 'SMS opt-out keyword'),
  ('default', 'log_retention_days_sms', '365', 'SMS log retention days'),
  ('default', 'log_retention_days_email', '365', 'Email log retention days'),
  ('default', 'log_retention_days_push', '90', 'Push log retention days'),
  ('default', 'log_retention_days_notice_read', '730', 'Notice read retention days')
ON CONFLICT (app_id, setting_key) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Message Queue & Recipients (Step 2)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_communication_message (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  message_id        TEXT NOT NULL,
  template_id       INT REFERENCES school_communication_template(id) ON DELETE SET NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'notice')),
  subject           TEXT,
  body_text         TEXT,
  body_html         TEXT,
  recipient_count   INT DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'partial', 'failed', 'cancelled')),
  scheduled_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_summary     TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_message_id ON school_communication_message(app_id, message_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comm_message_status ON school_communication_message(app_id, status, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comm_message_template ON school_communication_message(app_id, template_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_communication_recipient (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  message_id            INT NOT NULL REFERENCES school_communication_message(id) ON DELETE CASCADE,
  recipient_type        TEXT NOT NULL CHECK (recipient_type IN ('student', 'parent', 'staff', 'custom')),
  recipient_id          INT,
  contact_value         TEXT NOT NULL,
  contact_verified      BOOLEAN DEFAULT false,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'opted_out', 'cancelled')),
  provider_id           INT REFERENCES school_communication_provider(id) ON DELETE SET NULL,
  provider_message_id   TEXT,
  error_code            TEXT,
  error_message         TEXT,
  sent_at               TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  read_at               TIMESTAMPTZ,
  clicked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_recipient_message ON school_communication_recipient(app_id, message_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_recipient_contact ON school_communication_recipient(app_id, recipient_type, recipient_id, contact_value);
CREATE INDEX IF NOT EXISTS idx_comm_recipient_provider_msg ON school_communication_recipient(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. SMS & Email Logs (Step 2)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_sms_log (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  message_id            INT REFERENCES school_communication_message(id) ON DELETE SET NULL,
  recipient_id          INT REFERENCES school_communication_recipient(id) ON DELETE SET NULL,
  to_number             TEXT NOT NULL,
  from_number           TEXT,
  body                  TEXT NOT NULL,
  provider_id           INT REFERENCES school_communication_provider(id) ON DELETE SET NULL,
  provider_name         TEXT,
  provider_message_id   TEXT,
  status                TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'undelivered', 'rejected')),
  segments              INT DEFAULT 1,
  cost                  NUMERIC(10,4) DEFAULT 0,
  currency              TEXT DEFAULT 'INR',
  error_code            TEXT,
  error_message         TEXT,
  sent_at               TIMESTAMPTZ DEFAULT now(),
  delivered_at          TIMESTAMPTZ,
  webhook_received_at   TIMESTAMPTZ,
  webhook_payload       JSONB
);
CREATE INDEX IF NOT EXISTS idx_sms_log_message ON school_sms_log(app_id, message_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_recipient ON school_sms_log(app_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_provider_msg ON school_sms_log(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_log_status ON school_sms_log(app_id, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_to_number ON school_sms_log(app_id, to_number, sent_at DESC);

CREATE TABLE IF NOT EXISTS school_email_log (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  message_id            INT REFERENCES school_communication_message(id) ON DELETE SET NULL,
  recipient_id          INT REFERENCES school_communication_recipient(id) ON DELETE SET NULL,
  to_email              TEXT NOT NULL,
  from_email            TEXT NOT NULL,
  from_name             TEXT,
  subject               TEXT,
  body_text             TEXT,
  body_html             TEXT,
  provider_id           INT REFERENCES school_communication_provider(id) ON DELETE SET NULL,
  provider_name         TEXT,
  provider_message_id   TEXT,
  status                TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'rejected')),
  error_code            TEXT,
  error_message         TEXT,
  sent_at               TIMESTAMPTZ DEFAULT now(),
  delivered_at          TIMESTAMPTZ,
  opened_at             TIMESTAMPTZ,
  clicked_at            TIMESTAMPTZ,
  bounced_at            TIMESTAMPTZ,
  complained_at         TIMESTAMPTZ,
  webhook_received_at   TIMESTAMPTZ,
  webhook_payload       JSONB
);
CREATE INDEX IF NOT EXISTS idx_email_log_message ON school_email_log(app_id, message_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON school_email_log(app_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_log_provider_msg ON school_email_log(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_log_status ON school_email_log(app_id, status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_to_email ON school_email_log(app_id, to_email, sent_at DESC);

-- ------------------------------------------------------------
-- 4. Notice Board (Step 3)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_notice_board (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  notice_id         TEXT NOT NULL,
  title             TEXT NOT NULL,
  body_html         TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  audience          TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'students', 'parents', 'staff', 'class', 'section', 'custom')),
  target_ids        JSONB DEFAULT '[]'::jsonb,
  publish_at        TIMESTAMPTZ,
  expire_at         TIMESTAMPTZ,
  is_pinned         BOOLEAN DEFAULT false,
  is_published      BOOLEAN DEFAULT false,
  published_at      TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_notice_id ON school_notice_board(app_id, notice_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notice_published ON school_notice_board(app_id, is_published, publish_at DESC, is_pinned DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notice_audience ON school_notice_board(app_id, audience, is_published) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_notice_attachment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  notice_id         INT NOT NULL REFERENCES school_notice_board(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  file_size         BIGINT DEFAULT 0,
  mime_type         TEXT,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notice_attachment_notice ON school_notice_attachment(app_id, notice_id);

CREATE TABLE IF NOT EXISTS school_notice_read (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  notice_id         INT NOT NULL REFERENCES school_notice_board(id) ON DELETE CASCADE,
  user_type         TEXT NOT NULL CHECK (user_type IN ('student', 'parent', 'staff')),
  user_id           INT NOT NULL,
  read_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE (notice_id, user_type, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notice_read_notice ON school_notice_read(app_id, notice_id, read_at DESC);
CREATE INDEX IF NOT EXISTS idx_notice_read_user ON school_notice_read(app_id, user_type, user_id, read_at DESC);

-- ------------------------------------------------------------
-- 5. App Notifications (Step 3)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_app_notification (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  notification_id   TEXT NOT NULL,
  user_type         TEXT NOT NULL CHECK (user_type IN ('student', 'parent', 'staff')),
  user_id           INT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  data_json         JSONB DEFAULT '{}'::jsonb,
  channel           TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'in_app')),
  priority          TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read', 'clicked')),
  provider_id       INT REFERENCES school_communication_provider(id) ON DELETE SET NULL,
  provider_message_id TEXT,
  error_code        TEXT,
  error_message     TEXT,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  clicked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_notification_id ON school_app_notification(app_id, notification_id) WHERE user_type = 'staff' OR user_type = 'parent' OR user_type = 'student';
CREATE INDEX IF NOT EXISTS idx_app_notification_user ON school_app_notification(app_id, user_type, user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notification_provider_msg ON school_app_notification(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ------------------------------------------------------------
-- 6. Automation Rules (Step 4)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_communication_automation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  trigger_event     TEXT NOT NULL,
  template_id       INT NOT NULL REFERENCES school_communication_template(id) ON DELETE RESTRICT,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'notice')),
  filter_json       JSONB DEFAULT '{}'::jsonb,
  is_active         BOOLEAN DEFAULT true,
  last_run_at       TIMESTAMPTZ,
  last_run_count    INT DEFAULT 0,
  last_run_status   TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_automation_code ON school_communication_automation(app_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_comm_automation_trigger ON school_communication_automation(app_id, trigger_event, is_active) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 7. Opt-out List (Cross-cutting)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS school_communication_opt_out (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'push')),
  contact_value     TEXT NOT NULL,
  reason            TEXT,
  opted_out_at      TIMESTAMPTZ DEFAULT now(),
  opted_out_by      TEXT,
  UNIQUE (app_id, channel, contact_value)
);
CREATE INDEX IF NOT EXISTS idx_opt_out_contact ON school_communication_opt_out(app_id, channel, contact_value);

COMMIT;