BEGIN;

-- Enhance students table
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS student_code text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS name_as_per_certificate text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS place_of_birth text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS religion text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS mother_tongue text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS aadhaar_no text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS birth_certificate_no text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS passport_no text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS apaar_id text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS medical_conditions text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS chronic_conditions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS regular_medications text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS doctor_name text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS doctor_contact text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS preferred_hospital text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS height_cm numeric(6,2);
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS weight_kg numeric(6,2);
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS permanent_address text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS father_name text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS father_occupation text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS father_contact text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS father_email text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS mother_name text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS mother_occupation text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS mother_contact text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS mother_email text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS guardian_name2 text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS guardian_relation text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS guardian_contact text;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS pickup_authorized jsonb DEFAULT '[]'::jsonb;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS transport_required boolean DEFAULT false;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS hostel_required boolean DEFAULT false;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS route_id integer;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS stop_id integer;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS leaving_date date;
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS remarks text;

-- Admissions enhanced
CREATE TABLE IF NOT EXISTS school_admissions_enhanced (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  inquiry_no text,
  student_id integer REFERENCES school_students(id),
  inquiry_date date DEFAULT current_date,
  inquiry_source text,
  class_interested integer,
  parent_contact text,
  follow_up_date date,
  inquiry_status text DEFAULT 'new',
  lost_reason text,
  student_photo_url text,
  first_name text,
  middle_name text,
  last_name text,
  name_as_per_certificate text,
  dob date,
  gender text,
  blood_group text,
  birth_certificate_no text,
  birth_certificate_url text,
  previous_school text,
  last_class_passed text,
  last_year_marks numeric(6,2),
  last_year_percentage numeric(6,2),
  tc_url text,
  report_card_url text,
  address_proof_url text,
  parent_photo_url text,
  parent_signature_url text,
  declaration_form_url text,
  sibling_student_id integer,
  second_language text,
  transport_needed boolean DEFAULT false,
  route_id integer,
  stop_id integer,
  discount_scholarship_code text,
  application_fee_paid boolean DEFAULT false,
  application_fee_receipt_no text,
  application_fee_receipt_url text,
  interview_score numeric(6,2),
  documents_checklist jsonb DEFAULT '[]'::jsonb,
  application_status text DEFAULT 'applied',
  waitlist_number integer,
  approved_by text,
  approved_at timestamptz,
  enrolled_at timestamptz,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Promotion runs
CREATE TABLE IF NOT EXISTS school_promotion_runs (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  from_academic_year_id integer,
  to_academic_year_id integer,
  from_class_id integer,
  to_class_id integer,
  from_section_id integer,
  to_section_id integer,
  status text DEFAULT 'draft',
  run_by text,
  run_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_promotion_items (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  run_id integer REFERENCES school_promotion_runs(id) ON DELETE CASCADE,
  student_id integer REFERENCES school_students(id),
  result text DEFAULT 'promoted',
  attendance_percent numeric(5,2),
  exam_result text,
  fee_dues numeric(12,2) DEFAULT 0,
  blocked boolean DEFAULT false,
  block_reason text,
  promoted_on date,
  promoted_by text,
  promotion_report_card_url text,
  marksheet_url text
);

-- Transfer & Exit
CREATE TABLE IF NOT EXISTS school_transfers (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  transfer_no text,
  student_id integer REFERENCES school_students(id),
  exit_type text NOT NULL,
  application_date date DEFAULT current_date,
  tc_issue_date date,
  reason_leaving text,
  reason_detail text,
  destination_school text,
  destination_city text,
  conduct_on_tc text DEFAULT 'good',
  last_class_attended integer,
  last_attendance_date date,
  no_dues_checklist jsonb DEFAULT '{"fees":false,"library":false,"sports":false,"lab":false}'::jsonb,
  no_dues_certificate_url text,
  tc_signed_copy_url text,
  tc_pdf_url text,
  character_certificate_url text,
  refund_due numeric(12,2) DEFAULT 0,
  parent_acknowledgement_url text,
  issued_by text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(app_id, transfer_no)
);

-- Documents enhanced
CREATE TABLE IF NOT EXISTS school_student_documents_enhanced (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_title text,
  document_number text,
  file_name text,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  issue_date date,
  issuing_authority text,
  expiry_date date,
  verification_status text DEFAULT 'submitted',
  verified_by text,
  verified_at timestamptz,
  rejection_reason text,
  notes text,
  uploaded_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Health
CREATE TABLE IF NOT EXISTS school_health_profiles (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE UNIQUE,
  blood_group text,
  height_cm numeric(6,2),
  weight_kg numeric(6,2),
  bmi numeric(6,2),
  allergies text,
  chronic_conditions jsonb DEFAULT '[]'::jsonb,
  regular_medications text,
  doctor_name text,
  doctor_contact text,
  preferred_hospital text,
  vaccination_card_url text,
  medical_fitness_url text,
  medical_fitness_expiry date,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_health_vaccinations (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  dose text,
  vaccination_date date,
  remarks text
);

CREATE TABLE IF NOT EXISTS school_health_events (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  event_datetime timestamptz DEFAULT now(),
  location text,
  symptom_complaint text NOT NULL,
  treatment_given text,
  action_taken text,
  injury_photo_url text,
  prescription_url text,
  attending_staff text NOT NULL,
  parent_informed boolean DEFAULT false,
  parent_informed_at timestamptz,
  informed_by text,
  severity text DEFAULT 'minor',
  follow_up_required boolean DEFAULT false,
  follow_up_date date,
  remarks text,
  created_at timestamptz DEFAULT now()
);

-- Discipline
CREATE TABLE IF NOT EXISTS school_discipline_incidents (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  incident_no text,
  incident_datetime timestamptz DEFAULT now(),
  location text,
  reported_by text,
  incident_type text NOT NULL,
  severity text DEFAULT 'minor',
  description text NOT NULL,
  evidence_photos jsonb DEFAULT '[]'::jsonb,
  cctv_clip_url text,
  witness_statements text,
  zero_tolerance boolean DEFAULT false,
  status text DEFAULT 'open',
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(app_id, incident_no)
);

CREATE TABLE IF NOT EXISTS school_discipline_participants (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  incident_id integer REFERENCES school_discipline_incidents(id) ON DELETE CASCADE,
  student_id integer REFERENCES school_students(id),
  role text NOT NULL,
  remarks text,
  UNIQUE(incident_id, student_id, role)
);

CREATE TABLE IF NOT EXISTS school_discipline_actions (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  incident_id integer REFERENCES school_discipline_incidents(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_letter_url text,
  start_date date,
  end_date date,
  suspension_days integer,
  parent_notified boolean DEFAULT false,
  parent_notified_at timestamptz,
  parent_acknowledgement_url text,
  student_apology_url text,
  counselor_note text,
  action_by text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Audit log enhanced
CREATE TABLE IF NOT EXISTS school_audit_log_enhanced (
  id bigserial PRIMARY KEY,
  app_id text NOT NULL,
  module text,
  action text NOT NULL,
  record_id text,
  user_id text,
  user_name text,
  ip_address text,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_std_docs_enh ON school_student_documents_enhanced(app_id,student_id);
CREATE INDEX IF NOT EXISTS idx_health_events ON school_health_events(app_id,student_id,event_datetime);
CREATE INDEX IF NOT EXISTS idx_disc_inc ON school_discipline_incidents(app_id,status);
CREATE INDEX IF NOT EXISTS idx_promo_items ON school_promotion_items(app_id,run_id,student_id);
CREATE INDEX IF NOT EXISTS idx_transfers ON school_transfers(app_id,student_id,status);

COMMIT;
