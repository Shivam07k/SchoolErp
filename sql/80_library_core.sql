-- ============================================================
-- School ERP — Library Module Core Schema
-- Migration: plan/library/DATABASE_SCHEMA.sql
-- Based on PART A LIBRARY MODULE A6 Data model
-- Safe to re-run: every object is IF NOT EXISTS.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Catalog master data
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_library_book_category (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  name                  TEXT NOT NULL,
  description           TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_book_category_name ON school_library_book_category(app_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_book_category_active ON school_library_book_category(app_id, is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_rack (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  rack_code             TEXT NOT NULL,
  location              TEXT,
  shelf                 TEXT,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_rack_code ON school_library_rack(app_id, rack_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_rack_status ON school_library_rack(app_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_title (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  book_category_id      INT REFERENCES school_library_book_category(id) ON DELETE SET NULL,
  isbn                  TEXT,
  title                 TEXT NOT NULL,
  subtitle              TEXT,
  author                TEXT,
  publisher             TEXT,
  subject               TEXT,
  edition               TEXT,
  publication_year      INT,
  language              TEXT,
  pages                 INT,
  price                 NUMERIC(12,2),
  rack_id               INT REFERENCES school_library_rack(id) ON DELETE SET NULL,
  acc_no                TEXT,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_title_isbn ON school_library_title(app_id, isbn) WHERE isbn IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_title_acc_no ON school_library_title(app_id, acc_no) WHERE acc_no IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_title_category ON school_library_title(app_id, book_category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_title_status ON school_library_title(app_id, status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 2. Acquisition & Copies
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_library_purchase_entry (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  title_id              INT REFERENCES school_library_title(id) ON DELETE SET NULL,
  supplier_name         TEXT,
  po_no                 TEXT,
  qty                   INT NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_cost             NUMERIC(12,2) DEFAULT 0,
  received_date         DATE,
  acc_no                TEXT,
  status                TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('ordered', 'received', 'cancelled')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_library_purchase_title ON school_library_purchase_entry(app_id, title_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_purchase_status ON school_library_purchase_entry(app_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_copy (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  title_id              INT NOT NULL REFERENCES school_library_title(id) ON DELETE CASCADE,
  purchase_entry_id     INT REFERENCES school_library_purchase_entry(id) ON DELETE SET NULL,
  copy_code             TEXT NOT NULL,
  barcode               TEXT,
  status                TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'issued', 'reserved', 'lost', 'damaged', 'reference')),
  condition             TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor')),
  rack_id               INT REFERENCES school_library_rack(id) ON DELETE SET NULL,
  added_at              TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_copy_code ON school_library_copy(app_id, copy_code) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_copy_barcode ON school_library_copy(app_id, barcode) WHERE barcode IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_copy_title_status ON school_library_copy(app_id, title_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_copy_rack ON school_library_copy(app_id, rack_id) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 3. Members
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_library_member_category (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  name                  TEXT NOT NULL,
  max_books             INT NOT NULL DEFAULT 5 CHECK (max_books >= 0),
  loan_days             INT NOT NULL DEFAULT 14 CHECK (loan_days > 0),
  renewal_limit         INT NOT NULL DEFAULT 2 CHECK (renewal_limit >= 0),
  fine_per_day          NUMERIC(12,2) DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_member_category_name ON school_library_member_category(app_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_member_category_active ON school_library_member_category(app_id, is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_member (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  member_code           TEXT NOT NULL,
  member_type           TEXT NOT NULL CHECK (member_type IN ('student', 'staff')),
  person_id             INT,
  category_id           INT REFERENCES school_library_member_category(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  card_issue_date       DATE,
  card_expiry_date      DATE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_member_code ON school_library_member(app_id, member_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_member_status ON school_library_member(app_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_member_category ON school_library_member(app_id, category_id) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 4. Circulation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_library_loan (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  loan_no               TEXT NOT NULL,
  member_id             INT NOT NULL REFERENCES school_library_member(id) ON DELETE CASCADE,
  copy_id               INT NOT NULL REFERENCES school_library_copy(id) ON DELETE CASCADE,
  title_id              INT REFERENCES school_library_title(id) ON DELETE SET NULL,
  issue_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date              DATE NOT NULL,
  return_date           DATE,
  renewal_count         INT NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'lost', 'damaged')),
  issued_by             TEXT,
  returned_by           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_loan_no ON school_library_loan(app_id, loan_no) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_loan_member_status ON school_library_loan(app_id, member_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_loan_copy ON school_library_loan(app_id, copy_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_loan_due ON school_library_loan(app_id, due_date, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_reservation (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  member_id             INT NOT NULL REFERENCES school_library_member(id) ON DELETE CASCADE,
  title_id              INT NOT NULL REFERENCES school_library_title(id) ON DELETE CASCADE,
  copy_id               INT REFERENCES school_library_copy(id) ON DELETE SET NULL,
  reserved_at           TIMESTAMPTZ DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
  priority              INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_library_reservation_title_status ON school_library_reservation(app_id, title_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_reservation_member ON school_library_reservation(app_id, member_id, status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 5. Stock & Audits
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_library_stock_verification (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  verification_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  verified_by           TEXT,
  copy_id               INT NOT NULL REFERENCES school_library_copy(id) ON DELETE CASCADE,
  expected_status       TEXT,
  actual_status         TEXT,
  remarks               TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_library_stock_verification_copy ON school_library_stock_verification(app_id, copy_id, verification_date DESC);
CREATE INDEX IF NOT EXISTS idx_library_stock_verification_date ON school_library_stock_verification(app_id, verification_date DESC);

-- ------------------------------------------------------------
-- 6. Fines
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_library_fine_rule (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  member_category_id    INT REFERENCES school_library_member_category(id) ON DELETE SET NULL,
  book_category_id      INT REFERENCES school_library_book_category(id) ON DELETE SET NULL,
  fine_per_day          NUMERIC(12,2) NOT NULL DEFAULT 0,
  grace_days            INT NOT NULL DEFAULT 0,
  max_fine_cap          NUMERIC(12,2),
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_library_fine_rule_lookup ON school_library_fine_rule(app_id, member_category_id, book_category_id, is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_fine (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  loan_id               INT NOT NULL REFERENCES school_library_loan(id) ON DELETE CASCADE,
  member_id             INT NOT NULL REFERENCES school_library_member(id) ON DELETE CASCADE,
  fine_amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  fine_days             INT NOT NULL DEFAULT 0,
  waived_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  waived_by             TEXT,
  waive_reason          TEXT,
  posted_to_fees        BOOLEAN NOT NULL DEFAULT false,
  fee_invoice_id        INT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_library_fine_member ON school_library_fine(app_id, member_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_fine_loan ON school_library_fine(app_id, loan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_library_fine_posted ON school_library_fine(app_id, posted_to_fees) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_fine_payment (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  fine_id               INT NOT NULL REFERENCES school_library_fine(id) ON DELETE CASCADE,
  payment_date          TIMESTAMPTZ DEFAULT now(),
  amount                NUMERIC(12,2) NOT NULL,
  payment_mode          TEXT,
  receipt_no            TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_fine_payment_receipt ON school_library_fine_payment(app_id, receipt_no) WHERE receipt_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_fine_payment_fine ON school_library_fine_payment(app_id, fine_id);

-- ------------------------------------------------------------
-- 7. Settings, Notifications, Audit
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_library_setting (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  setting_key           TEXT NOT NULL,
  setting_value         TEXT,
  description           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_setting_key ON school_library_setting(app_id, setting_key) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_library_notification (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  member_id             INT REFERENCES school_library_member(id) ON DELETE SET NULL,
  title_id              INT REFERENCES school_library_title(id) ON DELETE SET NULL,
  copy_id               INT REFERENCES school_library_copy(id) ON DELETE SET NULL,
  type                  TEXT NOT NULL,
  message               TEXT,
  sent_at               TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_library_notification_member ON school_library_notification(app_id, member_id, status);
CREATE INDEX IF NOT EXISTS idx_library_notification_type ON school_library_notification(app_id, type, created_at DESC);

CREATE TABLE IF NOT EXISTS school_library_audit (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  entity_type           TEXT NOT NULL,
  entity_id             INT,
  action                TEXT NOT NULL,
  changed_by            TEXT,
  old_values            JSONB,
  new_values            JSONB,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_library_audit_entity ON school_library_audit(app_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_audit_action ON school_library_audit(app_id, action, created_at DESC);

COMMIT;
