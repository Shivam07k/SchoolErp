-- ============================================================
-- Alumni & Placement — Core Schema
-- Migration: sql/80_alumni_core.sql
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 1. Alumni Directory
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_alumni (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  passing_year          INT NOT NULL,
  last_class_id         INT REFERENCES school_classes(id) ON DELETE SET NULL,
  session_id            INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending_registration' CHECK (status IN ('pending_registration','active','verified','inactive')),
  registered_at         TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ,
  verified_by           INT REFERENCES school_staff(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_student ON school_alumni(app_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_status ON school_alumni(app_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_passing_year ON school_alumni(app_id, passing_year) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_alumni_profile (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  alumni_id             INT NOT NULL REFERENCES school_alumni(id) ON DELETE CASCADE,
  company               TEXT,
  designation           TEXT,
  industry              TEXT,
  location              TEXT,
  linkedin_url          TEXT,
  privacy_level         TEXT NOT NULL DEFAULT 'alumni_only' CHECK (privacy_level IN ('public','alumni_only','private')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_profile ON school_alumni_profile(app_id, alumni_id);

CREATE TABLE IF NOT EXISTS school_alumni_education (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  alumni_id             INT NOT NULL REFERENCES school_alumni(id) ON DELETE CASCADE,
  qualification         TEXT NOT NULL,
  institution           TEXT,
  passing_year          INT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alumni_education_alumni ON school_alumni_education(app_id, alumni_id);

-- ------------------------------------------------------------
-- 2. Alumni Events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_alumni_event (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  title                 TEXT NOT NULL,
  description           TEXT,
  event_type            TEXT NOT NULL DEFAULT 'meet' CHECK (event_type IN ('meet','reunion','guest_lecture','career_guidance','workshop','custom')),
  start_dt              TIMESTAMPTZ NOT NULL,
  end_dt                TIMESTAMPTZ NOT NULL,
  venue                 TEXT,
  max_capacity          INT,
  registration_fee      NUMERIC(12,2) DEFAULT 0,
  reg_open_dt           TIMESTAMPTZ,
  reg_close_dt          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','registration_open','registration_closed','completed','cancelled')),
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alumni_event_dates ON school_alumni_event(app_id, start_dt, end_dt) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_event_status ON school_alumni_event(app_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_alumni_event_registration (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  event_id              INT NOT NULL REFERENCES school_alumni_event(id) ON DELETE CASCADE,
  alumni_id             INT NOT NULL REFERENCES school_alumni(id) ON DELETE CASCADE,
  registered_at         TIMESTAMPTZ DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','waitlisted','cancelled')),
  payment_status        TEXT NOT NULL DEFAULT 'not_required' CHECK (payment_status IN ('not_required','pending','paid','failed','refunded')),
  payment_ref           TEXT,
  attended              BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_event_reg ON school_alumni_event_registration(app_id, event_id, alumni_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alumni_event_reg_event ON school_alumni_event_registration(app_id, event_id, status);

CREATE TABLE IF NOT EXISTS school_alumni_event_feedback (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  event_id              INT NOT NULL REFERENCES school_alumni_event(id) ON DELETE CASCADE,
  alumni_id             INT NOT NULL REFERENCES school_alumni(id) ON DELETE CASCADE,
  rating                INT CHECK (rating BETWEEN 1 AND 5),
  comments              TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_event_feedback ON school_alumni_event_feedback(app_id, event_id, alumni_id);

-- ------------------------------------------------------------
-- 3. Job Postings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_job_posting (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  posted_by_alumni_id   INT REFERENCES school_alumni(id) ON DELETE SET NULL,
  company               TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL,
  employment_type       TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','internship','contract','freelance')),
  experience_required   TEXT,
  qualification         TEXT,
  skills                TEXT[], -- array of skill tags
  location              TEXT,
  salary_min            NUMERIC(12,2),
  salary_max            NUMERIC(12,2),
  deadline              TIMESTAMPTZ NOT NULL,
  contact_email         TEXT,
  contact_phone         TEXT,
  apply_url             TEXT,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','active','expired','closed')),
  approved_by           INT REFERENCES school_staff(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_job_posting_status ON school_job_posting(app_id, status, deadline) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_posting_company ON school_job_posting(app_id, company) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_posting_location ON school_job_posting(app_id, location) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_job_application (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  job_id                INT NOT NULL REFERENCES school_job_posting(id) ON DELETE CASCADE,
  alumni_id             INT NOT NULL REFERENCES school_alumni(id) ON DELETE CASCADE,
  applied_at            TIMESTAMPTZ DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','shortlisted','interviewed','selected','rejected','withdrawn')),
  resume_file_id        INT REFERENCES school_files(id) ON DELETE SET NULL,
  cover_letter          TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_application ON school_job_application(app_id, job_id, alumni_id);
CREATE INDEX IF NOT EXISTS idx_job_app_job ON school_job_application(app_id, job_id, status);
CREATE INDEX IF NOT EXISTS idx_job_app_alumni ON school_job_application(app_id, alumni_id);

-- ------------------------------------------------------------
-- 4. Donations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_donation_campaign (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  title                 TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general','infrastructure','scholarship','library','sports','custom')),
  target_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  collected_amount      NUMERIC(12,2) DEFAULT 0,
  start_dt              TIMESTAMPTZ NOT NULL,
  end_dt                TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','closed')),
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_donation_campaign_status ON school_donation_campaign(app_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_donation (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  campaign_id           INT NOT NULL REFERENCES school_donation_campaign(id) ON DELETE CASCADE,
  donor_id              INT REFERENCES school_alumni(id) ON DELETE SET NULL,
  donor_type            TEXT NOT NULL DEFAULT 'alumni' CHECK (donor_type IN ('alumni','parent','staff','other')),
  donor_name            TEXT,
  donor_email           TEXT,
  donor_phone           TEXT,
  amount                NUMERIC(12,2) NOT NULL,
  payment_mode          TEXT NOT NULL DEFAULT 'online' CHECK (payment_mode IN ('online','bank_transfer','cheque','cash')),
  payment_ref           TEXT,
  payment_gateway       TEXT,
  status                TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','successful','failed','refunded','cancelled')),
  is_anonymous          BOOLEAN DEFAULT false,
  donated_at            TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donation_campaign ON school_donation(app_id, campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_donation_donor ON school_donation(app_id, donor_id, status) WHERE donor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS school_donation_receipt (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  donation_id           INT NOT NULL REFERENCES school_donation(id) ON DELETE CASCADE,
  receipt_no            TEXT NOT NULL,
  issue_date            TIMESTAMPTZ DEFAULT now(),
  file_id               INT REFERENCES school_files(id) ON DELETE SET NULL,
  generated_by          TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_donation_receipt_no ON school_donation_receipt(app_id, receipt_no);
CREATE INDEX IF NOT EXISTS idx_donation_receipt_donation ON school_donation_receipt(app_id, donation_id);

-- ------------------------------------------------------------
-- 5. Settings, Notifications, Audit
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_alumni_setting (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  setting_key           TEXT NOT NULL,
  setting_value         TEXT,
  description           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alumni_setting ON school_alumni_setting(app_id, setting_key);

CREATE TABLE IF NOT EXISTS school_alumni_notification (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  kind                  TEXT NOT NULL,
  alumni_id             INT REFERENCES school_alumni(id) ON DELETE SET NULL,
  event_id              INT REFERENCES school_alumni_event(id) ON DELETE SET NULL,
  job_id                INT REFERENCES school_job_posting(id) ON DELETE SET NULL,
  donation_id           INT REFERENCES school_donation(id) ON DELETE SET NULL,
  recipient_type        TEXT,
  recipient_id          INT,
  title                 TEXT,
  message               TEXT,
  status                TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alumni_notif_app ON school_alumni_notification(app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_alumni_audit (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  user_id               TEXT,
  action                TEXT,
  entity                TEXT,
  entity_id             INT,
  before_json           JSONB,
  after_json            JSONB,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alumni_audit_app ON school_alumni_audit(app_id, created_at DESC);

COMMIT;