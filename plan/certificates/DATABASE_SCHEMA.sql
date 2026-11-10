-- ============================================================
-- Certificates & ID Management — Core Schema
-- Migration: sql/80_certificates_core.sql
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 1. Document Templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_document_template (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL CHECK (type IN ('id_front','id_back','tc','bonafide','character','migration','custom')),
  category              TEXT,
  version               INT NOT NULL DEFAULT 1,
  background_file_id    INT REFERENCES school_files(id) ON DELETE SET NULL,
  canvas_json           JSONB, -- Fabric.js canvas state
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_name_version ON school_document_template(app_id, name, version) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_template_type ON school_document_template(app_id, type) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_template_field (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  template_id           INT NOT NULL REFERENCES school_document_template(id) ON DELETE CASCADE,
  field_key             TEXT NOT NULL, -- e.g., student.name, school.logo, qr_code
  x                     NUMERIC(8,2) NOT NULL,
  y                     NUMERIC(8,2) NOT NULL,
  width                 NUMERIC(8,2),
  height                NUMERIC(8,2),
  font_family           TEXT DEFAULT 'Arial',
  font_size             NUMERIC(6,2) DEFAULT 12,
  font_weight           TEXT DEFAULT 'normal',
  font_style            TEXT DEFAULT 'normal',
  color                 TEXT DEFAULT '#000000',
  alignment             TEXT DEFAULT 'left' CHECK (alignment IN ('left','center','right')),
  is_dynamic            BOOLEAN DEFAULT false,
  source_table          TEXT, -- e.g., school_students, school_guardians, school_staff
  source_field          TEXT, -- e.g., first_name, name, photo_url
  transform             TEXT, -- e.g., 'uppercase', 'date_format:DD/MM/YYYY'
  default_value         TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_template_field_template ON school_template_field(app_id, template_id);

-- ------------------------------------------------------------
-- 2. Certificate Generation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_certificate_request (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  template_id           INT NOT NULL REFERENCES school_document_template(id) ON DELETE RESTRICT,
  request_type          TEXT NOT NULL CHECK (request_type IN ('id_card','tc','bonafide','character','migration','custom')),
  reason                TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cleared','approved','rejected','generated')),
  requested_by          TEXT,
  requested_at          TIMESTAMPTZ DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cert_req_student ON school_certificate_request(app_id, student_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cert_req_type ON school_certificate_request(app_id, request_type, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_certificate_approval (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  request_id            INT NOT NULL REFERENCES school_certificate_request(id) ON DELETE CASCADE,
  approver_id           INT REFERENCES school_staff(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  remarks               TEXT,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_approval_request ON school_certificate_approval(app_id, request_id);

CREATE TABLE IF NOT EXISTS school_generated_document (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  request_id            INT NOT NULL REFERENCES school_certificate_request(id) ON DELETE CASCADE,
  certificate_no        TEXT NOT NULL,
  template_id           INT NOT NULL REFERENCES school_document_template(id) ON DELETE RESTRICT,
  template_version      INT NOT NULL,
  file_id               INT NOT NULL REFERENCES school_files(id) ON DELETE CASCADE,
  generated_by          TEXT,
  generated_at          TIMESTAMPTZ DEFAULT now(),
  is_reissue            BOOLEAN DEFAULT false,
  original_doc_id       INT REFERENCES school_generated_document(id) ON DELETE SET NULL,
  reissue_reason        TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gen_doc_cert_no ON school_generated_document(app_id, certificate_no);
CREATE INDEX IF NOT EXISTS idx_gen_doc_request ON school_generated_document(app_id, request_id);

-- ------------------------------------------------------------
-- 3. ID Cards
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_id_card (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  session_id            INT NOT NULL REFERENCES school_academic_years(id) ON DELETE CASCADE,
  front_template_id     INT REFERENCES school_document_template(id) ON DELETE SET NULL,
  back_template_id      INT REFERENCES school_document_template(id) ON DELETE SET NULL,
  issue_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date           DATE,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','reissued','lost','damaged','expired')),
  issued_by             TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_id_card_student_session ON school_id_card(app_id, student_id, session_id) WHERE deleted_at IS NULL AND status IN ('active','reissued');
CREATE INDEX IF NOT EXISTS idx_id_card_session ON school_id_card(app_id, session_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_id_card_history (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  id_card_id            INT NOT NULL REFERENCES school_id_card(id) ON DELETE CASCADE,
  action                TEXT NOT NULL CHECK (action IN ('issued','reissued','reprinted','reported_lost','reported_damaged')),
  action_date           TIMESTAMPTZ DEFAULT now(),
  reason                TEXT,
  action_by             TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_id_card_hist_card ON school_id_card_history(app_id, id_card_id);

-- ------------------------------------------------------------
-- 4. TC Certificate
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_tc_request (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  leaving_date          DATE NOT NULL,
  reason                TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','clearance_pending','cleared','approved','rejected','generated')),
  requested_by          TEXT,
  requested_at          TIMESTAMPTZ DEFAULT now(),
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tc_req_student ON school_tc_request(app_id, student_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_tc_approval (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  tc_request_id         INT NOT NULL REFERENCES school_tc_request(id) ON DELETE CASCADE,
  approver_id           INT REFERENCES school_staff(id) ON DELETE SET NULL,
  clearance_fee         BOOLEAN DEFAULT false,
  clearance_library     BOOLEAN DEFAULT false,
  clearance_hostel      BOOLEAN DEFAULT false,
  clearance_lab         BOOLEAN DEFAULT false,
  clearance_custom      JSONB DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  tc_number             TEXT,
  remarks               TEXT,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tc_approval_request ON school_tc_approval(app_id, tc_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tc_number ON school_tc_approval(app_id, tc_number) WHERE tc_number IS NOT NULL;

-- ------------------------------------------------------------
-- 5. Certificate Register
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_certificate_register (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  certificate_no        TEXT NOT NULL,
  certificate_type      TEXT NOT NULL CHECK (certificate_type IN ('id_card','tc','bonafide','character','migration','custom')),
  template_id           INT REFERENCES school_document_template(id) ON DELETE SET NULL,
  template_version      INT,
  issue_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  status                TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','reissued','cancelled')),
  generated_by          TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_reg_cert_no ON school_certificate_register(app_id, certificate_no);
CREATE INDEX IF NOT EXISTS idx_cert_reg_student ON school_certificate_register(app_id, student_id, certificate_type);

-- ------------------------------------------------------------
-- 5. Settings, Notifications, Audit
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_certificates_setting (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  setting_key           TEXT NOT NULL,
  setting_value         TEXT,
  description           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_setting ON school_certificates_setting(app_id, setting_key);

CREATE TABLE IF NOT EXISTS school_certificates_notification (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  kind                  TEXT NOT NULL,
  request_id            INT,
  tc_request_id         INT,
  id_card_id            INT,
  recipient_type        TEXT,
  recipient_id          INT,
  title                 TEXT,
  message               TEXT,
  status                TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cert_notif_app ON school_certificates_notification(app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_certificates_audit (
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
CREATE INDEX IF NOT EXISTS idx_cert_audit_app ON school_certificates_audit(app_id, created_at DESC);

COMMIT;