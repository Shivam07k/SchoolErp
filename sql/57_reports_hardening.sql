-- ============================================================
-- M16 Fees & Accounts — Step 8: Reports & Hardening
-- ============================================================
-- No new tables - adds indexes, views, and constraints for performance/audit
-- ============================================================

BEGIN;

-- Additional Indexes for Report Performance

-- Fee Collection Reports
CREATE INDEX IF NOT EXISTS idx_invoice_student_status_date ON school_invoice(student_id, status, date);
CREATE INDEX IF NOT EXISTS idx_receipt_student_mode_date ON school_receipt(student_id, mode, date);
CREATE INDEX IF NOT EXISTS idx_receipt_cashier_date ON school_receipt(cashier_id, date);
CREATE INDEX IF NOT EXISTS idx_receipt_head_amount ON school_receipt_allocation(invoice_line_id, amount);

-- Dues & Follow-up
CREATE INDEX IF NOT EXISTS idx_invoice_due_status ON school_invoice(due_date, status) WHERE status IN ('issued', 'partly_paid');
CREATE INDEX IF NOT EXISTS idx_ledger_student_type_date ON school_ledger_entry(student_id, type, date);

-- Reconciliation
CREATE INDEX IF NOT EXISTS idx_bank_stmt_matched ON school_bank_statement_line(matched_flag, bank_account_id);
CREATE INDEX IF NOT EXISTS idx_gateway_settlement_status ON school_gateway_settlement(status, gateway);
CREATE INDEX IF NOT EXISTS idx_match_exception_resolved ON school_match_exception(status, resolved_at);

-- Accounts
CREATE INDEX IF NOT EXISTS idx_voucher_line_account_date ON school_voucher_line(account_id, voucher_id);
CREATE INDEX IF NOT EXISTS idx_account_balance ON school_account(current_balance) WHERE is_active = true;

-- Materialized View for Trial Balance (refresh hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trial_balance AS
SELECT
  a.code,
  a.name,
  a.type,
  COALESCE(SUM(vl.debit), 0) AS total_debit,
  COALESCE(SUM(vl.credit), 0) AS total_credit,
  a.opening_balance + COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) AS closing_balance
FROM school_account a
LEFT JOIN school_voucher_line vl ON vl.account_id = a.id
LEFT JOIN school_voucher v ON v.id = vl.voucher_id AND v.status = 'posted'
LEFT JOIN school_period p ON p.id = v.period_id
WHERE a.deleted_at IS NULL AND v.deleted_at IS NULL
GROUP BY a.id, a.code, a.name, a.type, a.opening_balance
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_trial_balance ON mv_trial_balance(code);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_fee_accounts_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trial_balance;
END;
$$;

-- Audit Trigger Function
CREATE OR REPLACE FUNCTION audit_fee_accounts_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  row_id   TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_json = to_jsonb(NEW);
    old_json = NULL;
    row_id = NEW.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json = to_jsonb(OLD);
    new_json = to_jsonb(NEW);
    row_id = NEW.id::text;
  ELSIF TG_OP = 'DELETE' THEN
    old_json = to_jsonb(OLD);
    new_json = NULL;
    row_id = OLD.id::text;
  END IF;

  INSERT INTO school_audit_log (
    app_id, entity, entity_id, action, before_json, after_json, user_id
  ) VALUES (
    coalesce(nullif(current_setting('app.current_app_id', true), ''), 'default'),
    TG_TABLE_NAME, row_id, TG_OP, old_json, new_json,
    current_setting('app.current_user_id', true)
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply audit triggers to money tables
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public'
           AND table_name IN (
             'school_fee_head', 'school_fee_category', 'school_fee_structure',
             'school_fee_structure_line', 'school_installment', 'school_fine_rule',
             'school_concession_type', 'school_student_fee_assignment',
             'school_family', 'school_family_member',
             'school_invoice', 'school_invoice_line', 'school_receipt',
             'school_receipt_allocation', 'school_cheque', 'school_online_payment',
             'school_cashier_day', 'school_ledger_entry',
             'school_reminder_rule', 'school_reminder_log', 'school_follow_up',
             'school_payment_plan', 'school_payment_plan_installment',
             'school_block_policy', 'school_student_block',
             'school_refund_rule', 'school_refund_request', 'school_refund_approval',
             'school_credit_note', 'school_deposit',
             'school_bank_statement_line', 'school_gateway_settlement',
             'school_gateway_settlement_line', 'school_match_exception',
             'school_cashier_day_exception',
             'school_account', 'school_voucher', 'school_voucher_line',
             'school_vendor', 'school_vendor_bill'
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

-- View for Fee Collection Report (Daily)
CREATE OR REPLACE VIEW v_fee_daily_collection AS
SELECT
  r.date,
  r.mode,
  COUNT(*) AS receipt_count,
  SUM(r.amount) AS total_amount,
  COUNT(CASE WHEN r.mode = 'cash' THEN 1 END) AS cash_count,
  SUM(CASE WHEN r.mode = 'cash' THEN r.amount ELSE 0 END) AS cash_amount,
  COUNT(CASE WHEN r.mode = 'cheque' THEN 1 END) AS cheque_count,
  SUM(CASE WHEN r.mode = 'cheque' THEN r.amount ELSE 0 END) AS cheque_amount,
  COUNT(CASE WHEN r.mode = 'online' THEN 1 END) AS online_count,
  SUM(CASE WHEN r.mode = 'online' THEN r.amount ELSE 0 END) AS online_amount
FROM school_receipt r
WHERE r.deleted_at IS NULL AND r.status IN ('issued', 'cleared')
GROUP BY r.date, r.mode
ORDER BY r.date, r.mode;

-- View for Head-wise Collection
CREATE OR REPLACE VIEW v_fee_head_wise_collection AS
SELECT
  fh.name AS head_name,
  fh.type AS head_type,
  COUNT(DISTINCT ra.receipt_id) AS receipt_count,
  SUM(ra.amount) AS total_amount
FROM school_receipt_allocation ra
JOIN school_invoice_line il ON il.id = ra.invoice_line_id
JOIN school_fee_head fh ON fh.id = il.head_id
JOIN school_receipt r ON r.id = ra.receipt_id
WHERE r.deleted_at IS NULL AND r.status IN ('issued', 'cleared')
GROUP BY fh.id, fh.name, fh.type
ORDER BY fh.sort_order, fh.name;

-- View for Ageing Report
CREATE OR REPLACE VIEW v_fee_ageing AS
SELECT
  s.id AS student_id,
  s.admission_no,
  s.first_name,
  s.last_name,
  c.name AS class_name,
  sec.name AS section_name,
  COALESCE(SUM(CASE WHEN i.due_date >= CURRENT_DATE - 30 THEN i.balance ELSE 0 END), 0) AS bucket_0_30,
  COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 30 AND i.due_date >= CURRENT_DATE - 60 THEN i.balance ELSE 0 END), 0) AS bucket_31_60,
  COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 60 AND i.due_date >= CURRENT_DATE - 90 THEN i.balance ELSE 0 END), 0) AS bucket_61_90,
  COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 90 THEN i.balance ELSE 0 END), 0) AS bucket_90_plus,
  COALESCE(SUM(i.balance), 0) AS total_due
FROM school_students s
JOIN school_invoice i ON i.student_id = s.id AND i.deleted_at IS NULL AND i.status IN ('issued', 'partly_paid')
LEFT JOIN school_classes c ON c.id = s.class_id
LEFT JOIN school_sections sec ON sec.id = s.section_id
WHERE s.deleted_at IS NULL AND s.status = 'active'
GROUP BY s.id, s.admission_no, s.first_name, s.last_name, c.name, sec.name
HAVING COALESCE(SUM(i.balance), 0) > 0;

-- Grant permissions for report views
GRANT SELECT ON v_fee_daily_collection TO PUBLIC;
GRANT SELECT ON v_fee_head_wise_collection TO PUBLIC;
GRANT SELECT ON v_fee_ageing TO PUBLIC;

COMMIT;