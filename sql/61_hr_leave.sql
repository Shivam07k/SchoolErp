-- ============================================================
-- School HR & Payroll — Step 2: Leave Management
-- ============================================================
-- Creates: school_leave_type, school_leave_policy, school_leave_balance_entry,
--          school_leave_application, school_comp_off, school_holiday
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