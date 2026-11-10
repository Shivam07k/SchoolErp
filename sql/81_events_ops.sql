-- ============================================================
-- Events & PTM — Operations Schema
-- Migration: sql/81_events_ops.sql
-- ============================================================
BEGIN;

-- Settings defaults
INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'default_reminder_days', '[1,3,7]'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='default_reminder_days');

INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'ptm_slot_minutes', '15'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='ptm_slot_minutes');

INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'booking_deadline_days', '2'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='booking_deadline_days');

INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'max_waitlist_size', '10'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='max_waitlist_size');

INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'gallery_approval_required', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='gallery_approval_required');

INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'media_max_size_mb', '10'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='media_max_size_mb');

INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'allow_parent_ptm_booking', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='allow_parent_ptm_booking');

INSERT INTO school_events_setting (app_id, setting_key, setting_value)
SELECT 'default', 'auto_cancel_waitlist_on_event_cancel', 'true'
WHERE NOT EXISTS (SELECT 1 FROM school_events_setting WHERE app_id='default' AND setting_key='auto_cancel_waitlist_on_event_cancel');

COMMIT;