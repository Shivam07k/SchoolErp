-- ============================================================
-- M16 Fees & Accounts — Step 6: Accounts Core
-- ============================================================
-- Creates: school_account_group, school_account, school_financial_year,
--          school_period, school_voucher_type, school_voucher,
--          school_voucher_line, school_vendor, school_vendor_bill,
--          school_audit_log
-- ============================================================

BEGIN;

-- Account Groups
CREATE TABLE IF NOT EXISTS school_account_group (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  parent_id         INT REFERENCES school_account_group(id),
  type              TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  is_cash_or_bank   BOOLEAN DEFAULT false,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_group_parent ON school_account_group(parent_id);

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS school_account (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL,
  name              TEXT NOT NULL,
  group_id          INT REFERENCES school_account_group(id) ON DELETE SET NULL,
  type              TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  is_cash_or_bank   BOOLEAN DEFAULT false,
  is_control        BOOLEAN DEFAULT false,
  opening_balance   NUMERIC(15,2) DEFAULT 0,
  current_balance   NUMERIC(15,2) DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_account_code ON school_account(app_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_group ON school_account(group_id);
CREATE INDEX IF NOT EXISTS idx_account_type ON school_account(type);

-- Financial Year
CREATE TABLE IF NOT EXISTS school_financial_year (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  is_closed         BOOLEAN DEFAULT false,
  closed_at         TIMESTAMPTZ,
  closed_by         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_year ON school_financial_year(app_id, name) WHERE deleted_at IS NULL;

-- Periods
CREATE TABLE IF NOT EXISTS school_period (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  financial_year_id INT REFERENCES school_financial_year(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  is_closed         BOOLEAN DEFAULT false,
  closed_at         TIMESTAMPTZ,
  closed_by         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_period_year_name ON school_period(financial_year_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_period_year ON school_period(financial_year_id);

-- Voucher Types
CREATE TABLE IF NOT EXISTS school_voucher_type (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  code              TEXT NOT NULL,
  numbering_series  TEXT NOT NULL,
  prefix            TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_voucher_type_code ON school_voucher_type(app_id, code) WHERE deleted_at IS NULL;

-- Vouchers
CREATE TABLE IF NOT EXISTS school_voucher (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  type_id           INT REFERENCES school_voucher_type(id) ON DELETE SET NULL,
  number            TEXT NOT NULL,
  date              DATE NOT NULL,
  period_id         INT REFERENCES school_period(id) ON DELETE SET NULL,
  source_type       TEXT NOT NULL,
  source_id         INT,
  narration         TEXT,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  total_debit       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit      NUMERIC(15,2) NOT NULL DEFAULT 0,
  posted_by         TEXT,
  posted_at         TIMESTAMPTZ,
  cancelled_by      TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_voucher_number ON school_voucher(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_date_period ON school_voucher(date, period_id);
CREATE INDEX IF NOT EXISTS idx_voucher_source ON school_voucher(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_voucher_status ON school_voucher(status);

-- Voucher Lines
CREATE TABLE IF NOT EXISTS school_voucher_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  voucher_id        INT REFERENCES school_voucher(id) ON DELETE CASCADE,
  account_id        INT REFERENCES school_account(id) ON DELETE SET NULL,
  debit             NUMERIC(15,2) DEFAULT 0,
  credit            NUMERIC(15,2) DEFAULT 0,
  narration         TEXT,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voucher_line_voucher ON school_voucher_line(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_line_account ON school_voucher_line(account_id);

-- Vendors
CREATE TABLE IF NOT EXISTS school_vendor (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  gstin             TEXT,
  pan               TEXT,
  contact_person    TEXT,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  account_id        INT REFERENCES school_account(id) ON DELETE SET NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vendor_account ON school_vendor(account_id);

-- Vendor Bills
CREATE TABLE IF NOT EXISTS school_vendor_bill (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  vendor_id         INT REFERENCES school_vendor(id) ON DELETE SET NULL,
  bill_number       TEXT NOT NULL,
  bill_date         DATE NOT NULL,
  due_date          DATE,
  amount            NUMERIC(12,2) NOT NULL,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  paid_at           TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vendor_bill_vendor ON school_vendor_bill(vendor_id, status);

-- Audit Log
CREATE TABLE IF NOT EXISTS school_audit_log (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  entity            TEXT NOT NULL,
  record_id         INT NOT NULL,
  action            TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'reverse', 'approve', 'reject', 'cancel', 'match', 'unmatch')),
  old_values        JSONB,
  new_values        JSONB,
  user_id           TEXT,
  user_ip           TEXT,
  user_agent        TEXT,
  reason            TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON school_audit_log(entity, entity_id);;
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON school_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON school_audit_log(action);

COMMENT ON TABLE school_account_group IS 'Account group hierarchy (Assets, Liabilities, Income, Expenses, Equity)';
COMMENT ON TABLE school_account IS 'Chart of accounts with opening/current balance';
COMMENT ON TABLE school_financial_year IS 'Financial year definition';
COMMENT ON TABLE school_period IS 'Accounting periods (months) within financial year';
COMMENT ON TABLE school_voucher_type IS 'Voucher types (Receipt, Payment, Contra, Journal)';
COMMENT ON TABLE school_voucher IS 'Balanced double-entry vouchers';
COMMENT ON TABLE school_voucher_line IS 'Voucher line items (account, debit, credit)';
COMMENT ON TABLE school_vendor IS 'Vendor master with payable account';
COMMENT ON TABLE school_vendor_bill IS 'Vendor bills with approval/payment workflow';
COMMENT ON TABLE school_audit_log IS 'Complete audit trail for all money tables';

COMMIT;