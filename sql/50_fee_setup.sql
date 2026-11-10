-- ============================================================
-- M16 Fees & Accounts — Step 1: Fee Setup
-- ============================================================
-- Creates: school_fee_head, school_fee_category, school_fee_structure, 
--          school_fee_structure_line, school_installment, school_fine_rule,
--          school_concession_type, school_student_fee_assignment,
--          school_family, school_family_member
-- ============================================================

BEGIN;

-- Fee Heads
CREATE TABLE IF NOT EXISTS school_fee_head (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('tuition', 'transport', 'hostel', 'exam', 'admission', 'deposit', 'other')),
  is_taxable        BOOLEAN DEFAULT false,
  tax_rate          NUMERIC(5,2) DEFAULT 0,
  income_account_id INT REFERENCES school_account(id),
  is_refundable     BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  sort_order        INT DEFAULT 0,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

ALTER TABLE school_fee_head
  ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_fee_head_active ON school_fee_head(app_id, is_active) WHERE deleted_at IS NULL;

-- Fee Categories
CREATE TABLE IF NOT EXISTS school_fee_category (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  description       TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_category ON school_fee_category(app_id, name) WHERE deleted_at IS NULL;

-- Fee Structures
CREATE TABLE IF NOT EXISTS school_fee_structure (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  academic_year_id  INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  version           INT DEFAULT 1,
  effective_from    DATE DEFAULT CURRENT_DATE,
  is_active         BOOLEAN DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_structure_year_name ON school_fee_structure(app_id, academic_year_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_structure_year ON school_fee_structure(academic_year_id);

-- Fee Structure Lines
CREATE TABLE IF NOT EXISTS school_fee_structure_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  structure_id      INT REFERENCES school_fee_structure(id) ON DELETE CASCADE,
  class_id          INT REFERENCES school_classes(id) ON DELETE SET NULL,
  category_id       INT REFERENCES school_fee_category(id) ON DELETE SET NULL,
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  amount            NUMERIC(12,2) NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_structure_line ON school_fee_structure_line(app_id, structure_id, class_id, category_id, head_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_structure_line_structure ON school_fee_structure_line(structure_id);
CREATE INDEX IF NOT EXISTS idx_fee_structure_line_class ON school_fee_structure_line(class_id);

-- Installments
CREATE TABLE IF NOT EXISTS school_installment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  structure_id      INT REFERENCES school_fee_structure(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  due_date          DATE NOT NULL,
  share_percent     NUMERIC(5,2) NOT NULL,
  grace_days        INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_structure_name ON school_installment(app_id, structure_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_installment_structure ON school_installment(structure_id);

-- Fine Rules
CREATE TABLE IF NOT EXISTS school_fine_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  scope             TEXT NOT NULL CHECK (scope IN ('all', 'head', 'installment')),
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  installment_id    INT REFERENCES school_installment(id) ON DELETE SET NULL,
  grace_days        INT DEFAULT 0,
  type              TEXT NOT NULL CHECK (type IN ('flat', 'per_day', 'percent')),
  flat_amount       NUMERIC(12,2),
  per_day_amount    NUMERIC(12,2),
  percent_rate      NUMERIC(5,2),
  cap_amount        NUMERIC(12,2),
  waiver_allowed    BOOLEAN DEFAULT true,
  waiver_roles      TEXT[],
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fine_rule_scope ON school_fine_rule(scope, head_id, installment_id);

-- Concession Types
CREATE TABLE IF NOT EXISTS school_concession_type (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  rule_type         TEXT NOT NULL CHECK (rule_type IN ('percent', 'amount')),
  rule_value        NUMERIC(12,2) NOT NULL,
  head_scope        TEXT NOT NULL,
  head_id           INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  approval_required BOOLEAN DEFAULT true,
  approval_roles    TEXT[],
  max_amount        NUMERIC(12,2),
  validity_from     DATE,
  validity_to       DATE,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Student Fee Assignments
CREATE TABLE IF NOT EXISTS school_student_fee_assignment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  structure_id      INT REFERENCES school_fee_structure(id) ON DELETE SET NULL,
  category_id       INT REFERENCES school_fee_category(id) ON DELETE SET NULL,
  effective_from    DATE NOT NULL,
  effective_to      DATE,
  transport_stop_id INT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_fee_assignment ON school_student_fee_assignment(app_id, student_id, effective_from) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_student_fee_assignment_student ON school_student_fee_assignment(student_id);

-- Family
CREATE TABLE IF NOT EXISTS school_family (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  guardian_name     TEXT,
  guardian_phone    TEXT,
  guardian_email    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Family Members
CREATE TABLE IF NOT EXISTS school_family_member (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  family_id         INT REFERENCES school_family(id) ON DELETE CASCADE,
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  is_primary        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_member_student ON school_family_member(app_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_family_member_family ON school_family_member(family_id);

COMMENT ON TABLE school_fee_head IS 'Fee head definitions with income account mapping';
COMMENT ON TABLE school_fee_category IS 'Student categories (new, old, staff ward, free seat, etc.)';
COMMENT ON TABLE school_fee_structure IS 'Fee structure per academic year, versioned';
COMMENT ON TABLE school_fee_structure_line IS 'Class x category x head with amount';
COMMENT ON TABLE school_installment IS 'Installments per structure with due dates and share %';
COMMENT ON TABLE school_fine_rule IS 'Late fine rules with grace days, type, cap';
COMMENT ON TABLE school_concession_type IS 'Concession types with approval chain';
COMMENT ON TABLE school_student_fee_assignment IS 'Student to structure/category mapping';
COMMENT ON TABLE school_family IS 'Family grouping for siblings';
COMMENT ON TABLE school_family_member IS 'Students linked to family';

COMMIT;