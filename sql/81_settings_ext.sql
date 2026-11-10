-- ============================================================
-- Settings Extension — Users, Integrations, Subscription
-- ============================================================

-- Users table (extends the base tblHO_User with school-specific fields)
CREATE TABLE IF NOT EXISTS school_users (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  user_id           TEXT NOT NULL,                    -- links to tblHO_User.UserId
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  avatar_url        TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login        TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_school_users_app ON school_users (app_id) WHERE deleted_at IS NULL;

-- User Roles junction table
CREATE TABLE IF NOT EXISTS school_user_roles (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  user_id           INT NOT NULL REFERENCES school_users(id) ON DELETE CASCADE,
  role_id           INT NOT NULL REFERENCES school_roles(id) ON DELETE CASCADE,
  campus_id         INT,                              -- optional campus scope
  assigned_by       TEXT,
  assigned_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, user_id, role_id, campus_id)
);

CREATE INDEX IF NOT EXISTS idx_school_user_roles_user ON school_user_roles (app_id, user_id);
CREATE INDEX IF NOT EXISTS idx_school_user_roles_role ON school_user_roles (app_id, role_id);

-- Integrations table
CREATE TABLE IF NOT EXISTS school_integrations (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  type              TEXT NOT NULL,                    -- 'sms', 'email', 'push', 'payment', 'sso', 'webhook'
  name              TEXT NOT NULL,
  config            JSONB NOT NULL DEFAULT '{}',      -- provider-specific config
  is_active         BOOLEAN DEFAULT false,
  is_test_mode      BOOLEAN DEFAULT false,
  last_tested_at    TIMESTAMPTZ,
  test_status       TEXT,                             -- 'success', 'failed'
  test_message      TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (app_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_school_integrations_app ON school_integrations (app_id) WHERE deleted_at IS NULL;

-- Subscription table
CREATE TABLE IF NOT EXISTS school_subscription (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  plan_name         TEXT NOT NULL,
  plan_code         TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired', 'cancelled', 'suspended')),
  billing_cycle     TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  price             NUMERIC(12,2) DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'INR',
  max_students      INT,
  max_staff         INT,
  max_campuses      INT,
  features          JSONB DEFAULT '[]',               -- list of enabled features
  started_at        TIMESTAMPTZ DEFAULT now(),
  expires_at        TIMESTAMPTZ,
  renewal_date      TIMESTAMPTZ,
  payment_method    TEXT,
  payment_reference TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_subscription_app ON school_subscription (app_id);

-- Seed default integrations (inactive, user must configure)
INSERT INTO school_integrations (app_id, type, name, config, is_active, is_test_mode, created_by)
VALUES
  ('default', 'sms', 'Twilio SMS', '{"account_sid": "", "auth_token": "", "from_number": ""}', false, true, 'SYSTEM'),
  ('default', 'sms', 'MSG91', '{"auth_key": "", "sender_id": "", "route": "4"}', false, true, 'SYSTEM'),
  ('default', 'email', 'SendGrid', '{"api_key": "", "from_email": "", "from_name": ""}', false, true, 'SYSTEM'),
  ('default', 'email', 'SMTP', '{"host": "", "port": 587, "username": "", "password": "", "from_email": "", "from_name": "", "secure": false}', false, true, 'SYSTEM'),
  ('default', 'push', 'Firebase FCM', '{"server_key": "", "project_id": ""}', false, true, 'SYSTEM'),
  ('default', 'payment', 'Razorpay', '{"key_id": "", "key_secret": "", "webhook_secret": ""}', false, true, 'SYSTEM'),
  ('default', 'payment', 'Stripe', '{"secret_key": "", "publishable_key": "", "webhook_secret": ""}', false, true, 'SYSTEM'),
  ('default', 'sso', 'Google OAuth', '{"client_id": "", "client_secret": "", "redirect_uri": ""}', false, true, 'SYSTEM'),
  ('default', 'sso', 'Microsoft OAuth', '{"client_id": "", "client_secret": "", "tenant_id": "", "redirect_uri": ""}', false, true, 'SYSTEM'),
  ('default', 'webhook', 'Generic Webhook', '{"url": "", "secret": "", "events": []}', false, true, 'SYSTEM')
ON CONFLICT (app_id, type, name) DO NOTHING;

-- Seed default subscription (free trial)
INSERT INTO school_subscription (app_id, plan_name, plan_code, status, billing_cycle, price, currency, features, created_by)
VALUES
  ('default', 'Free Trial', 'trial', 'trial', 'monthly', 0, 'INR', '["basic_student_mgmt", "basic_attendance", "basic_fees"]', 'SYSTEM')
ON CONFLICT DO NOTHING;