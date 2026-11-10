-- ============================================================
-- Alumni & Placement — Operations Schema
-- Migration: sql/81_alumni_ops.sql
-- ============================================================
BEGIN;

-- Settings defaults
INSERT INTO school_alumni_setting (app_id, setting_key, setting_value)
SELECT 'default', 'auto_create_alumni_on_tc', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_alumni_setting WHERE app_id='default' AND setting_key='auto_create_alumni_on_tc');

INSERT INTO school_alumni_setting (app_id, setting_key, setting_value)
SELECT 'default', 'alumni_verification_required', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_alumni_setting WHERE app_id='default' AND setting_key='alumni_verification_required');

INSERT INTO school_alumni_setting (app_id, setting_key, setting_value)
SELECT 'default', 'job_approval_required', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_alumni_setting WHERE app_id='default' AND setting_key='job_approval_required');

INSERT INTO school_alumni_setting (app_id, setting_key, setting_value)
SELECT 'default', 'job_auto_expire_on_deadline', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_alumni_setting WHERE app_id='default' AND setting_key='job_auto_expire_on_deadline');

INSERT INTO school_alumni_setting (app_id, setting_key, setting_value)
SELECT 'default', 'donation_payment_gateway', 'razorpay'
WHERE NOT EXISTS (SELECT 1 FROM school_alumni_setting WHERE app_id='default' AND setting_key='donation_payment_gateway');

INSERT INTO school_alumni_setting (app_id, setting_key, setting_value)
SELECT 'default', 'receipt_template_id', '1'
WHERE NOT EXISTS (SELECT 1 FROM school_alumni_setting WHERE app_id='default' AND setting_key='receipt_template_id');

INSERT INTO school_alumni_setting (app_id, setting_key, setting_value)
SELECT 'default', 'include_80g_on_receipt', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_alumni_setting WHERE app_id='default' AND setting_key='include_80g_on_receipt');

COMMIT;