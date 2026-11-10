-- ============================================================
-- M16 Fees & Accounts — Step 5: Reconciliation
-- ============================================================
-- Creates: school_bank_statement_line, school_gateway_settlement,
--          school_gateway_settlement_line, school_match_exception,
--          school_cashier_day_exception
-- ============================================================

BEGIN;

-- Gateway Settlements
CREATE TABLE IF NOT EXISTS school_gateway_settlement (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  gateway           TEXT NOT NULL,
  settlement_id     TEXT NOT NULL,
  settlement_date   DATE NOT NULL,
  gross_amount      NUMERIC(12,2) NOT NULL,
  gateway_fee       NUMERIC(12,2) DEFAULT 0,
  tax_on_fee        NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2) NOT NULL,
  currency          TEXT DEFAULT 'INR',
  status            TEXT DEFAULT 'imported' CHECK (status IN ('imported', 'matched', 'exceptions')),
  import_batch_id   TEXT,
  imported_at       TIMESTAMPTZ DEFAULT now(),
  matched_at        TIMESTAMPTZ,
  matched_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gateway_settlement ON school_gateway_settlement(app_id, gateway, settlement_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gateway_settlement_date ON school_gateway_settlement(settlement_date);

-- Bank Statement Lines
CREATE TABLE IF NOT EXISTS school_bank_statement_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  bank_account_id   INT REFERENCES school_account(id),
  import_batch_id   TEXT,
  date              DATE NOT NULL,
  narration         TEXT,
  reference         TEXT,
  debit             NUMERIC(12,2) DEFAULT 0,
  credit            NUMERIC(12,2) DEFAULT 0,
  balance           NUMERIC(12,2),
  import_hash       TEXT,
  matched_flag      BOOLEAN DEFAULT false,
  matched_receipt_id INT REFERENCES school_receipt(id),
  matched_settlement_id INT REFERENCES school_gateway_settlement(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bank_stmt_account_date ON school_bank_statement_line(bank_account_id, date);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_ref ON school_bank_statement_line(reference);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_batch ON school_bank_statement_line(import_batch_id);

-- Gateway Settlement Lines
CREATE TABLE IF NOT EXISTS school_gateway_settlement_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  settlement_id     INT REFERENCES school_gateway_settlement(id) ON DELETE CASCADE,
  gateway_payment_id TEXT NOT NULL,
  gateway_order_id  TEXT,
  amount            NUMERIC(12,2) NOT NULL,
  fee               NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2),
  status            TEXT,
  matched_receipt_id INT REFERENCES school_receipt(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gateway_settlement_line_payment ON school_gateway_settlement_line(gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_gateway_settlement_line_settlement ON school_gateway_settlement_line(settlement_id);

-- Match Exceptions
CREATE TABLE IF NOT EXISTS school_match_exception (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  exception_type    TEXT NOT NULL CHECK (exception_type IN (
    'bank_no_receipt', 'receipt_no_bank', 'amount_mismatch',
    'gateway_no_receipt', 'receipt_no_gateway', 'settlement_mismatch',
    'duplicate_bank', 'duplicate_gateway', 'amount_mismatch_gateway'
  )),
  source_type       TEXT NOT NULL,
  source_id         INT,
  matched_source_id INT,
  amount_diff       NUMERIC(12,2),
  status            TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_by       TEXT,
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_match_exception_type_status ON school_match_exception(exception_type, status);
CREATE INDEX IF NOT EXISTS idx_match_exception_source ON school_match_exception(source_type, source_id);

-- Cashier Day Exceptions
CREATE TABLE IF NOT EXISTS school_cashier_day_exception (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  cashier_day_id    INT REFERENCES school_cashier_day(id) ON DELETE CASCADE,
  exception_type    TEXT NOT NULL CHECK (exception_type IN ('cash_short', 'cash_over', 'missing_receipt', 'extra_receipt')),
  amount            NUMERIC(12,2) NOT NULL,
  note              TEXT,
  resolved_by       TEXT,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashier_exception_day ON school_cashier_day_exception(cashier_day_id);

COMMENT ON TABLE school_bank_statement_line IS 'Imported bank statement lines for reconciliation';
COMMENT ON TABLE school_gateway_settlement IS 'Gateway settlement batches';
COMMENT ON TABLE school_gateway_settlement_line IS 'Individual payments within a gateway settlement';
COMMENT ON TABLE school_match_exception IS 'Unmatched lines across all reconciliation streams';
COMMENT ON TABLE school_cashier_day_exception IS 'Cashier day-end exceptions (short/over)';

COMMIT;