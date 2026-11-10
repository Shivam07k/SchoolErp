-- ============================================================
-- School HR & Payroll — Step 3 & 4: Payroll Core
-- ============================================================
-- Creates: school_salary_component, school_salary_structure, school_salary_structure_line,
--          school_staff_salary, school_statutory_rule, school_payroll_run,
--          school_payslip, school_payslip_line, school_payroll_adjustment,
--          school_tax_declaration
-- ============================================================

BEGIN;

-- Salary components
CREATE TABLE IF NOT EXISTS school_salary_component (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    name                TEXT NOT NULL,
    code                TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('earning', 'deduction', 'employer_contribution')),
    calculation         TEXT NOT NULL CHECK (calculation IN ('fixed', 'percent', 'formula')),
    formula             TEXT,           -- JS expression when calculation='formula'
    base_component_id   INT REFERENCES school_salary_component(id) ON DELETE SET NULL,  -- for percent
    value               NUMERIC(12,2),  -- for fixed
    percent             NUMERIC(6,2),   -- for percent
    is_taxable          BOOLEAN DEFAULT false,
    is_wage_base        BOOLEAN DEFAULT false,  -- part of PF/ESI/gratuity wage base
    is_proratable       BOOLEAN DEFAULT true,   -- prorate by paid days
    is_variable         BOOLEAN DEFAULT false,  -- overtime, extra periods, etc.
    account_id          INT REFERENCES school_account(id) ON DELETE SET NULL,  -- for posting
    sort_order          INT DEFAULT 0,
    is_active           BOOLEAN DEFAULT true,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_salary_comp_code ON school_salary_component(app_id, code) WHERE deleted_at IS NULL;

-- Salary structures
CREATE TABLE IF NOT EXISTS school_salary_structure (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    name                TEXT NOT NULL,
    version             INT DEFAULT 1,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    description         TEXT,
    is_active           BOOLEAN DEFAULT true,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sal_struct_eff ON school_salary_structure(app_id, effective_from) WHERE deleted_at IS NULL;

-- Structure lines
CREATE TABLE IF NOT EXISTS school_salary_structure_line (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    structure_id        INT NOT NULL REFERENCES school_salary_structure(id) ON DELETE CASCADE,
    component_id        INT NOT NULL REFERENCES school_salary_component(id) ON DELETE RESTRICT,
    value               NUMERIC(12,2),      -- overrides component value
    percent             NUMERIC(6,2),       -- overrides component percent
    formula             TEXT,               -- overrides component formula
    condition           TEXT,               -- optional condition (e.g., "designation='Principal'")
    sort_order          INT DEFAULT 0,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sal_struct_line_struct ON school_salary_structure_line(app_id, structure_id) WHERE deleted_at IS NULL;

-- Staff salary assignments
CREATE TABLE IF NOT EXISTS school_staff_salary (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    structure_id        INT NOT NULL REFERENCES school_salary_structure(id) ON DELETE RESTRICT,
    overrides           JSONB,        -- component overrides for this staff
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_salary_staff ON school_staff_salary(app_id, staff_id, effective_from) WHERE deleted_at IS NULL;

-- Statutory rules (versioned)
CREATE TABLE IF NOT EXISTS school_statutory_rule (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    rule_code           TEXT NOT NULL CHECK (rule_code IN ('PF', 'ESI', 'PT', 'TDS', 'GRATUITY', 'BONUS')),
    name                TEXT NOT NULL,
    version             INT DEFAULT 1,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    config              JSONB NOT NULL,  -- rule-specific configuration
    is_active           BOOLEAN DEFAULT true,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_statutory_rule_code_ver ON school_statutory_rule(app_id, rule_code, version) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_statutory_rule_eff ON school_statutory_rule(app_id, rule_code, effective_from) WHERE deleted_at IS NULL;

-- Payroll runs
CREATE TABLE IF NOT EXISTS school_payroll_run (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    period_name         TEXT NOT NULL,  -- '2026-11'
    status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'computed', 'previewed', 'approved', 'locked', 'paid', 'posted', 'cancelled')),
    basis_days          INT NOT NULL,   -- calendar days in period
    wage_base_days      INT NOT NULL,   -- days used for wage base (30, calendar, working)
    rule_versions       JSONB,          -- { PF: 3, ESI: 2, PT: 1, TDS: 4, GRATUITY: 1, BONUS: 1 }
    run_by              TEXT,
    run_at              TIMESTAMPTZ,
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    locked_by           TEXT,
    locked_at           TIMESTAMPTZ,
    paid_by             TEXT,
    paid_at             TIMESTAMPTZ,
    posted_by           TEXT,
    posted_at           TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_run_period ON school_payroll_run(app_id, period_start, period_end) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_run_status ON school_payroll_run(app_id, status) WHERE deleted_at IS NULL;

-- Payslips
CREATE TABLE IF NOT EXISTS school_payslip (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    run_id              INT NOT NULL REFERENCES school_payroll_run(id) ON DELETE CASCADE,
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE RESTRICT,
    paid_days           NUMERIC(5,2) NOT NULL,
    lop_days            NUMERIC(5,2) DEFAULT 0,
    gross_earnings      NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_deductions    NUMERIC(14,2) NOT NULL DEFAULT 0,
    employer_contrib    NUMERIC(14,2) NOT NULL DEFAULT 0,
    net_pay             NUMERIC(14,2) NOT NULL DEFAULT 0,
    status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'computed', 'approved', 'locked', 'paid', 'cancelled')),
    pdf_url             TEXT,
    pdf_generated_at    TIMESTAMPTZ,
    emailed_at          TIMESTAMPTZ,
    whatsapp_sent_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payslip_run_staff ON school_payslip(app_id, run_id, staff_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payslip_staff ON school_payslip(app_id, staff_id) WHERE deleted_at IS NULL;

-- Payslip lines
CREATE TABLE IF NOT EXISTS school_payslip_line (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    payslip_id          INT NOT NULL REFERENCES school_payslip(id) ON DELETE CASCADE,
    component_id        INT NOT NULL REFERENCES school_salary_component(id) ON DELETE RESTRICT,
    component_code      TEXT NOT NULL,
    component_name      TEXT NOT NULL,
    component_type      TEXT NOT NULL CHECK (component_type IN ('earning', 'deduction', 'employer_contribution')),
    amount              NUMERIC(14,2) NOT NULL,
    calculation_details JSONB,    -- { basis: 'fixed', value: 5000, paid_days: 26, basis_days: 30, formula: '...' }
    sort_order          INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payslip_line_payslip ON school_payslip_line(app_id, payslip_id);

-- Payroll adjustments (arrears, bonus, recovery, reimbursement)
CREATE TABLE IF NOT EXISTS school_payroll_adjustment (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    period_start        DATE NOT NULL,
    period_end          DATE NOT NULL,
    component_id        INT NOT NULL REFERENCES school_salary_component(id) ON DELETE RESTRICT,
    amount              NUMERIC(14,2) NOT NULL,
    reason              TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('arrears', 'bonus', 'recovery', 'reimbursement', 'advance_recovery', 'loan_recovery', 'other')),
    source_run_id       INT REFERENCES school_payroll_run(id) ON DELETE SET NULL,  -- for arrears from back-dated revision
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payroll_adj_staff_period ON school_payroll_adjustment(app_id, staff_id, period_start, period_end) WHERE deleted_at IS NULL;

-- Tax declarations
CREATE TABLE IF NOT EXISTS school_tax_declaration (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    financial_year_id   INT NOT NULL REFERENCES school_financial_year(id) ON DELETE RESTRICT,
    regime              TEXT NOT NULL CHECK (regime IN ('old', 'new')),
    section_80c         NUMERIC(12,2) DEFAULT 0,
    section_80d         NUMERIC(12,2) DEFAULT 0,
    section_80ccd1b     NUMERIC(12,2) DEFAULT 0,
    section_24b         NUMERIC(12,2) DEFAULT 0,
    other_deductions    JSONB,
    standard_deduction  NUMERIC(12,2) DEFAULT 50000,
    professional_tax    NUMERIC(12,2) DEFAULT 0,
    declared_at         TIMESTAMPTZ DEFAULT now(),
    proofs_submitted    BOOLEAN DEFAULT false,
    proofs_submitted_at TIMESTAMPTZ,
    verified_by         TEXT,
    verified_at         TIMESTAMPTZ,
    status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'verified', 'rejected')),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_decl_staff_year ON school_tax_declaration(app_id, staff_id, financial_year_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE school_salary_component IS 'Salary component master (earnings, deductions, employer contributions)';
COMMENT ON TABLE school_salary_structure IS 'Salary structure with versioning';
COMMENT ON TABLE school_salary_structure_line IS 'Structure-component mapping with overrides';
COMMENT ON TABLE school_staff_salary IS 'Staff-structure assignment with effective dates';
COMMENT ON TABLE school_statutory_rule IS 'Versioned statutory rules (PF, ESI, PT, TDS, Gratuity, Bonus)';
COMMENT ON TABLE school_payroll_run IS 'Monthly payroll run lifecycle';
COMMENT ON TABLE school_payslip IS 'Individual payslip per staff per run';
COMMENT ON TABLE school_payslip_line IS 'Payslip component breakdown';
COMMENT ON TABLE school_payroll_adjustment IS 'Arrears, bonus, recoveries, reimbursements';
COMMENT ON TABLE school_tax_declaration IS 'Staff tax regime and investment declarations';

COMMIT;