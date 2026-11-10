/* ============================================================
   Student Module - Phase 1 Migrations
   Following STUDENT_SECTION_PLAN.md
   Safe to re-run: uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS
   ============================================================ */

-- Extend school_students with comprehensive fields
ALTER TABLE school_students 
  ADD COLUMN IF NOT EXISTS student_code text,
  ADD COLUMN IF NOT EXISTS middle_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS official_name text,
  ADD COLUMN IF NOT EXISTS place_of_birth text,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'Indian',
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS mother_tongue text,
  ADD COLUMN IF NOT EXISTS birth_certificate_no text,
  ADD COLUMN IF NOT EXISTS aadhaar_no text,
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS previous_school text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS house text,
  ADD COLUMN IF NOT EXISTS apaar_id text,
  ADD COLUMN IF NOT EXISTS medical_conditions text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS transport_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hostel_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS remarks text,
  ADD COLUMN IF NOT EXISTS family_id integer,
  ADD COLUMN IF NOT EXISTS campus_id integer,
  ADD COLUMN IF NOT EXISTS leaving_date date,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add unique constraint for student_code per app
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_students_code_unique 
  ON school_students (app_id, student_code) WHERE student_code IS NOT NULL;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_school_students_family ON school_students (app_id, family_id);
CREATE INDEX IF NOT EXISTS idx_school_students_campus ON school_students (app_id, campus_id);
CREATE INDEX IF NOT EXISTS idx_school_students_deleted ON school_students (app_id, deleted_at);

-- Inquiries table
CREATE TABLE IF NOT EXISTS school_inquiries (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  inquiry_no        text NOT NULL,
  inquiry_date      date NOT NULL DEFAULT current_date,
  inquiry_source    text NOT NULL,
  class_interested  integer REFERENCES school_classes(id),
  parent_contact    text NOT NULL,
  parent_name       text,
  student_first_name text,
  student_last_name  text,
  follow_up_date    date,
  inquiry_status    text NOT NULL DEFAULT 'new',
  lost_reason       text,
  assigned_to       text,
  remarks           text,
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, inquiry_no)
);

CREATE INDEX IF NOT EXISTS idx_school_inquiries_app_status ON school_inquiries (app_id, inquiry_status, inquiry_date);

-- Applications table
CREATE TABLE IF NOT EXISTS school_applications (
  id                      serial PRIMARY KEY,
  app_id                  text NOT NULL DEFAULT 'default',
  inquiry_id             integer REFERENCES school_inquiries(id),
  application_no         text NOT NULL,
  application_date       date NOT NULL DEFAULT current_date,
  class_applied          integer REFERENCES school_classes(id),
  student_first_name     text NOT NULL,
  student_middle_name    text,
  student_last_name      text NOT NULL,
  official_name          text NOT NULL,
  dob                    date NOT NULL,
  gender                 text NOT NULL,
  blood_group            text,
  nationality            text,
  religion               text,
  category               text,
  mother_tongue          text,
  birth_certificate_no   text,
  previous_school        text,
  last_class_passed      text,
  last_year_marks        numeric(5,2),
  last_year_percentage   numeric(5,2),
  father_name            text,
  father_occupation      text,
  father_contact         text,
  father_email           text,
  mother_name            text,
  mother_occupation      text,
  mother_contact         text,
  mother_email           text,
  guardian_name          text,
  guardian_relation      text,
  guardian_contact       text,
  current_address        text,
  permanent_address      text,
  transport_needed       boolean DEFAULT false,
  route_id               integer,
  stop_id                integer,
  discount_scholarship_code text,
  application_fee_paid   boolean DEFAULT false,
  application_fee_amount numeric(10,2),
  application_fee_receipt_no text,
  application_fee_date   date,
  interview_score        numeric(5,2),
  documents_checklist    jsonb DEFAULT '[]'::jsonb,
  application_status     text NOT NULL DEFAULT 'applied',
  waitlist_number        integer,
  rejection_reason       text,
  approved_by            text,
  approved_at            timestamptz,
  enrolled_at            timestamptz,
  student_id             integer REFERENCES school_students(id),
  remarks                text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, application_no)
);

-- Earlier setup versions created a smaller applications table. Extend it
-- in place so the admission workflow can be upgraded without data loss.
ALTER TABLE school_applications
  ADD COLUMN IF NOT EXISTS student_first_name text,
  ADD COLUMN IF NOT EXISTS student_middle_name text,
  ADD COLUMN IF NOT EXISTS student_last_name text,
  ADD COLUMN IF NOT EXISTS official_name text,
  ADD COLUMN IF NOT EXISTS school_inquiry_id integer REFERENCES school_inquiries(id),
  ADD COLUMN IF NOT EXISTS application_date date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS class_applied integer,
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS mother_tongue text,
  ADD COLUMN IF NOT EXISTS birth_certificate_no text,
  ADD COLUMN IF NOT EXISTS previous_school text,
  ADD COLUMN IF NOT EXISTS last_class_passed text,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS father_occupation text,
  ADD COLUMN IF NOT EXISTS father_contact text,
  ADD COLUMN IF NOT EXISTS father_email text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS mother_occupation text,
  ADD COLUMN IF NOT EXISTS mother_contact text,
  ADD COLUMN IF NOT EXISTS mother_email text,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_relation text,
  ADD COLUMN IF NOT EXISTS guardian_contact text,
  ADD COLUMN IF NOT EXISTS current_address text,
  ADD COLUMN IF NOT EXISTS permanent_address text,
  ADD COLUMN IF NOT EXISTS transport_needed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS documents_checklist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS application_status text DEFAULT 'applied',
  ADD COLUMN IF NOT EXISTS waitlist_number integer,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS student_id integer;
ALTER TABLE school_applications
  ADD COLUMN IF NOT EXISTS birth_certificate_url text,
  ADD COLUMN IF NOT EXISTS tc_url text,
  ADD COLUMN IF NOT EXISTS report_card_url text,
  ADD COLUMN IF NOT EXISTS address_proof_url text,
  ADD COLUMN IF NOT EXISTS student_photo_url text,
  ADD COLUMN IF NOT EXISTS parent_photo_url text,
  ADD COLUMN IF NOT EXISTS parent_signature_url text,
  ADD COLUMN IF NOT EXISTS declaration_form_url text;

CREATE INDEX IF NOT EXISTS idx_school_applications_app_status ON school_applications (app_id, application_status, application_date);

-- Admissions table (link between application and student)
CREATE TABLE IF NOT EXISTS school_admissions (
  id              serial PRIMARY KEY,
  app_id          text NOT NULL DEFAULT 'default',
  application_id  integer REFERENCES school_applications(id),
  student_id      integer REFERENCES school_students(id),
  admission_no    text NOT NULL,
  admission_date  date NOT NULL DEFAULT current_date,
  academic_year_id integer REFERENCES school_academic_years(id),
  class_id        integer REFERENCES school_classes(id),
  section_id      integer REFERENCES school_sections(id),
  approved_by     text,
  approved_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, admission_no),
  UNIQUE (application_id),
  UNIQUE (student_id)
);

-- Enhance enrollments table
ALTER TABLE school_student_enrollments 
  ADD COLUMN IF NOT EXISTS start_date date DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS promoted_from_enrollment_id integer;

-- Add unique constraint for enrollment per student per academic year
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_enrollments_unique 
  ON school_student_enrollments (app_id, student_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_school_enrollments_active 
  ON school_student_enrollments (app_id, academic_year_id, class_id, section_id, status);

-- Promotion runs
CREATE TABLE IF NOT EXISTS school_promotion_runs (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  run_no                text NOT NULL,
  from_academic_year_id integer NOT NULL REFERENCES school_academic_years(id),
  to_academic_year_id   integer NOT NULL REFERENCES school_academic_years(id),
  from_class_id         integer REFERENCES school_classes(id),
  to_class_id           integer REFERENCES school_classes(id),
  from_section_id       integer REFERENCES school_sections(id),
  to_section_id         integer REFERENCES school_sections(id),
  status                text NOT NULL DEFAULT 'draft',
  run_by                text,
  approved_by           text,
  approved_at           timestamptz,
  executed_by           text,
  executed_at           timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, run_no)
);

CREATE INDEX IF NOT EXISTS idx_school_promotion_runs_app_status ON school_promotion_runs (app_id, status);

-- Promotion run items
CREATE TABLE IF NOT EXISTS school_promotion_run_items (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  run_id                integer NOT NULL REFERENCES school_promotion_runs(id) ON DELETE CASCADE,
  student_id            integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  enrollment_id         integer REFERENCES school_student_enrollments(id),
  attendance_pct        numeric(5,2),
  fee_dues              numeric(12,2) DEFAULT 0,
  exam_result           text,
  outcome               text,
  blocked               boolean DEFAULT false,
  block_reason          text,
  override_reason       text,
  overridden_by         text,
  overridden_at         timestamptz,
  promoted_enrollment_id integer REFERENCES school_student_enrollments(id),
  promoted_on           date,
  promoted_by           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_school_promotion_items_run ON school_promotion_run_items (run_id, outcome);

-- Exit requests
CREATE TABLE IF NOT EXISTS school_exit_requests (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  request_no            text NOT NULL,
  student_id            integer NOT NULL REFERENCES school_students(id),
  exit_type             text NOT NULL,
  reason_leaving        text NOT NULL,
  reason_detail         text,
  destination_school    text,
  destination_city      text,
  requested_by          text,
  requested_at          timestamptz NOT NULL DEFAULT now(),
  application_date      date NOT NULL DEFAULT current_date,
  status                text NOT NULL DEFAULT 'requested',
  approved_by           text,
  approved_at           timestamptz,
  tc_issue_date         date,
  last_class_attended   integer REFERENCES school_classes(id),
  last_attendance_date  date,
  conduct_on_tc         text DEFAULT 'good',
  refund_due            numeric(12,2) DEFAULT 0,
  remarks               text,
  closed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, request_no)
);

CREATE INDEX IF NOT EXISTS idx_school_exit_requests_app_status ON school_exit_requests (app_id, status);

-- Exit clearances
CREATE TABLE IF NOT EXISTS school_exit_clearances (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  request_id        integer NOT NULL REFERENCES school_exit_requests(id) ON DELETE CASCADE,
  department        text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  cleared_by        text,
  cleared_at        timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, department)
);

-- Transfer certificates
CREATE TABLE IF NOT EXISTS school_transfer_certificates (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  request_id        integer NOT NULL REFERENCES school_exit_requests(id),
  tc_no             text NOT NULL,
  student_id        integer NOT NULL REFERENCES school_students(id),
  issue_date        date NOT NULL DEFAULT current_date,
  issued_by         text,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  conduct           text DEFAULT 'good',
  tc_content        jsonb,
  tc_pdf_url        text,
  signed_scan_url   text,
  character_cert_url text,
  remarks           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, tc_no),
  UNIQUE (request_id)
);

-- The original transfer-certificate table predates exit requests. Extend it
-- without dropping issued certificates or their existing identifiers.
ALTER TABLE school_transfer_certificates
  ADD COLUMN IF NOT EXISTS request_id integer REFERENCES school_exit_requests(id),
  ADD COLUMN IF NOT EXISTS issued_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS conduct text DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS tc_content jsonb,
  ADD COLUMN IF NOT EXISTS tc_pdf_url text,
  ADD COLUMN IF NOT EXISTS signed_scan_url text,
  ADD COLUMN IF NOT EXISTS character_cert_url text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_tc_request_unique
  ON school_transfer_certificates (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_tc_app_date ON school_transfer_certificates (app_id, issue_date);

-- Enhanced document types
CREATE TABLE IF NOT EXISTS school_document_types (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL DEFAULT 'default',
  name          text NOT NULL,
  code          text,
  is_mandatory  boolean DEFAULT false,
  applicable_to text DEFAULT 'all',
  required_for  text NOT NULL DEFAULT 'student',
  sort_order    integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, name)
);

ALTER TABLE school_document_types
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS is_mandatory boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS applicable_to text DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS required_for text NOT NULL DEFAULT 'student';

-- Enhanced student documents
CREATE TABLE IF NOT EXISTS school_student_documents_enhanced (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  student_id            integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  document_type_id      integer REFERENCES school_document_types(id),
  document_type         text,
  document_title        text NOT NULL,
  document_number       text,
  file_name             text NOT NULL,
  file_url              text,
  storage_key           text,
  file_size             integer,
  mime_type             text,
  issue_date            date,
  issuing_authority     text,
  expiry_date           date,
  verification_status   text NOT NULL DEFAULT 'submitted',
  verified_by           text,
  verified_at           timestamptz,
  rejection_reason      text,
  current_version_id    integer,
  uploaded_by           text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_student_documents_enhanced
  ADD COLUMN IF NOT EXISTS document_type_id integer REFERENCES school_document_types(id),
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS current_version_id integer;

CREATE INDEX IF NOT EXISTS idx_school_docs_enhanced_student ON school_student_documents_enhanced (app_id, student_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_school_docs_enhanced_expiry ON school_student_documents_enhanced (app_id, expiry_date) WHERE expiry_date IS NOT NULL;

-- Document versions
CREATE TABLE IF NOT EXISTS school_document_versions (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  document_id       integer NOT NULL REFERENCES school_student_documents_enhanced(id) ON DELETE CASCADE,
  version_number    integer NOT NULL DEFAULT 1,
  file_name         text NOT NULL,
  file_url          text,
  storage_key       text,
  file_size         integer,
  mime_type         text,
  sha256            text,
  uploaded_by       text,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  exif_stripped     boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_school_doc_versions_doc ON school_document_versions (document_id, version_number);

-- Guardians enhancement
CREATE TABLE IF NOT EXISTS school_guardians_enhanced (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  name              text NOT NULL,
  relation          text,
  phone             text,
  email             text,
  occupation        text,
  address           text,
  photo_url         text,
  id_proof_url      text,
  country_code      text DEFAULT '+91',
  is_emergency_contact boolean DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_student_guardians_enhanced (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  student_id        integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  guardian_id       integer NOT NULL REFERENCES school_guardians_enhanced(id) ON DELETE CASCADE,
  relation          text,
  is_primary        boolean DEFAULT false,
  is_emergency      boolean DEFAULT false,
  can_pickup        boolean DEFAULT false,
  is_fee_payer      boolean DEFAULT false,
  custody_rights    boolean DEFAULT false,
  contact_preference text,
  consent_given     boolean DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, guardian_id)
);

-- Pickup authorized persons
CREATE TABLE IF NOT EXISTS school_pickup_authorized (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  student_id        integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  name              text NOT NULL,
  relation          text,
  phone             text,
  photo_url         text,
  id_proof_url      text,
  valid_until       date,
  authorized_by     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_pickup_student ON school_pickup_authorized (student_id);

-- Health profiles
CREATE TABLE IF NOT EXISTS school_health_profiles (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  student_id            integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  blood_group           text,
  allergies             text,
  allergies_status      text DEFAULT 'unknown',
  chronic_conditions    jsonb DEFAULT '[]'::jsonb,
  regular_medications   text,
  doctor_name           text,
  doctor_contact        text,
  preferred_hospital    text,
  emergency_instructions text,
  vaccination_card_url  text,
  medical_fitness_url   text,
  medical_fitness_expiry date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

-- Health observations
CREATE TABLE IF NOT EXISTS school_health_observations (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  student_id        integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  observation_type  text NOT NULL,
  value             numeric(10,2),
  unit              text,
  observed_at       date NOT NULL DEFAULT current_date,
  observed_by       text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_health_obs_student ON school_health_observations (student_id, observed_at);

-- Health events
CREATE TABLE IF NOT EXISTS school_health_events (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  student_id            integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  event_datetime        timestamptz NOT NULL DEFAULT now(),
  symptom_complaint     text NOT NULL,
  treatment_given       text,
  action_taken          text NOT NULL,
  injury_photo_url      text,
  prescription_url      text,
  attending_staff       text NOT NULL,
  parent_informed       boolean DEFAULT false,
  parent_informed_at    timestamptz,
  informed_by           text,
  severity              text NOT NULL DEFAULT 'minor',
  follow_up_required    boolean DEFAULT false,
  follow_up_date        date,
  follow_up_done        boolean DEFAULT false,
  remarks               text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_health_events_student ON school_health_events (student_id, event_datetime);

-- Vaccinations
CREATE TABLE IF NOT EXISTS school_vaccinations (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  student_id        integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  vaccine_name      text NOT NULL,
  dose_number       text,
  vaccination_date  date NOT NULL,
  administered_by   text,
  batch_number      text,
  certificate_url   text,
  next_due_date     date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_vaccinations_student ON school_vaccinations (student_id, vaccination_date);

-- Discipline incidents
CREATE TABLE IF NOT EXISTS school_discipline_incidents (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  incident_no           text NOT NULL,
  incident_datetime     timestamptz NOT NULL DEFAULT now(),
  location              text NOT NULL,
  reported_by           text NOT NULL,
  incident_type         text NOT NULL,
  severity              text NOT NULL DEFAULT 'minor',
  description           text NOT NULL,
  status                text NOT NULL DEFAULT 'open',
  zero_tolerance        boolean DEFAULT false,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, incident_no)
);

CREATE INDEX IF NOT EXISTS idx_school_discipline_incidents_app_status ON school_discipline_incidents (app_id, status, incident_datetime);

-- Incident participants
CREATE TABLE IF NOT EXISTS school_discipline_participants (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  incident_id       integer NOT NULL REFERENCES school_discipline_incidents(id) ON DELETE CASCADE,
  student_id        integer NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  role              text NOT NULL,
  remarks           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, student_id, role)
);

-- Incident evidence
CREATE TABLE IF NOT EXISTS school_discipline_evidence (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  incident_id       integer NOT NULL REFERENCES school_discipline_incidents(id) ON DELETE CASCADE,
  evidence_type     text NOT NULL,
  file_name         text NOT NULL,
  file_url          text,
  storage_key       text,
  file_size         integer,
  mime_type         text,
  uploaded_by       text,
  uploaded_at       timestamptz NOT NULL DEFAULT now()
);

-- Incident actions
CREATE TABLE IF NOT EXISTS school_discipline_actions (
  id                    serial PRIMARY KEY,
  app_id                text NOT NULL DEFAULT 'default',
  incident_id           integer NOT NULL REFERENCES school_discipline_incidents(id) ON DELETE CASCADE,
  action_type           text NOT NULL,
  action_letter_url     text,
  start_date            date,
  end_date              date,
  suspension_days       integer,
  parent_notified       boolean DEFAULT false,
  parent_notified_at    timestamptz,
  parent_acknowledgement_url text,
  student_apology_url   text,
  counselor_note        text,
  action_by             text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_discipline_actions_incident ON school_discipline_actions (incident_id);

-- Incident appeals
CREATE TABLE IF NOT EXISTS school_discipline_appeals (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  incident_id       integer NOT NULL REFERENCES school_discipline_incidents(id) ON DELETE CASCADE,
  action_id         integer REFERENCES school_discipline_actions(id),
  appeal_reason     text NOT NULL,
  appeal_status     text NOT NULL DEFAULT 'pending',
  reviewed_by       text,
  reviewed_at       timestamptz,
  review_notes      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Audit events enhanced
CREATE TABLE IF NOT EXISTS school_audit_events (
  id                bigserial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  school_id         text,
  branch_id         text,
  actor_id          text,
  actor_name        text,
  entity            text NOT NULL,
  entity_id         text,
  action            text NOT NULL,
  module            text,
  before_json       jsonb,
  after_json        jsonb,
  changes_json      jsonb,
  reason            text,
  source            text,
  ip_address        text,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_audit_events_app_entity ON school_audit_events (app_id, entity, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_school_audit_events_actor ON school_audit_events (app_id, actor_id, created_at);

-- Integration outbox
CREATE TABLE IF NOT EXISTS school_integration_outbox (
  id                bigserial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  event_type        text NOT NULL,
  aggregate_type    text,
  aggregate_id      text,
  payload           jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  attempts          integer DEFAULT 0,
  last_attempt_at   timestamptz,
  next_retry_at     timestamptz DEFAULT now(),
  processed_at      timestamptz,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_outbox_pending ON school_integration_outbox (status, next_retry_at) WHERE status = 'pending';

-- Seed default document types
INSERT INTO school_document_types (app_id, name, code, is_mandatory, applicable_to, required_for, sort_order)
VALUES 
  ('default', 'Birth Certificate', 'BIRTH_CERT', true, 'admission', 'admission', 1),
  ('default', 'Transfer Certificate', 'TC', false, 'admission', 'admission', 2),
  ('default', 'Report Card/Marksheet', 'REPORT_CARD', false, 'admission', 'admission', 3),
  ('default', 'Address Proof', 'ADDRESS_PROOF', true, 'admission', 'admission', 4),
  ('default', 'Aadhaar Card', 'AADHAAR', false, 'all', 'student', 5),
  ('default', 'Passport', 'PASSPORT', false, 'all', 'student', 6),
  ('default', 'Category Certificate', 'CATEGORY_CERT', false, 'all', 'student', 7),
  ('default', 'Medical Certificate', 'MEDICAL_CERT', false, 'all', 'student', 8),
  ('default', 'Passport Size Photo', 'PHOTO', true, 'all', 'student', 9),
  ('default', 'Parent Signature', 'PARENT_SIG', false, 'admission', 'admission', 10)
ON CONFLICT (app_id, name) DO NOTHING;

-- Functions for ID generation
CREATE OR REPLACE FUNCTION generate_student_code(p_app_id text)
RETURNS text AS $$
DECLARE
  v_year text := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  v_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM school_students
  WHERE app_id = p_app_id AND student_code LIKE 'STU-' || v_year || '-%';
  
  RETURN 'STU-' || v_year || '-' || LPAD(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_inquiry_no(p_app_id text)
RETURNS text AS $$
DECLARE
  v_year text := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  v_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM school_inquiries
  WHERE app_id = p_app_id AND inquiry_no LIKE 'INQ-' || v_year || '-%';
  
  RETURN 'INQ-' || v_year || '-' || LPAD(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_application_no(p_app_id text)
RETURNS text AS $$
DECLARE
  v_year text := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  v_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM school_applications
  WHERE app_id = p_app_id AND application_no LIKE 'APP-' || v_year || '-%';
  
  RETURN 'APP-' || v_year || '-' || LPAD(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_tc_no(p_app_id text)
RETURNS text AS $$
DECLARE
  v_year text := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  v_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM school_transfer_certificates
  WHERE app_id = p_app_id AND tc_no LIKE 'TC-' || v_year || '-%';
  
  RETURN 'TC-' || v_year || '-' || LPAD(v_count::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMIT;
