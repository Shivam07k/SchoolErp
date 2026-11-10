-- ============================================================
-- Library — Operations Schema
-- Migration: sql/81_library_ops.sql
-- ============================================================
BEGIN;

-- Settings defaults
INSERT INTO school_library_setting (app_id, setting_key, setting_value)
SELECT 'default', 'loan_days_student', '14'
WHERE NOT EXISTS (SELECT 1 FROM school_library_setting WHERE app_id='default' AND setting_key='loan_days_student');

INSERT INTO school_library_setting (app_id, setting_key, setting_value)
SELECT 'default', 'loan_days_staff', '30'
WHERE NOT EXISTS (SELECT 1 FROM school_library_setting WHERE app_id='default' AND setting_key='loan_days_staff');

INSERT INTO school_library_setting (app_id, setting_key, setting_value)
SELECT 'default', 'max_books_student', '3'
WHERE NOT EXISTS (SELECT 1 FROM school_library_setting WHERE app_id='default' AND setting_key='max_books_student');

INSERT INTO school_library_setting (app_id, setting_key, setting_value)
SELECT 'default', 'max_books_staff', '10'
WHERE NOT EXISTS (SELECT 1 FROM school_library_setting WHERE app_id='default' AND setting_key='max_books_staff');

INSERT INTO school_library_setting (app_id, setting_key, setting_value)
SELECT 'default', 'fine_per_day', '1'
WHERE NOT EXISTS (SELECT 1 FROM school_library_setting WHERE app_id='default' AND setting_key='fine_per_day');

INSERT INTO school_library_setting (app_id, setting_key, setting_value)
SELECT 'default', 'grace_days', '2'
WHERE NOT EXISTS (SELECT 1 FROM school_library_setting WHERE app_id='default' AND setting_key='grace_days');

INSERT INTO school_library_setting (app_id, setting_key, setting_value)
SELECT 'default', 'max_fine_cap', '500'
WHERE NOT EXISTS (SELECT 1 FROM school_library_setting WHERE app_id='default' AND setting_key='max_fine_cap');

COMMIT;
