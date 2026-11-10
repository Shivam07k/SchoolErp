-- ============================================================
-- Events & PTM — Core Schema
-- Migration: sql/80_events_core.sql
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 1. Events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_event (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  title                 TEXT NOT NULL,
  description           TEXT,
  category              TEXT,
  start_dt              TIMESTAMPTZ NOT NULL,
  end_dt                TIMESTAMPTZ NOT NULL,
  venue                 TEXT,
  organizer_id          INT REFERENCES school_staff(id) ON DELETE SET NULL,
  max_participants      INT,
  registration_deadline TIMESTAMPTZ,
  reminder_days         INT[] DEFAULT '{1,3,7}',
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','registration_open','registration_closed','completed','cancelled')),
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_event_dates ON school_event(app_id, start_dt, end_dt) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_status ON school_event(app_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_event_audience (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  event_id          INT NOT NULL REFERENCES school_event(id) ON DELETE CASCADE,
  audience_type     TEXT NOT NULL CHECK (audience_type IN ('all','classes','sections','staff','parents')),
  class_id          INT REFERENCES school_classes(id) ON DELETE CASCADE,
  section_id        INT REFERENCES school_sections(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_audience_event ON school_event_audience(app_id, event_id);

-- ------------------------------------------------------------
-- 2. Event Registration & Attendance
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_event_registration (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  event_id        INT NOT NULL REFERENCES school_event(id) ON DELETE CASCADE,
  student_id      INT REFERENCES school_students(id) ON DELETE CASCADE,
  parent_id       INT REFERENCES school_guardians(id) ON DELETE CASCADE,
  registered_at   TIMESTAMPTZ DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','waitlisted','cancelled')),
  waitlist_pos    INT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_reg_student ON school_event_registration(app_id, event_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_reg_event ON school_event_registration(app_id, event_id, status);

CREATE TABLE IF NOT EXISTS school_event_attendance (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  event_id        INT NOT NULL REFERENCES school_event(id) ON DELETE CASCADE,
  student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'present' CHECK (attendance_status IN ('present','absent','excused')),
  marked_by       TEXT,
  marked_at       TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_att_student ON school_event_attendance(app_id, event_id, student_id);
CREATE INDEX IF NOT EXISTS idx_event_att_event ON school_event_attendance(app_id, event_id);

-- ------------------------------------------------------------
-- 3. PTM Schedule
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_ptm_schedule (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  session_id      INT NOT NULL REFERENCES school_academic_years(id) ON DELETE CASCADE,
  ptm_date        DATE NOT NULL,
  class_id        INT NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  section_id      INT REFERENCES school_sections(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','availability_open','booking_open','completed','cancelled')),
  booking_deadline DATE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ptm_schedule_date ON school_ptm_schedule(app_id, ptm_date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_ptm_slot (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  schedule_id     INT NOT NULL REFERENCES school_ptm_schedule(id) ON DELETE CASCADE,
  teacher_id      INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  max_bookings    INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','booked','blocked')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ptm_slot_schedule ON school_ptm_slot(app_id, schedule_id);
CREATE INDEX IF NOT EXISTS idx_ptm_slot_teacher ON school_ptm_slot(app_id, teacher_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_ptm_booking (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  slot_id         INT NOT NULL REFERENCES school_ptm_slot(id) ON DELETE CASCADE,
  student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  parent_id       INT REFERENCES school_guardians(id) ON DELETE CASCADE,
  booked_at       TIMESTAMPTZ DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','rescheduled','cancelled')),
  rescheduled_from INT REFERENCES school_ptm_booking(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ptm_booking_slot_student ON school_ptm_booking(app_id, slot_id, student_id) WHERE deleted_at IS NULL AND status = 'booked';
CREATE INDEX IF NOT EXISTS idx_ptm_booking_student ON school_ptm_booking(app_id, student_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_ptm_remarks (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  booking_id      INT NOT NULL REFERENCES school_ptm_booking(id) ON DELETE CASCADE,
  teacher_id      INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
  remarks         TEXT,
  followup_dt     DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptm_remarks_booking ON school_ptm_remarks(app_id, booking_id);

-- ------------------------------------------------------------
-- 3. Files (generic file storage)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_files (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  original_name   TEXT NOT NULL,
  stored_name     TEXT NOT NULL,
  mime_type       TEXT,
  file_size       BIGINT,
  storage_path    TEXT,
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_files_app ON school_files(app_id) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 4. Photo Gallery
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_gallery_album (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  event_id        INT REFERENCES school_event(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  visibility      TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','school','class','private')),
  class_id        INT REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id      INT REFERENCES school_sections(id) ON DELETE SET NULL,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gallery_album_event ON school_gallery_album(app_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gallery_album_class ON school_gallery_album(app_id, class_id, section_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_gallery_media (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  album_id        INT NOT NULL REFERENCES school_gallery_album(id) ON DELETE CASCADE,
  file_id         INT NOT NULL REFERENCES school_files(id) ON DELETE CASCADE,
  media_type      TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  uploaded_by     TEXT,
  approved        BOOLEAN DEFAULT false,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gallery_media_album ON school_gallery_media(app_id, album_id, approved) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 5. Settings, Notifications, Audit
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_events_setting (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  setting_key     TEXT NOT NULL,
  setting_value   TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_setting ON school_events_setting(app_id, setting_key);

CREATE TABLE IF NOT EXISTS school_events_notification (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  kind            TEXT NOT NULL,
  event_id        INT,
  ptm_schedule_id INT,
  album_id        INT,
  recipient_type  TEXT,
  recipient_id    INT,
  title           TEXT,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_notif_app ON school_events_notification(app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_events_audit (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  user_id         TEXT,
  action          TEXT,
  entity          TEXT,
  entity_id       INT,
  before_json     JSONB,
  after_json      JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_audit_app ON school_events_audit(app_id, created_at DESC);

COMMIT;