-- ============================================================
-- Hostel & Residential Life — Operations Schema (Step 4–6)
-- Migration: sql/81_hostel_ops.sql
-- ============================================================
-- Creates settings, notifications, roll calls, leave passes, gate log,
-- duty roster, incidents, complaints, visitors, authorised visitors,
-- visit rules and blacklist.
-- Safe to re-run: every object is IF NOT EXISTS.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Settings and notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel_setting (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL DEFAULT 'default',
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, key)
);

CREATE TABLE IF NOT EXISTS school_hostel_notification (
  id              BIGSERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  kind            TEXT NOT NULL,
  student_id      INT REFERENCES school_students(id) ON DELETE CASCADE,
  allocation_id   INT REFERENCES school_hostel_allocation(id) ON DELETE SET NULL,
  recipient_role  TEXT,
  recipient       TEXT,
  title           TEXT NOT NULL,
  message         TEXT,
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'read', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  sent_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hostel_notif_app ON school_hostel_notification(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hostel_notif_student ON school_hostel_notification(app_id, student_id, status);

-- ------------------------------------------------------------
-- 2. Roll calls
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel_roll_call (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL DEFAULT 'default',
  hostel_id   INT NOT NULL REFERENCES school_hostel(id) ON DELETE CASCADE,
  block_id    INT REFERENCES school_hostel_block(id) ON DELETE SET NULL,
  call_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  session     TEXT NOT NULL DEFAULT 'night' CHECK (session IN ('morning', 'evening', 'night')),
  taken_by    TEXT,
  taken_at    TIMESTAMPTZ,
  source      TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'offline')),
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'locked')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, hostel_id, call_date, session)
);
CREATE INDEX IF NOT EXISTS idx_hostel_rollcall_date ON school_hostel_roll_call(app_id, call_date DESC, session);

CREATE TABLE IF NOT EXISTS school_hostel_roll_call_entry (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  roll_call_id      INT NOT NULL REFERENCES school_hostel_roll_call(id) ON DELETE CASCADE,
  student_id        INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  allocation_id     INT REFERENCES school_hostel_allocation(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'on_leave', 'sick_bay', 'late')),
  remark            TEXT,
  corrected_by      TEXT,
  corrected_at      TIMESTAMPTZ,
  correction_reason TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (roll_call_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_hostel_rollcall_entry_student ON school_hostel_roll_call_entry(app_id, student_id);

-- ------------------------------------------------------------
-- 3. Leave passes and gate log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel_leave_pass (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  pass_no             TEXT NOT NULL,
  student_id          INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  allocation_id       INT REFERENCES school_hostel_allocation(id) ON DELETE SET NULL,
  type                TEXT NOT NULL DEFAULT 'outpass' CHECK (type IN ('outpass', 'home_leave', 'medical', 'vacation')),
  from_date           DATE NOT NULL,
  to_date             DATE NOT NULL,
  from_time           TIME,
  to_time             TIME,
  destination         TEXT,
  reason              TEXT,
  guardian_otp        TEXT,
  guardian_approved_at TIMESTAMPTZ,
  requested_by        TEXT,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'guardian_approved', 'approved', 'out', 'returned', 'overdue', 'rejected', 'cancelled')),
  actual_out          TIMESTAMPTZ,
  actual_in           TIMESTAMPTZ,
  gate_out_by         TEXT,
  gate_in_by          TEXT,
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, pass_no)
);
CREATE INDEX IF NOT EXISTS idx_hostel_pass_student ON school_hostel_leave_pass(app_id, student_id, status);
CREATE INDEX IF NOT EXISTS idx_hostel_pass_dates ON school_hostel_leave_pass(app_id, from_date, to_date, status);

CREATE TABLE IF NOT EXISTS school_hostel_gate_log (
  id            BIGSERIAL PRIMARY KEY,
  app_id        TEXT NOT NULL DEFAULT 'default',
  student_id    INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  allocation_id INT REFERENCES school_hostel_allocation(id) ON DELETE SET NULL,
  leave_pass_id INT REFERENCES school_hostel_leave_pass(id) ON DELETE SET NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('out', 'in')),
  log_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'qr', 'biometric', 'gate')),
  guard_user    TEXT,
  vehicle_no    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_gate_student ON school_hostel_gate_log(app_id, student_id, log_time DESC);
CREATE INDEX IF NOT EXISTS idx_hostel_gate_time ON school_hostel_gate_log(app_id, log_time DESC);

-- ------------------------------------------------------------
-- 4. Duty, incidents, complaints
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel_duty (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  hostel_id           INT NOT NULL REFERENCES school_hostel(id) ON DELETE CASCADE,
  staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
  duty_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  shift               TEXT NOT NULL DEFAULT 'night' CHECK (shift IN ('morning', 'evening', 'night', 'full_day')),
  substitute_staff_id INT REFERENCES school_staff(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'present', 'absent', 'substituted', 'completed')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, hostel_id, duty_date, shift)
);
CREATE INDEX IF NOT EXISTS idx_hostel_duty_date ON school_hostel_duty(app_id, duty_date DESC);

CREATE TABLE IF NOT EXISTS school_hostel_incident (
  id            SERIAL PRIMARY KEY,
  app_id        TEXT NOT NULL DEFAULT 'default',
  student_id    INT REFERENCES school_students(id) ON DELETE SET NULL,
  room_id       INT REFERENCES school_hostel_room(id) ON DELETE SET NULL,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type          TEXT NOT NULL,
  description   TEXT NOT NULL,
  action_taken  TEXT,
  severity      TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reported_by   TEXT,
  visibility    TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'guardian', 'principal')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_incident_date ON school_hostel_incident(app_id, incident_date DESC, severity);

CREATE TABLE IF NOT EXISTS school_hostel_complaint (
  id            SERIAL PRIMARY KEY,
  app_id        TEXT NOT NULL DEFAULT 'default',
  student_id    INT REFERENCES school_students(id) ON DELETE SET NULL,
  raised_by     TEXT,
  category      TEXT NOT NULL DEFAULT 'general',
  description   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'escalated', 'resolved', 'closed')),
  escalated_to  TEXT,
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_complaint_status ON school_hostel_complaint(app_id, status, created_at DESC);

-- ------------------------------------------------------------
-- 5. Visitors
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel_visitor (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL DEFAULT 'default',
  name        TEXT NOT NULL,
  phone       TEXT,
  id_type     TEXT,
  id_number   TEXT,
  photo_url   TEXT,
  relation    TEXT,
  address     TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hostel_visitor_phone ON school_hostel_visitor(app_id, phone) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_authorised_visitor (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  visitor_id      INT NOT NULL REFERENCES school_hostel_visitor(id) ON DELETE CASCADE,
  relation        TEXT,
  allowed_days    TEXT[] DEFAULT '{0,1,2,3,4,5,6}',
  valid_till      DATE,
  is_active       BOOLEAN DEFAULT true,
  approved_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_auth_visitor ON school_hostel_authorised_visitor(app_id, student_id, visitor_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hostel_auth_student ON school_hostel_authorised_visitor(app_id, student_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS school_hostel_visit_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  hostel_id         INT NOT NULL REFERENCES school_hostel(id) ON DELETE CASCADE,
  days              TEXT[] DEFAULT '{0,1,2,3,4,5,6}',
  start_time        TIME DEFAULT '09:00',
  end_time          TIME DEFAULT '18:00',
  max_duration_min  INT DEFAULT 60,
  max_visitors      INT DEFAULT 3,
  areas             TEXT[] DEFAULT '{"visiting_area"}',
  id_required       BOOLEAN DEFAULT true,
  allow_overnight   BOOLEAN DEFAULT false,
  notes             TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, hostel_id)
);

CREATE TABLE IF NOT EXISTS school_hostel_visitor_entry (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  visitor_id        INT NOT NULL REFERENCES school_hostel_visitor(id) ON DELETE CASCADE,
  student_id        INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  hostel_id         INT REFERENCES school_hostel(id) ON DELETE SET NULL,
  purpose           TEXT,
  pre_registered_by TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  in_time           TIMESTAMPTZ,
  out_time          TIMESTAMPTZ,
  badge_no          TEXT,
  items_carried     TEXT,
  area              TEXT,
  status            TEXT NOT NULL DEFAULT 'pre_registered' CHECK (status IN ('pre_registered', 'approved', 'checked_in', 'checked_out', 'denied', 'cancelled')),
  denial_reason     TEXT,
  host_notified_at  TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_visit_entry_status ON school_hostel_visitor_entry(app_id, status, in_time DESC);
CREATE INDEX IF NOT EXISTS idx_hostel_visit_entry_student ON school_hostel_visitor_entry(app_id, student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_hostel_blacklist (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  visitor_id      INT NOT NULL REFERENCES school_hostel_visitor(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  blacklisted_by  TEXT,
  blacklisted_at  TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT true,
  lifted_at       TIMESTAMPTZ,
  lifted_by       TEXT,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_hostel_blacklist_active ON school_hostel_blacklist(app_id, visitor_id) WHERE is_active = true;

COMMIT;
