-- ============================================================
-- School HR and Payroll Module — Database Schema
-- Version 1.0 · 2 November 2026
-- Migration sequence: 60_hr_staff.sql → 61_hr_leave.sql → 62_hr_payroll.sql → 63_hr_advances.sql → 64_hr_audit.sql
-- ============================================================

-- ============================================================
-- 60_hr_staff.sql — Staff Directory
-- ============================================================

BEGIN;

-- Staff master
CREATE TABLE IF NOT EXISTS school_staff (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    employee_code       TEXT NOT NULL,
    name                TEXT NOT NULL,
    date_of_birth       DATE,
    gender              TEXT CHECK (gender IN ('male', 'female', 'other')),
    contact_phone       TEXT,
    contact_email       TEXT,
    address             TEXT,
    photo_url           TEXT,
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'exited')),
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_employee_code ON school_staff(app_id, employee_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_status ON school_staff(app_id, status) WHERE deleted_at IS NULL;

-- Employment history (effective-dated)
CREATE TABLE IF NOT EXISTS school_staff_employment (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    designation         TEXT NOT NULL,
    department          TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('permanent', 'contract', 'part_time', 'visiting', 'probation')),
    joining_date        DATE NOT NULL,
    confirmation_date   DATE,
    reports_to          INT REFERENCES school_staff(id) ON DELETE SET NULL,
    exit_date           DATE,
    exit_reason         TEXT,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_employment_staff ON school_staff_employment(app_id, staff_id, effective_from) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_employment_dept ON school_staff_employment(app_id, department) WHERE deleted_at IS NULL;

-- Qualifications and teachable subjects
CREATE TABLE IF NOT EXISTS school_staff_qualification (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    degree              TEXT NOT NULL,
    subject             TEXT,
    institute           TEXT,
    year                INT,
    teachable_subjects  INT[],          -- school_subjects IDs
    teachable_classes   INT[],          -- school_classes IDs
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_qual_staff ON school_staff_qualification(app_id, staff_id) WHERE deleted_at IS NULL;

-- Documents
CREATE TABLE IF NOT EXISTS school_staff_document (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,  -- 'id_proof', 'address_proof', 'qualification', 'experience', 'contract', 'medical', 'other'
    file_url            TEXT NOT NULL,
    expiry_date         DATE,
    verified            BOOLEAN DEFAULT false,
    verified_by         TEXT,
    verified_at         TIMESTAMPTZ,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_doc_staff ON school_staff_document(app_id, staff_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_doc_expiry ON school_staff_document(expiry_date) WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;

-- Bank details
CREATE TABLE IF NOT EXISTS school_staff_bank (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    bank_name           TEXT NOT NULL,
    account_number      TEXT NOT NULL,
    ifsc_code           TEXT NOT NULL,
    account_holder_name TEXT,
    is_primary          BOOLEAN DEFAULT true,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_bank_primary ON school_staff_bank(app_id, staff_id) WHERE deleted_at IS NULL AND is_primary = true;

-- Statutory details
CREATE TABLE IF NOT EXISTS school_staff_statutory (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    pan                 TEXT,
    pf_number           TEXT,
    pf_join_date        DATE,
    esi_number          TEXT,
    esi_join_date       DATE,
    pt_registration     TEXT,
    pt_state            TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pan ON school_staff_statutory(app_id, pan) WHERE deleted_at IS NULL AND pan IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pf ON school_staff_statutory(app_id, pf_number) WHERE deleted_at IS NULL AND pf_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_esi ON school_staff_statutory(app_id, esi_number) WHERE deleted_at IS NULL AND esi_number IS NOT NULL;

-- Nominees
CREATE TABLE IF NOT EXISTS school_staff_nominee (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    relation            TEXT NOT NULL,
    share_percent       NUMERIC(5,2) NOT NULL,
    phone               TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- Emergency contacts
CREATE TABLE IF NOT EXISTS school_staff_emergency_contact (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    relation            TEXT NOT NULL,
    phone               TEXT NOT NULL,
    is_primary          BOOLEAN DEFAULT false,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE school_staff IS 'Staff master record';
COMMENT ON TABLE school_staff_employment IS 'Effective-dated employment history';
COMMENT ON TABLE school_staff_qualification IS 'Qualifications and teachable subjects (shared with Timetable)';
COMMENT ON TABLE school_staff_document IS 'Documents with expiry tracking';
COMMENT ON TABLE school_staff_bank IS 'Bank account details for salary credit';
COMMENT ON TABLE school_staff_statutory IS 'PAN, PF, ESI, Professional Tax details';
COMMENT ON TABLE school_staff_nominee IS 'Nominees for gratuity, PF, etc.';
COMMENT ON TABLE school_staff_emergency_contact IS 'Emergency contact persons';

COMMIT;


-- ============================================================
-- 61_hr_leave.sql — Leave Management
-- ============================================================

BEGIN;

-- Leave types
CREATE TABLE IF NOT EXISTS school_leave_type (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    name                TEXT NOT NULL,
    code                TEXT NOT NULL,  -- 'CL', 'SL', 'EL', 'ML', 'PL', 'CO', 'LOP'
    is_paid             BOOLEAN DEFAULT true,
    accrual_rule        JSONB,        -- { frequency: 'monthly', days_per_period: 1.25, pro_rata: true }
    carry_forward_max   NUMERIC(6,2) DEFAULT 0,
    encashable          BOOLEAN DEFAULT false,
    half_day_allowed    BOOLEAN DEFAULT true,
    document_required_after_days INT DEFAULT 3,
    requires_approval   BOOLEAN DEFAULT true,
    approval_roles      TEXT[],       -- ['HOD', 'PRINCIPAL']
    is_active           BOOLEAN DEFAULT true,
    sort_order          INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_type_code ON school_leave_type(app_id, code) WHERE deleted_at IS NULL;

-- Leave policies (type × category)
CREATE TABLE IF NOT EXISTS school_leave_policy (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    leave_type_id       INT NOT NULL REFERENCES school_leave_type(id) ON DELETE CASCADE,
    staff_category      TEXT NOT NULL,  -- 'permanent', 'contract', 'part_time', 'visiting'
    yearly_quota        NUMERIC(6,2) NOT NULL,
    accrual_frequency   TEXT DEFAULT 'monthly' CHECK (accrual_frequency IN ('monthly', 'quarterly', 'yearly', 'on_join')),
    rules               JSONB,          -- { count_weekly_off: false, count_holidays: false, max_continuous_days: 15 }
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_policy_type_cat ON school_leave_policy(app_id, leave_type_id, staff_category) WHERE deleted_at IS NULL;

-- Leave balance ledger (immutable entries)
CREATE TABLE IF NOT EXISTS school_leave_balance_entry (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    leave_type_id       INT NOT NULL REFERENCES school_leave_type(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    change              NUMERIC(6,2) NOT NULL,  -- positive = accrual, negative = usage
    source              TEXT NOT NULL CHECK (source IN ('accrual', 'usage', 'adjustment', 'encashment', 'carry_forward', 'opening')),
    source_id           INT,                     -- leave_application.id, payroll_run.id, etc.
    remarks             TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lbe_staff_type ON school_leave_balance_entry(app_id, staff_id, leave_type_id);
CREATE INDEX IF NOT EXISTS idx_lbe_date ON school_leave_balance_entry(date);
CREATE INDEX IF NOT EXISTS idx_lbe_source ON school_leave_balance_entry(source, source_id);

-- Leave applications
CREATE TABLE IF NOT EXISTS school_leave_application (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    leave_type_id       INT NOT NULL REFERENCES school_leave_type(id) ON DELETE RESTRICT,
    from_date           DATE NOT NULL,
    to_date             DATE NOT NULL,
    half_day            BOOLEAN DEFAULT false,
    half_day_session    TEXT CHECK (half_day_session IN ('forenoon', 'afternoon')),
    days                NUMERIC(4,2) NOT NULL,  -- calculated by policy
    reason              TEXT,
    attachment_url      TEXT,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'taken')),
    applied_at          TIMESTAMPTZ DEFAULT now(),
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    rejected_by         TEXT,
    rejected_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    cancelled_by        TEXT,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    approver_chain      JSONB,        -- [{role: 'HOD', user: '...', status: 'approved', at: '...'}]
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leave_app_staff_status ON school_leave_application(app_id, staff_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_app_dates ON school_leave_application(from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_leave_app_approver ON school_leave_application(approver_chain) WHERE status = 'pending';

-- Comp-off
CREATE TABLE IF NOT EXISTS school_comp_off (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    earned_date         DATE NOT NULL,
    reason              TEXT,          -- 'worked_on_holiday', 'overtime'
    expiry_date         DATE NOT NULL,
    used_on             DATE,
    used_for_application_id INT REFERENCES school_leave_application(id) ON DELETE SET NULL,
    status              TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired', 'cancelled')),
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comp_off_staff ON school_comp_off(app_id, staff_id, status) WHERE deleted_at IS NULL;

-- Holidays (shared with Timetable and Attendance)
CREATE TABLE IF NOT EXISTS school_holiday (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    name                TEXT NOT NULL,
    date                DATE NOT NULL,
    is_recurring        BOOLEAN DEFAULT false,
    recurring_rule      TEXT,         -- 'monthly', 'yearly', 'easter', etc.
    applicable_to       TEXT[] DEFAULT '{}',  -- empty = all, or ['staff', 'students']
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_holiday_date ON school_holiday(app_id, date) WHERE deleted_at IS NULL;

COMMENT ON TABLE school_leave_type IS 'Leave type master with policy configuration';
COMMENT ON TABLE school_leave_policy IS 'Leave policy per type and staff category';
COMMENT ON TABLE school_leave_balance_entry IS 'Immutable leave balance ledger';
COMMENT ON TABLE school_leave_application IS 'Leave applications with approval chain';
COMMENT ON TABLE school_comp_off IS 'Compensatory off earned and used';
COMMENT ON TABLE school_holiday IS 'Shared holiday calendar';

COMMIT;


-- ============================================================
-- 62_hr_payroll.sql — Payroll Core
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


-- ============================================================
-- 63_hr_advances.sql — Advances and Loans
-- ============================================================

BEGIN;

-- Advances and loans
CREATE TABLE IF NOT EXISTS school_advance (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    type                TEXT NOT NULL CHECK (type IN ('salary_advance', 'loan')),
    amount              NUMERIC(12,2) NOT NULL,
    reason              TEXT NOT NULL,
    installments        INT NOT NULL DEFAULT 1,
    interest_rate       NUMERIC(6,2) DEFAULT 0,  -- annual %
    interest_type       TEXT DEFAULT 'flat' CHECK (interest_type IN ('flat', 'reducing')),
    status              TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'disbursed', 'recovering', 'closed', 'written_off')),
    requested_by        TEXT,
    requested_at        TIMESTAMPTZ DEFAULT now(),
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    rejected_by         TEXT,
    rejected_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    disbursed_by        TEXT,
    disbursed_at        TIMESTAMPTZ,
    disbursement_mode   TEXT CHECK (disbursement_mode IN ('bank', 'cash', 'cheque')),
    disbursement_ref    TEXT,
    closed_at           TIMESTAMPTZ,
    closed_reason       TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_advance_staff_status ON school_advance(app_id, staff_id, status) WHERE deleted_at IS NULL;

-- Repayment schedule
CREATE TABLE IF NOT EXISTS school_repayment_schedule (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    advance_id          INT NOT NULL REFERENCES school_advance(id) ON DELETE CASCADE,
    installment_no      INT NOT NULL,
    due_month           DATE NOT NULL,  -- first day of month
    principal_amount    NUMERIC(12,2) NOT NULL,
    interest_amount     NUMERIC(12,2) DEFAULT 0,
    total_amount        NUMERIC(12,2) NOT NULL,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'recovered', 'partially_recovered', 'skipped', 'carried_forward')),
    recovered_amount    NUMERIC(12,2) DEFAULT 0,
    recovered_in_run_id INT REFERENCES school_payroll_run(id) ON DELETE SET NULL,
    recovered_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_repay_sched_adv_inst ON school_repayment_schedule(app_id, advance_id, installment_no) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_repay_sched_due ON school_repayment_schedule(due_month, status) WHERE deleted_at IS NULL;

-- Advance ledger (immutable)
CREATE TABLE IF NOT EXISTS school_advance_ledger_entry (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    advance_id          INT NOT NULL REFERENCES school_advance(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('disbursement', 'recovery', 'prepayment', 'write_off', 'interest_accrual')),
    amount              NUMERIC(12,2) NOT NULL,
    balance_after       NUMERIC(12,2) NOT NULL,
    reference_id        INT,          -- repayment_schedule.id, payroll_run.id
    reference_type      TEXT,         -- 'schedule', 'payroll_run', 'manual'
    remarks             TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adv_ledger_adv ON school_advance_ledger_entry(app_id, advance_id);

COMMENT ON TABLE school_advance IS 'Salary advances and loans';
COMMENT ON TABLE school_repayment_schedule IS 'Installment schedule for advances';
COMMENT ON TABLE school_advance_ledger_entry IS 'Immutable advance ledger';

COMMIT;


-- ============================================================
-- 64_hr_audit.sql — Audit and Notifications
-- ============================================================

BEGIN;

-- Audit log (extends existing school_audit_log)
-- Ensure these entities are covered by audit triggers
-- (Add to 57_reports_hardening.sql audit trigger list)
-- Entities: school_staff, school_staff_employment, school_staff_qualification,
--           school_staff_document, school_staff_bank, school_staff_statutory,
--           school_staff_nominee, school_staff_emergency_contact,
--           school_leave_type, school_leave_policy, school_leave_balance_entry,
--           school_leave_application, school_comp_off, school_holiday,
--           school_salary_component, school_salary_structure, school_salary_structure_line,
--           school_staff_salary, school_statutory_rule, school_payroll_run,
--           school_payslip, school_payslip_line, school_payroll_adjustment,
--           school_tax_declaration, school_advance, school_repayment_schedule,
--           school_advance_ledger_entry

-- Notifications
CREATE TABLE IF NOT EXISTS school_hr_notification (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    type                TEXT NOT NULL,  -- 'leave_applied', 'leave_approved', 'leave_rejected', 'doc_expiry', 'payroll_ready', 'payslip_released', 'advance_approved', 'installment_due', 'statutory_due', 'missing_bank_pan'
    recipient_user_id   TEXT,
    recipient_role      TEXT,           -- 'HOD', 'PRINCIPAL', 'HR_OFFICER', 'ACCOUNTS_HEAD', 'STAFF'
    subject             TEXT NOT NULL,
    message             TEXT NOT NULL,
    reference_id        INT,
    reference_type      TEXT,
    channels            TEXT[] DEFAULT '{"in_app"}',  -- 'in_app', 'email', 'whatsapp', 'sms'
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
    sent_at             TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_notif_recipient ON school_hr_notification(app_id, recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_notif_type ON school_hr_notification(app_id, type, created_at);

-- Settings (HR-specific)
CREATE TABLE IF NOT EXISTS school_hr_setting (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    key                 TEXT NOT NULL,
    value               JSONB NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_setting_key ON school_hr_setting(app_id, key);

-- Default HR settings
INSERT INTO school_hr_setting (app_id, key, value, description) VALUES
('default', 'leave_year', '"financial"', 'Leave year: academic, financial, calendar'),
('default', 'salary_day_basis', '"calendar"', 'Salary day basis: calendar, thirty, working'),
('default', 'loss_of_pay_policy', '{"late_marks_as_half_day": 3, "unapproved_absence_is_lop": true}', 'Loss of pay policy'),
('default', 'advance_limit_months_salary', '3', 'Advance limit in months of salary'),
('default', 'advance_max_installment_pct_net', '40', 'Maximum installment as % of net pay'),
('default', 'advance_interest_rate_default', '0', 'Default advance interest rate %'),
('default', 'payroll_lock_date', '5', 'Payroll lock date (day of next month)'),
('default', 'payslip_release_on', '"approval"', 'Payslip release: approval or payment'),
('default', 'pf_wage_base_components', '["basic", "da", "retaining"]', 'Components forming PF wage base'),
('default', 'esi_wage_base_components', '["basic", "da", "retaining", "other_allowances"]', 'Components forming ESI wage base'),
('default', 'gratuity_eligibility_years', '5', 'Gratuity eligibility in years'),
('default', 'bonus_eligibility_months', '12', 'Bonus eligibility in months'),
('default', 'bonus_pay_ceiling', '21000', 'Bonus pay ceiling')
ON CONFLICT (app_id, key) DO NOTHING;

COMMENT ON TABLE school_hr_notification IS 'HR-specific notifications';
COMMENT ON TABLE school_hr_setting IS 'HR module settings';

COMMIT;


-- ============================================================
-- Audit trigger registration (run after all tables created)
-- Add to 57_reports_hardening.sql or run separately
-- ============================================================

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables
             WHERE table_schema = 'public'
             AND table_name IN (
                'school_staff', 'school_staff_employment', 'school_staff_qualification',
                'school_staff_document', 'school_staff_bank', 'school_staff_statutory',
                'school_staff_nominee', 'school_staff_emergency_contact',
                'school_leave_type', 'school_leave_policy', 'school_leave_balance_entry',
                'school_leave_application', 'school_comp_off', 'school_holiday',
                'school_salary_component', 'school_salary_structure', 'school_salary_structure_line',
                'school_staff_salary', 'school_statutory_rule', 'school_payroll_run',
                'school_payslip', 'school_payslip_line', 'school_payroll_adjustment',
                'school_tax_declaration', 'school_advance', 'school_repayment_schedule',
                'school_advance_ledger_entry'
              )
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_audit_%I ON %I;
            CREATE TRIGGER trg_audit_%I
            AFTER INSERT OR UPDATE OR DELETE ON %I
            FOR EACH ROW EXECUTE FUNCTION audit_fee_accounts_changes();
        ', t, t, t, t);
    END LOOP;
END $$;