BEGIN;

CREATE TABLE IF NOT EXISTS school_lesson_plans (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  class_id integer,
  section_id integer,
  subject_id integer,
  teacher_id text,
  academic_year_id integer,
  topic text NOT NULL,
  objectives text,
  activities text,
  materials text,
  homework text,
  planned_date date,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_homework (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  class_id integer NOT NULL,
  section_id integer,
  subject_id integer,
  teacher_id text,
  title text NOT NULL,
  description text,
  attachment_url text,
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_homework_submissions (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  homework_id integer REFERENCES school_homework(id) ON DELETE CASCADE,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  submission_text text,
  attachment_url text,
  submitted_at timestamptz DEFAULT now(),
  marks numeric(6,2),
  feedback text,
  graded_at timestamptz,
  graded_by text
);

CREATE TABLE IF NOT EXISTS school_exam_schedules (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  exam_name text NOT NULL,
  academic_year_id integer,
  class_id integer,
  start_date date,
  end_date date,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_exam_timetable (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  schedule_id integer REFERENCES school_exam_schedules(id) ON DELETE CASCADE,
  subject_id integer,
  exam_date date NOT NULL,
  start_time time,
  end_time time,
  max_marks integer DEFAULT 100,
  room_no text
);

CREATE TABLE IF NOT EXISTS school_marks (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  exam_id integer REFERENCES school_exam_schedules(id) ON DELETE CASCADE,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  subject_id integer,
  marks_obtained numeric(6,2),
  max_marks numeric(6,2),
  remarks text,
  entered_by text,
  entered_at timestamptz DEFAULT now(),
  locked boolean DEFAULT false,
  UNIQUE(exam_id, student_id, subject_id)
);

CREATE TABLE IF NOT EXISTS school_visitors (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  visitor_name text NOT NULL,
  phone text,
  purpose text,
  to_meet text,
  id_proof text,
  in_time timestamptz DEFAULT now(),
  out_time timestamptz,
  badge_no text,
  remarks text,
  created_by text
);

CREATE TABLE IF NOT EXISTS school_gate_passes (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id),
  issued_by text,
  reason text NOT NULL,
  out_time timestamptz DEFAULT now(),
  return_time timestamptz,
  picked_by text,
  remarks text,
  status text DEFAULT 'out'
);

CREATE TABLE IF NOT EXISTS school_health_records (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  visit_date date DEFAULT current_date,
  symptoms text,
  treatment text,
  medicines text,
  referred_to text,
  attended_by text,
  remarks text,
  notify_parent boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS school_discipline (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  incident_date date DEFAULT current_date,
  category text,
  description text,
  action_taken text,
  reported_by text,
  status text DEFAULT 'open',
  remarks text
);

CREATE TABLE IF NOT EXISTS school_leaves (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  applicant_type text NOT NULL,
  applicant_id text,
  student_id integer,
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text,
  status text DEFAULT 'pending',
  approved_by text,
  approved_at timestamptz,
  remarks text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_substitutions (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  timetable_id integer,
  absent_teacher_id text,
  substitute_teacher_id text,
  class_id integer,
  section_id integer,
  subject_id integer,
  period_no integer,
  sub_date date NOT NULL,
  status text DEFAULT 'assigned',
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_promotions (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  from_academic_year_id integer,
  to_academic_year_id integer,
  student_id integer REFERENCES school_students(id),
  from_class_id integer,
  to_class_id integer,
  from_section_id integer,
  to_section_id integer,
  status text DEFAULT 'promoted',
  promoted_by text,
  promoted_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_transfer_certificates (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  tc_no text NOT NULL,
  student_id integer REFERENCES school_students(id),
  issue_date date DEFAULT current_date,
  reason text,
  issued_by text,
  remarks text,
  no_dues_checked boolean DEFAULT false,
  status text DEFAULT 'issued',
  UNIQUE(app_id, tc_no)
);

CREATE TABLE IF NOT EXISTS school_audit_extended (
  id bigserial PRIMARY KEY,
  app_id text NOT NULL,
  user_id text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  ip_address text,
  user_agent text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sh_homework_cls ON school_homework(app_id,class_id);
CREATE INDEX IF NOT EXISTS idx_sh_marks_exam ON school_marks(app_id,exam_id);
CREATE INDEX IF NOT EXISTS idx_sh_visitors_date ON school_visitors(app_id,in_time);
CREATE INDEX IF NOT EXISTS idx_sh_leaves_status ON school_leaves(app_id,status);

COMMIT;
