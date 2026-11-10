-- ============================================================
-- School HR & Payroll — Step 6 & 7: Statutory, Year-End, Audit
-- ============================================================
-- Creates: school_hr_notification, school_hr_setting
-- Extends: audit triggers for all HR tables
-- ============================================================

BEGIN;

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