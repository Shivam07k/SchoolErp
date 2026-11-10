BEGIN;

CREATE TABLE IF NOT EXISTS school_enquiries (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  enquiry_no text,
  first_name text NOT NULL,
  last_name text,
  phone text,
  email text,
  class_applied integer,
  source text,
  status text DEFAULT 'enquiry',
  assigned_to text,
  follow_up_date date,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_applications (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  application_no text,
  enquiry_id integer REFERENCES school_enquiries(id),
  student_id integer,
  first_name text NOT NULL,
  last_name text,
  dob date,
  gender text,
  phone text,
  email text,
  class_applied integer,
  section_preference text,
  father_name text,
  mother_name text,
  guardian_phone text,
  address text,
  documents jsonb DEFAULT '[]'::jsonb,
  application_fee_amount numeric(10,2) DEFAULT 0,
  application_fee_paid boolean DEFAULT false,
  status text DEFAULT 'applied',
  test_date date,
  test_marks numeric(6,2),
  merit_rank integer,
  offer_sent_at timestamptz,
  offer_accepted_at timestamptz,
  admitted_at timestamptz,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_enquiries_app ON school_enquiries(app_id,status);
CREATE INDEX IF NOT EXISTS idx_school_applications_app ON school_applications(app_id,status);

COMMIT;
