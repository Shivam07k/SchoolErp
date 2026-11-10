-- ============================================================
-- M16 Fees & Accounts — Step 3: Dues & Follow-up
-- ============================================================
-- Creates: school_reminder_rule, school_reminder_log, school_follow_up,
--          school_payment_plan, school_payment_plan_installment,
--          school_block_policy, school_student_block
-- ============================================================

BEGIN;

-- Reminder Rules
CREATE TABLE IF NOT EXISTS school_reminder_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  trigger_type      TEXT NOT NULL CHECK (trigger_type IN ('before_due', 'after_due', 'custom')),
  days              INT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'app', 'letter')),
  template          TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reminder_rule_active ON school_reminder_rule(app_id, is_active) WHERE deleted_at IS NULL;

-- Reminder Log
CREATE TABLE IF NOT EXISTS school_reminder_log (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  rule_id           INT REFERENCES school_reminder_rule(id) ON DELETE SET NULL,
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL,
  sent_at           TIMESTAMPTZ DEFAULT now(),
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  error_message     TEXT,
  external_id       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminder_log_student ON school_reminder_log(student_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_reminder_log_rule ON school_reminder_log(rule_id);

-- Follow-ups
CREATE TABLE IF NOT EXISTS school_follow_up (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  by_user           TEXT NOT NULL,
  mode              TEXT CHECK (mode IN ('call', 'meeting', 'letter', 'email', 'whatsapp', 'visit')),
  note              TEXT,
  promise_date      DATE,
  promise_amount    NUMERIC(12,2),
  outcome           TEXT CHECK (outcome IN ('promised', 'partial_paid', 'no_response', 'disputed', 'escalated')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_follow_up_student_date ON school_follow_up(student_id, date);

-- Payment Plans
CREATE TABLE IF NOT EXISTS school_payment_plan (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  total_amount      NUMERIC(12,2) NOT NULL,
  installments      INT NOT NULL,
  amount_per_installment NUMERIC(12,2) NOT NULL,
  start_date        DATE NOT NULL,
  frequency         TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_plan_student ON school_payment_plan(student_id, status);

-- Payment Plan Installments
CREATE TABLE IF NOT EXISTS school_payment_plan_installment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  plan_id           INT REFERENCES school_payment_plan(id) ON DELETE CASCADE,
  installment_no    INT NOT NULL,
  due_date          DATE NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_installment ON school_payment_plan_installment(app_id, plan_id, installment_no) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plan_installment_plan ON school_payment_plan_installment(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_installment_due ON school_payment_plan_installment(due_date, status);

-- Block Policies
CREATE TABLE IF NOT EXISTS school_block_policy (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  trigger_type      TEXT NOT NULL CHECK (trigger_type IN ('days_overdue', 'amount_overdue', 'installments_overdue')),
  trigger_value     NUMERIC(12,2) NOT NULL,
  block_type        TEXT NOT NULL CHECK (block_type IN ('hall_ticket', 'report_card', 'transfer_certificate', 'results', 'all')),
  auto_lift         BOOLEAN DEFAULT true,
  message           TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Student Blocks
CREATE TABLE IF NOT EXISTS school_student_block (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  policy_id         INT REFERENCES school_block_policy(id) ON DELETE CASCADE,
  blocked_at        TIMESTAMPTZ DEFAULT now(),
  lifted_at         TIMESTAMPTZ,
  lifted_by         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_block_policy ON school_student_block(app_id, student_id, policy_id) WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_block_student ON school_student_block(student_id, lifted_at);

COMMENT ON TABLE school_reminder_rule IS 'Reminder trigger rules (before/after due, channel, template)';
COMMENT ON TABLE school_reminder_log IS 'Log of sent reminders with delivery status';
COMMENT ON TABLE school_follow_up IS 'Manual follow-ups with promise dates';
COMMENT ON TABLE school_payment_plan IS 'Installment payment plans for defaulters';
COMMENT ON TABLE school_payment_plan_installment IS 'Individual installments of a payment plan';
COMMENT ON TABLE school_block_policy IS 'Rules for blocking defaulters (hall ticket, report card, TC)';
COMMENT ON TABLE school_student_block IS 'Active blocks on students per policy';

COMMIT;