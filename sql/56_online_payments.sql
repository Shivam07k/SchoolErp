-- ============================================================
-- M16 Fees & Accounts — Step 7: Online Payments
-- ============================================================
-- Creates: school_gateway_config, school_payment_link,
--          school_gateway_webhook_log
-- ============================================================

BEGIN;

-- Gateway Configuration
CREATE TABLE IF NOT EXISTS school_gateway_config (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  is_test_mode      BOOLEAN DEFAULT true,
  api_key           TEXT,
  api_secret        TEXT,
  webhook_secret    TEXT,
  supported_modes   TEXT[] DEFAULT '{}',
  charges_borne_by  TEXT DEFAULT 'school' CHECK (charges_borne_by IN ('school', 'parent', 'split')),
  fixed_charge      NUMERIC(12,2) DEFAULT 0,
  percent_charge    NUMERIC(5,2) DEFAULT 0,
  min_charge        NUMERIC(12,2),
  max_charge        NUMERIC(12,2),
  success_url       TEXT,
  failure_url       TEXT,
  webhook_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gateway_active ON school_gateway_config(app_id, is_active) WHERE deleted_at IS NULL;

-- Payment Links
CREATE TABLE IF NOT EXISTS school_payment_link (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  gateway_id        INT REFERENCES school_gateway_config(id) ON DELETE SET NULL,
  invoice_id        INT REFERENCES school_invoice(id) ON DELETE SET NULL,
  amount            NUMERIC(12,2) NOT NULL,
  gateway_charge    NUMERIC(12,2) DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL,
  link_token        TEXT NOT NULL,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'expired', 'cancelled')),
  expires_at        TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  paid_receipt_id   INT REFERENCES school_receipt(id) ON DELETE SET NULL,
  sent_via          TEXT,
  sent_at           TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_link_token ON school_payment_link(app_id, link_token) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payment_link_student ON school_payment_link(student_id, status);

-- Gateway Webhook Log
CREATE TABLE IF NOT EXISTS school_gateway_webhook_log (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  gateway_id        INT REFERENCES school_gateway_config(id) ON DELETE SET NULL,
  event_type        TEXT,
  gateway_event_id  TEXT,
  payload           JSONB,
  processed         BOOLEAN DEFAULT false,
  processed_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_gateway_event ON school_gateway_webhook_log(gateway_id, gateway_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON school_gateway_webhook_log(processed);

COMMENT ON TABLE school_gateway_config IS 'Payment gateway configurations (Razorpay, Paytm, PhonePe, etc.)';
COMMENT ON TABLE school_payment_link IS 'Payment links sent to parents for online payment';
COMMENT ON TABLE school_gateway_webhook_log IS 'Webhook event log for debugging and idempotency';

COMMIT;