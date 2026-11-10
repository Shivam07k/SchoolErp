-- ============================================================
-- LMS — Operations Schema
-- Migration: sql/81_lms_ops.sql
-- ============================================================
BEGIN;

-- Settings defaults
INSERT INTO school_lms_setting (app_id, setting_key, setting_value)
SELECT 'default', 'max_file_size_mb', '50'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_lms_setting WHERE app_id='default' AND setting_key='max_file_size_mb');

INSERT INTO school_lms_setting (app_id, setting_key, setting_value)
SELECT 'default', 'allowed_file_types', '["pdf","doc","docx","ppt","pptx","xls","xlsx","jpg","jpeg","png","mp4","mp3"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_lms_setting WHERE app_id='default' AND setting_key='allowed_file_types');

INSERT INTO school_lms_setting (app_id, setting_key, setting_value)
SELECT 'default', 'quiz_max_attempts', '3'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_lms_setting WHERE app_id='default' AND setting_key='quiz_max_attempts');

INSERT INTO school_lms_setting (app_id, setting_key, setting_value)
SELECT 'default', 'assignment_late_penalty_percent', '10'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_lms_setting WHERE app_id='default' AND setting_key='assignment_late_penalty_percent');

INSERT INTO school_lms_setting (app_id, setting_key, setting_value)
SELECT 'default', 'allow_resubmission', 'true'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_lms_setting WHERE app_id='default' AND setting_key='allow_resubmission');

INSERT INTO school_lms_setting (app_id, setting_key, setting_value)
SELECT 'default', 'video_hosting', '"local"'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM school_lms_setting WHERE app_id='default' AND setting_key='video_hosting');

COMMIT;