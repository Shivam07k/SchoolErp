-- ============================================================
-- Communication — Operations Schema
-- Migration: sql/81_communication_ops.sql
-- ============================================================
BEGIN;

-- Settings defaults
INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'sms_provider', '{"provider":"twilio","account_sid":"","auth_token":"","from_number":""}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='sms_provider');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'email_provider', '{"provider":"smtp","host":"","port":587,"secure":true,"user":"","pass":"","from_email":"","from_name":""}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='email_provider');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'push_provider', '{"provider":"firebase","server_key":"","sender_id":""}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='push_provider');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'default_sms_template', '"Dear {{parent_name}}, {{message}}"'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='default_sms_template');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'default_email_template', '"<p>Dear {{parent_name}},</p><p>{{message}}</p>"'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='default_email_template');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'quiet_hours_start', '"22:00"'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='quiet_hours_start');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'quiet_hours_end', '"07:00"'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='quiet_hours_end');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'max_sms_per_minute', '10'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='max_sms_per_minute');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'max_email_per_minute', '50'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='max_email_per_minute');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'retry_attempts', '3'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='retry_attempts');

INSERT INTO school_communication_setting (app_id, setting_key, setting_value)
SELECT 'default', 'retry_delay_minutes', '5'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_communication_setting WHERE app_id='default' AND setting_key='retry_delay_minutes');

COMMIT;