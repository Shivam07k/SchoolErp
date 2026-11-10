-- ============================================================
-- M16 Fees & Accounts — Step 2: Invoices & Collection
-- ============================================================
-- Creates: school_invoice, school_invoice_line, school_receipt,
--          school_receipt_allocation, school_cheque, school_online_payment,
--          school_cashier_day, school_ledger_entry
-- ============================================================

BEGIN;

-- Cashier Day
CREATE TABLE IF NOT EXISTS school_cashier_day (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  cashier_id        TEXT NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_cash      NUMERIC(12,2) DEFAULT 0,
  closing_cash      NUMERIC(12,2),
  expected_cash     NUMERIC(12,2),
  difference        NUMERIC(12,2) GENERATED ALWAYS AS (closing_cash - expected_cash) STORED,
  status            TEXT DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by         TEXT,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cashier_day ON school_cashier_day(app_id, cashier_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cashier_day_date ON school_cashier_day(date, status);

-- Invoices
CREATE TABLE IF NOT EXISTS school_invoice (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  installment_id    INT REFERENCES school_installment(id) ON DELETE SET NULL,
  number            TEXT NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE NOT NULL,
  status            TEXT DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'partly_paid', 'paid', 'cancelled', 'written_off')),
  total_amount      NUMERIC(12,2) NOT NULL,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  concession_amount NUMERIC(12,2) DEFAULT 0,
  fine_amount       NUMERIC(12,2) DEFAULT 0,
  balance           NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount - concession_amount + fine_amount) STORED,
  cancelled_by      TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancelled_reason  TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_number ON school_invoice(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_student_due ON school_invoice(student_id, due_date, status);

-- Invoice Lines
CREATE TABLE IF NOT EXISTS school_invoice_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  invoice_id        INT REFERENCES school_invoice(id) ON DELETE CASCADE,
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  amount            NUMERIC(12,2) NOT NULL,
  concession_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_invoice ON school_invoice_line(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_head ON school_invoice_line(head_id);

-- Receipts
CREATE TABLE IF NOT EXISTS school_receipt (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE SET NULL,
  family_id         INT REFERENCES school_family(id) ON DELETE SET NULL,
  number            TEXT NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  mode              TEXT NOT NULL CHECK (mode IN ('cash', 'cheque', 'dd', 'upi', 'card', 'bank_transfer', 'online', 'challan', 'pdc')),
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'cleared', 'bounced', 'cancelled')),
  reference         TEXT,
  cashier_id        TEXT,
  cashier_day_id    INT REFERENCES school_cashier_day(id) ON DELETE SET NULL,
  cheque_id         INT,
  online_payment_id INT,
  cancelled_by      TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancelled_reason  TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_number ON school_receipt(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipt_student_date ON school_receipt(student_id, date, status);
CREATE INDEX IF NOT EXISTS idx_receipt_cashier_day ON school_receipt(cashier_day_id);
CREATE INDEX IF NOT EXISTS idx_receipt_family ON school_receipt(family_id);
CREATE INDEX IF NOT EXISTS idx_receipt_cheque ON school_receipt(cheque_id);
CREATE INDEX IF NOT EXISTS idx_receipt_online_payment ON school_receipt(online_payment_id);

-- Receipt Allocation
CREATE TABLE IF NOT EXISTS school_receipt_allocation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT,
  invoice_line_id   INT,
  amount            NUMERIC(12,2) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_alloc_receipt ON school_receipt_allocation(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_alloc_line ON school_receipt_allocation(invoice_line_id);

-- Cheques
CREATE TABLE IF NOT EXISTS school_cheque (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT,
  number            TEXT NOT NULL,
  bank_name         TEXT,
  branch            TEXT,
  cheque_date       DATE NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'cleared', 'bounced', 'cancelled')),
  deposit_date      DATE,
  clearance_date    DATE,
  bounce_charge     NUMERIC(12,2) DEFAULT 0,
  bounce_reason     TEXT,
  deposited_by      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Online Payments
CREATE TABLE IF NOT EXISTS school_online_payment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT,
  gateway           TEXT NOT NULL,
  gateway_order_id  TEXT NOT NULL,
  gateway_payment_id TEXT,
  gateway_signature TEXT,
  amount            NUMERIC(12,2) NOT NULL,
  gateway_fee       NUMERIC(12,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  student_id        INT REFERENCES school_students(id) ON DELETE SET NULL,
  gateway_response  JSONB,
  webhook_received  BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Cashier Day
CREATE TABLE IF NOT EXISTS school_cashier_day (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  cashier_id        TEXT NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_cash      NUMERIC(12,2) DEFAULT 0,
  closing_cash      NUMERIC(12,2),
  expected_cash     NUMERIC(12,2),
  difference        NUMERIC(12,2) GENERATED ALWAYS AS (closing_cash - expected_cash) STORED,
  status            TEXT DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by         TEXT,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cashier_day ON school_cashier_day(app_id, cashier_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cashier_day_date ON school_cashier_day(date, status);

-- Ledger Entries (immutable, only reversals allowed)
CREATE TABLE IF NOT EXISTS school_ledger_entry (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('charge', 'payment', 'concession', 'fine', 'refund', 'adjustment', 'write_off', 'reversal')),
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  debit             NUMERIC(15,2) DEFAULT 0,
  credit            NUMERIC(15,2) DEFAULT 0,
  balance           NUMERIC(15,2) NOT NULL,
  source_type       TEXT NOT NULL,
  source_id         INT,
  reversal_of       INT REFERENCES school_ledger_entry(id),
  reason            TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Receipt Allocation
CREATE TABLE IF NOT EXISTS school_receipt_allocation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT,
  invoice_line_id   INT,
  amount            NUMERIC(12,2) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_alloc_receipt ON school_receipt_allocation(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_alloc_line ON school_receipt_allocation(invoice_line_id);

-- Add foreign key constraints after all tables are created
DO $$
BEGIN
  ALTER TABLE school_receipt
    ADD CONSTRAINT fk_receipt_cashier_day
      FOREIGN KEY (cashier_day_id) REFERENCES school_cashier_day(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_receipt_cheque
      FOREIGN KEY (cheque_id) REFERENCES school_cheque(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT fk_receipt_online_payment
      FOREIGN KEY (online_payment_id) REFERENCES school_online_payment(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN
  -- Constraints already exist, ignore
END $$;

DO $$
BEGIN
  ALTER TABLE school_cheque
    ADD CONSTRAINT fk_cheque_receipt
      FOREIGN KEY (receipt_id) REFERENCES school_receipt(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
END $$;

DO $$
BEGIN
  ALTER TABLE school_online_payment
    ADD CONSTRAINT fk_online_payment_receipt
      FOREIGN KEY (receipt_id) REFERENCES school_receipt(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
END $$;

DO $$
BEGIN
  ALTER TABLE school_receipt_allocation
    ADD CONSTRAINT fk_receipt_alloc_receipt
      FOREIGN KEY (receipt_id) REFERENCES school_receipt(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_receipt_alloc_line
      FOREIGN KEY (invoice_line_id) REFERENCES school_invoice_line(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  -- Constraints already exist, ignore
END $$;

-- Receipt Allocation
CREATE TABLE IF NOT EXISTS school_receipt_allocation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT,
  invoice_line_id   INT,
  amount            NUMERIC(12,2) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_alloc_receipt ON school_receipt_allocation(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_alloc_line ON school_receipt_allocation(invoice_line_id);

-- Ledger Entries (immutable, only reversals allowed)
CREATE TABLE IF NOT EXISTS school_ledger_entry (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('charge', 'payment', 'concession', 'fine', 'refund', 'adjustment', 'write_off', 'reversal')),
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  debit             NUMERIC(15,2) DEFAULT 0,
  credit            NUMERIC(15,2) DEFAULT 0,
  balance           NUMERIC(15,2) NOT NULL,
  source_type       TEXT NOT NULL,
  source_id         INT,
  reversal_of       INT REFERENCES school_ledger_entry(id),
  reason            TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ledger_student_date ON school_ledger_entry(student_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON school_ledger_entry(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reversal ON school_ledger_entry(reversal_of);

-- Receipt Allocation indexes
CREATE INDEX IF NOT EXISTS idx_receipt_alloc_receipt ON school_receipt_allocation(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_alloc_line ON school_receipt_allocation(invoice_line_id);

-- Receipt indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipt_number ON school_receipt(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receipt_student_date ON school_receipt(student_id, date, status);
CREATE INDEX IF NOT EXISTS idx_receipt_cashier_day ON school_receipt(cashier_day_id);
CREATE INDEX IF NOT EXISTS idx_receipt_family ON school_receipt(family_id);
CREATE INDEX IF NOT EXISTS idx_receipt_cheque ON school_receipt(cheque_id);
CREATE INDEX IF NOT EXISTS idx_receipt_online_payment ON school_receipt(online_payment_id);

-- Cheque indexes
CREATE INDEX IF NOT EXISTS idx_cheque_status_date ON school_cheque(status, cheque_date);
CREATE INDEX IF NOT EXISTS idx_cheque_receipt ON school_cheque(receipt_id);

-- Online Payments indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_gateway_order ON school_online_payment(app_id, gateway, gateway_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_online_payment_student ON school_online_payment(student_id, status);
CREATE INDEX IF NOT EXISTS idx_online_payment_gateway ON school_online_payment(gateway, gateway_order_id);

-- Cashier Day indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashier_day ON school_cashier_day(app_id, cashier_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cashier_day_date ON school_cashier_day(date, status);

-- Ledger indexes
CREATE INDEX IF NOT EXISTS idx_ledger_student_date ON school_ledger_entry(student_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON school_ledger_entry(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reversal ON school_ledger_entry(reversal_of);

-- Invoice indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_number ON school_invoice(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_student_due ON school_invoice(student_id, due_date, status);

-- Invoice Line indexes
CREATE INDEX IF NOT EXISTS idx_invoice_line_invoice ON school_invoice_line(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_head ON school_invoice_line(head_id);

-- Online Payments indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_gateway_order ON school_online_payment(app_id, gateway, gateway_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_online_payment_student ON school_online_payment(student_id, status);
CREATE INDEX IF NOT EXISTS idx_online_payment_gateway ON school_online_payment(gateway, gateway_order_id);

-- Cashier Day indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashier_day ON school_cashier_day(app_id, cashier_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cashier_day_date ON school_cashier_day(date, status);

-- Ledger indexes
CREATE INDEX IF NOT EXISTS idx_ledger_student_date ON school_ledger_entry(student_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON school_ledger_entry(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reversal ON school_ledger_entry(reversal_of);

-- Invoice indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_number ON school_invoice(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_student_due ON school_invoice(student_id, due_date, status);

-- Invoice Line indexes
CREATE INDEX IF NOT EXISTS idx_invoice_line_invoice ON school_invoice_line(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_head ON school_invoice_line(head_id);

-- Online Payments indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_gateway_order ON school_online_payment(app_id, gateway, gateway_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_online_payment_student ON school_online_payment(student_id, status);
CREATE INDEX IF NOT EXISTS idx_online_payment_gateway ON school_online_payment(gateway, gateway_order_id);

-- Cashier Day indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashier_day ON school_cashier_day(app_id, cashier_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cashier_day_date ON school_cashier_day(date, status);

-- Ledger indexes
CREATE INDEX IF NOT EXISTS idx_ledger_student_date ON school_ledger_entry(student_id, date);
CREATE INDEX IF NOT EXISTS idx_ledger_source ON school_ledger_entry(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reversal ON school_ledger_entry(reversal_of);

COMMENT ON TABLE school_invoice IS 'Student fee invoices per installment';
COMMENT ON TABLE school_invoice_line IS 'Invoice line items per fee head';
COMMENT ON TABLE school_receipt IS 'Fee receipts with payment mode and allocation';
COMMENT ON TABLE school_receipt_allocation IS 'Allocation of receipt amount to invoice lines';
COMMENT ON TABLE school_cheque IS 'Cheque details with status tracking';
COMMENT ON TABLE school_online_payment IS 'Online payment tracking with gateway info';
COMMENT ON TABLE school_cashier_day IS 'Cashier daily open/close with cash reconciliation';
COMMENT ON TABLE school_ledger_entry IS 'Immutable student fee ledger (only reversals allowed)';

COMMIT;