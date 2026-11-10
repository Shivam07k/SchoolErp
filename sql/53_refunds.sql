-- ============================================================
-- M16 Fees & Accounts — Step 4: Refunds
-- ============================================================
-- Creates: school_refund_rule, school_refund_request, school_refund_approval,
--          school_credit_note, school_deposit
-- ============================================================

BEGIN;

-- Refund Rules
CREATE TABLE IF NOT EXISTS school_refund_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  category_id       INT REFERENCES school_fee_category(id) ON DELETE SET NULL,
  reason_type       TEXT NOT NULL CHECK (reason_type IN ('withdrawal', 'excess', 'cancelled_admission', 'deposit_return', 'transport_change', 'concession_late')),
  refundable_percent NUMERIC(5,2) DEFAULT 100,
  non_refundable_heads TEXT[],
  notice_days       INT,
  deduction_rules   JSONB,
  max_deduction     NUMERIC(12,2),
  requires_approval BOOLEAN DEFAULT true,
  approval_roles    TEXT[],
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Refund Requests
CREATE TABLE IF NOT EXISTS school_refund_request (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  reason_type       TEXT NOT NULL CHECK (reason_type IN ('withdrawal', 'excess', 'cancelled_admission', 'deposit_return', 'transport_change', 'concession_late')),
  reason_text       TEXT,
  requested_amount  NUMERIC(12,2),
  calculated_amount NUMERIC(12,2),
  deductions        NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2),
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  requested_by      TEXT,
  requested_at      TIMESTAMPTZ DEFAULT now(),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  approval_notes    TEXT,
  rejected_by       TEXT,
  rejected_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  paid_by           TEXT,
  paid_at           TIMESTAMPTZ,
  payout_mode       TEXT CHECK (payout_mode IN ('cheque', 'bank_transfer', 'upi', 'cash', 'original_online', 'credit_note')),
  payout_reference  TEXT,
  cheque_id         INT REFERENCES school_cheque(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refund_request_student_status ON school_refund_request(student_id, status);

-- Refund Approval Chain
CREATE TABLE IF NOT EXISTS school_refund_approval (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  request_id        INT REFERENCES school_refund_request(id) ON DELETE CASCADE,
  level             INT NOT NULL,
  role              TEXT NOT NULL,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_approval_request ON school_refund_approval(request_id, level);

-- Credit Notes
CREATE TABLE IF NOT EXISTS school_credit_note (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  amount            NUMERIC(12,2) NOT NULL,
  used_amount       NUMERIC(12,2) DEFAULT 0,
  reason            TEXT NOT NULL,
  source_type       TEXT,
  source_id         INT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expiry_date       DATE,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_note_student ON school_credit_note(app_id, student_id, source_type, source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_credit_note_student ON school_credit_note(student_id, status);

-- Deposits
CREATE TABLE IF NOT EXISTS school_deposit (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT DEFAULT 'held' CHECK (status IN ('held', 'returned', 'forfeited', 'adjusted')),
  received_receipt_id INT REFERENCES school_receipt(id) ON DELETE SET NULL,
  return_receipt_id INT REFERENCES school_receipt(id) ON DELETE SET NULL,
  return_date       DATE,
  forfeited_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deposit_student ON school_deposit(student_id, status);

COMMENT ON TABLE school_refund_rule IS 'Refund policy per head/category/reason with deduction rules';
COMMENT ON TABLE school_refund_request IS 'Student refund requests with approval chain';
COMMENT ON TABLE school_refund_approval IS 'Multi-level approval chain for refunds';
COMMENT ON TABLE school_credit_note IS 'Credit notes applied to future dues';
COMMENT ON TABLE school_deposit IS 'Security/caution deposits held and returned';

COMMIT;