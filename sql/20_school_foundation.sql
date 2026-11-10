/* ============================================================
   School / College ERP - Foundation
   Campuses, settings, roles/permissions, families/guardians,
   documents, session enrollments and audit trail.
   Safe to re-run.
   ============================================================ */

BEGIN;

CREATE TABLE IF NOT EXISTS school_campuses (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL DEFAULT 'default',
  name          text NOT NULL,
  code          text,
  type          text NOT NULL DEFAULT 'campus',
  address       text,
  phone         text,
  email         text,
  head_user_id  text,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, code)
);

CREATE TABLE IF NOT EXISTS school_settings (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  campus_id   integer REFERENCES school_campuses(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_settings_scope
  ON school_settings (app_id, coalesce(campus_id, 0), key);

CREATE TABLE IF NOT EXISTS school_families (
  id                  serial PRIMARY KEY,
  app_id              text NOT NULL DEFAULT 'default',
  name                text NOT NULL DEFAULT '',
  primary_guardian_id integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_guardians (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  family_id   integer REFERENCES school_families(id) ON DELETE SET NULL,
  name        text NOT NULL,
  relation    text,
  phone       text,
  email       text,
  occupation  text,
  address     text,
  user_id     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_student_guardians (
  student_id    integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  guardian_id   integer NOT NULL REFERENCES school_guardians(id) ON DELETE CASCADE,
  relation      text,
  is_primary    boolean NOT NULL DEFAULT false,
  is_emergency  boolean NOT NULL DEFAULT false,
  can_pickup    boolean NOT NULL DEFAULT true,
  is_fee_payer  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (student_id, guardian_id)
);

CREATE TABLE IF NOT EXISTS school_document_types (
  id              serial PRIMARY KEY,
  app_id          text NOT NULL DEFAULT 'default',
  name            text NOT NULL,
  required_for    text NOT NULL DEFAULT 'student',
  expiry_required boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  UNIQUE (app_id, name)
);

CREATE TABLE IF NOT EXISTS school_student_documents (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  student_id        integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  document_type_id  integer REFERENCES school_document_types(id) ON DELETE SET NULL,
  file_name         text NOT NULL,
  file_url          text,
  status            text NOT NULL DEFAULT 'pending',
  expires_on        date,
  verified_by       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_student_enrollments (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  student_id        integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  academic_year_id  integer REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_id          integer REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id        integer REFERENCES school_sections(id) ON DELETE SET NULL,
  roll_no           text,
  status            text NOT NULL DEFAULT 'studying',
  joined_on         date,
  left_on           date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, student_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS school_roles (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  name        text NOT NULL,
  code        text NOT NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, code)
);

CREATE TABLE IF NOT EXISTS school_permissions (
  key         text PRIMARY KEY,
  module      text NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS school_role_permissions (
  role_id        integer NOT NULL REFERENCES school_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES school_permissions(key) ON DELETE CASCADE,
  scope          text NOT NULL DEFAULT 'campus',
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS school_user_roles (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  user_id     text NOT NULL,
  role_id     integer NOT NULL REFERENCES school_roles(id) ON DELETE CASCADE,
  campus_id   integer REFERENCES school_campuses(id) ON DELETE CASCADE,
  valid_from  date,
  valid_to    date,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_school_user_roles
  ON school_user_roles (app_id, user_id, role_id, coalesce(campus_id, 0));

CREATE TABLE IF NOT EXISTS school_audit_log (
  id           bigserial PRIMARY KEY,
  app_id       text NOT NULL DEFAULT 'default',
  user_id      text,
  action       text NOT NULL,
  entity       text NOT NULL,
  entity_id    text,
  before_json  jsonb,
  after_json   jsonb,
  ip           text,
  device       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_approval_flows (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  name        text,
  entity_type text NOT NULL,
  steps       jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, entity_type)
);

CREATE TABLE IF NOT EXISTS school_approval_requests (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL DEFAULT 'default',
  entity_type   text NOT NULL,
  entity_id     text,
  requested_by  text,
  status        text NOT NULL DEFAULT 'pending',
  current_step  integer NOT NULL DEFAULT 1,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  acted_at      timestamptz
);

CREATE TABLE IF NOT EXISTS school_approval_actions (
  id          serial PRIMARY KEY,
  request_id  integer NOT NULL REFERENCES school_approval_requests(id) ON DELETE CASCADE,
  step_no     integer NOT NULL,
  approver_id text,
  decision    text NOT NULL,
  remark      text,
  acted_at    timestamptz NOT NULL DEFAULT now()
);

/* ---------- extend the student master ---------- */
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS campus_id      integer REFERENCES school_campuses(id) ON DELETE SET NULL;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS family_id      integer REFERENCES school_families(id) ON DELETE SET NULL;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS middle_name    text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS blood_group    text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS nationality    text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS category       text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS previous_school text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS national_id    text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS house          text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS deleted_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_school_students_campus  ON school_students (app_id, campus_id);
CREATE INDEX IF NOT EXISTS idx_school_students_live    ON school_students (app_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_school_guardians_phone  ON school_guardians (app_id, phone);
CREATE INDEX IF NOT EXISTS idx_school_docs_student     ON school_student_documents (app_id, student_id);
CREATE INDEX IF NOT EXISTS idx_school_enroll_year      ON school_student_enrollments (app_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_school_audit_entity     ON school_audit_log (app_id, entity, entity_id, created_at DESC);

COMMIT;
