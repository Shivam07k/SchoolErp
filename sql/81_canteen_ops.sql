-- ============================================================
-- Canteen — Operations Schema
-- Migration: sql/81_canteen_ops.sql
-- ============================================================
BEGIN;

INSERT INTO school_canteen_setting (app_id, setting_key, setting_value)
SELECT 'default', 'daily_limit_student', '200'
WHERE NOT EXISTS (SELECT 1 FROM school_canteen_setting WHERE app_id='default' AND setting_key='daily_limit_student');

INSERT INTO school_canteen_setting (app_id, setting_key, setting_value)
SELECT 'default', 'wallet_refund_on_exit', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_canteen_setting WHERE app_id='default' AND setting_key='wallet_refund_on_exit');

INSERT INTO school_canteen_setting (app_id, setting_key, setting_value)
SELECT 'default', 'preorder_cutoff_hours', '2'
WHERE NOT EXISTS (SELECT 1 FROM school_canteen_setting WHERE app_id='default' AND setting_key='preorder_cutoff_hours');

INSERT INTO school_canteen_setting (app_id, setting_key, setting_value)
SELECT 'default', 'tax_rate', '5'
WHERE NOT EXISTS (SELECT 1 FROM school_canteen_setting WHERE app_id='default' AND setting_key='tax_rate');

INSERT INTO school_canteen_setting (app_id, setting_key, setting_value)
SELECT 'default', 'stock_method', 'recipe'
WHERE NOT EXISTS (SELECT 1 FROM school_canteen_setting WHERE app_id='default' AND setting_key='stock_method');

COMMIT;