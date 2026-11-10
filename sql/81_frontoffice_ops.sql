-- ============================================================
-- Front Office — Operations Schema
-- Migration: sql/81_frontoffice_ops.sql
-- ============================================================
BEGIN;

INSERT INTO school_frontoffice_setting (app_id, key, value)
VALUES
  ('default','enquiry_lost_days','30'::jsonb),
  ('default','visitor_photo_required','true'::jsonb),
  ('default','appointment_slot_minutes','30'::jsonb),
  ('default','complaint_escalation_days','3'::jsonb)
ON CONFLICT (app_id,key) DO NOTHING;

COMMIT;
