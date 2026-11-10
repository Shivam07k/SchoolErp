-- ============================================================
-- School HR & Payroll — Step 5: Advances
-- ============================================================
-- Creates: school_advance, school_repayment_schedule, school_advance_ledger_entry
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
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

ALTER TABLE school_advance
    ADD COLUMN IF NOT EXISTS created_by TEXT;

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
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

ALTER TABLE school_repayment_schedule
    ADD COLUMN IF NOT EXISTS created_by TEXT;

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