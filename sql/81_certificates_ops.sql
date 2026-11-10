-- ============================================================
-- Certificates & ID — Operations Schema
-- Migration: sql/81_certificates_ops.sql
-- ============================================================
BEGIN;

-- Settings defaults
INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'certificate_number_format', 'TC-{SESSION}-{SEQ:05d}'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='certificate_number_format');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'id_card_validity_months', '12'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='id_card_validity_months');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'tc_clearance_fee', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='tc_clearance_fee');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'tc_clearance_library', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='tc_clearance_library');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'tc_clearance_hostel', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='tc_clearance_hostel');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'tc_clearance_lab', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='tc_clearance_lab');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'tc_approval_required', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='tc_approval_required');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'default_tc_template_id', '1'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='default_tc_template_id');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'id_card_qr_enabled', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='id_card_qr_enabled');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'id_card_barcode_enabled', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='id_card_barcode_enabled');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'photo_required_for_id', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='photo_required_for_id');

INSERT INTO school_certificates_setting (app_id, setting_key, setting_value)
SELECT 'default', 'photo_fallback_placeholder', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_certificates_setting WHERE app_id='default' AND setting_key='photo_fallback_placeholder');

COMMIT;