BEGIN;

CREATE TABLE IF NOT EXISTS school_houses (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  name text NOT NULL,
  color text,
  UNIQUE(app_id,name)
);

CREATE TABLE IF NOT EXISTS school_transport_vehicles (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  vehicle_no text NOT NULL,
  vehicle_type text,
  capacity integer,
  driver_name text,
  driver_phone text,
  attendant_name text,
  insurance_expiry date,
  fitness_expiry date,
  status text DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS school_transport_routes (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  route_name text NOT NULL,
  vehicle_id integer REFERENCES school_transport_vehicles(id),
  start_point text,
  end_point text,
  fare numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS school_transport_stops (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  route_id integer REFERENCES school_transport_routes(id) ON DELETE CASCADE,
  stop_name text NOT NULL,
  stop_order integer,
  pickup_time time,
  drop_time time,
  fare numeric(10,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS school_transport_allocations (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  route_id integer REFERENCES school_transport_routes(id),
  stop_id integer REFERENCES school_transport_stops(id),
  academic_year_id integer,
  status text DEFAULT 'active',
  UNIQUE(student_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS school_library_books (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  book_code text,
  title text NOT NULL,
  author text,
  publisher text,
  category text,
  isbn text,
  copies integer DEFAULT 1,
  available integer DEFAULT 1,
  rack_no text,
  status text DEFAULT 'available',
  UNIQUE(app_id, book_code)
);

CREATE TABLE IF NOT EXISTS school_library_issues (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  book_id integer REFERENCES school_library_books(id),
  student_id integer REFERENCES school_students(id),
  staff_id text,
  issue_date date DEFAULT current_date,
  due_date date,
  return_date date,
  fine_amount numeric(10,2) DEFAULT 0,
  status text DEFAULT 'issued',
  issued_by text
);

CREATE TABLE IF NOT EXISTS school_hostel_blocks (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  block_name text NOT NULL,
  warden_id text,
  status text DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS school_hostel_rooms (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  block_id integer REFERENCES school_hostel_blocks(id),
  room_no text NOT NULL,
  capacity integer DEFAULT 1,
  occupied integer DEFAULT 0,
  status text DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS school_hostel_allocations (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  student_id integer REFERENCES school_students(id) ON DELETE CASCADE,
  block_id integer REFERENCES school_hostel_blocks(id),
  room_id integer REFERENCES school_hostel_rooms(id),
  bed_no text,
  allocate_date date DEFAULT current_date,
  vacate_date date,
  status text DEFAULT 'active',
  UNIQUE(student_id)
);

CREATE TABLE IF NOT EXISTS school_inventory_items (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  item_code text,
  item_name text NOT NULL,
  category text,
  unit text,
  current_stock numeric(12,2) DEFAULT 0,
  reorder_level numeric(12,2) DEFAULT 0,
  unit_price numeric(10,2) DEFAULT 0,
  vendor_id integer,
  status text DEFAULT 'active',
  UNIQUE(app_id, item_code)
);

CREATE TABLE IF NOT EXISTS school_inventory_purchases (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  po_no text,
  vendor_name text,
  item_id integer REFERENCES school_inventory_items(id),
  quantity numeric(12,2),
  unit_price numeric(10,2),
  total_amount numeric(12,2),
  purchase_date date DEFAULT current_date,
  received_by text,
  status text DEFAULT 'received'
);

CREATE TABLE IF NOT EXISTS school_inventory_issues (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  item_id integer REFERENCES school_inventory_items(id),
  issued_to text,
  quantity numeric(12,2),
  issue_date date DEFAULT current_date,
  issued_by text,
  remarks text
);

CREATE TABLE IF NOT EXISTS school_canteen_menu (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  menu_date date NOT NULL,
  meal_type text,
  item_name text NOT NULL,
  price numeric(10,2) DEFAULT 0,
  available boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS school_hr_employees (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  employee_no text,
  first_name text NOT NULL,
  last_name text,
  dob date,
  gender text,
  phone text,
  email text,
  designation text,
  department text,
  joining_date date,
  reporting_manager text,
  status text DEFAULT 'active',
  salary_basic numeric(12,2) DEFAULT 0,
  UNIQUE(app_id, employee_no)
);

CREATE TABLE IF NOT EXISTS school_hr_leave_types (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  leave_type text NOT NULL,
  annual_quota integer DEFAULT 0,
  carry_forward boolean DEFAULT false,
  paid boolean DEFAULT true,
  UNIQUE(app_id, leave_type)
);

CREATE TABLE IF NOT EXISTS school_hr_leave_balances (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  employee_id integer REFERENCES school_hr_employees(id),
  leave_type_id integer REFERENCES school_hr_leave_types(id),
  academic_year_id integer,
  balance integer DEFAULT 0,
  used integer DEFAULT 0,
  UNIQUE(employee_id, leave_type_id, academic_year_id)
);

CREATE TABLE IF NOT EXISTS school_payroll_runs (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  month integer,
  year integer,
  status text DEFAULT 'draft',
  processed_by text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(app_id, month, year)
);

CREATE TABLE IF NOT EXISTS school_payslips (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  payroll_run_id integer REFERENCES school_payroll_runs(id),
  employee_id integer REFERENCES school_hr_employees(id),
  basic numeric(12,2) DEFAULT 0,
  allowances numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  net_pay numeric(12,2) DEFAULT 0,
  status text DEFAULT 'generated',
  UNIQUE(payroll_run_id, employee_id)
);

CREATE TABLE IF NOT EXISTS school_circulars (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  title text NOT NULL,
  body text,
  target_type text DEFAULT 'all',
  target_ids jsonb DEFAULT '[]'::jsonb,
  attachment_url text,
  issued_by text,
  publish_date date DEFAULT current_date,
  status text DEFAULT 'published',
  requires_ack boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_circular_acknowledgements (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  circular_id integer REFERENCES school_circulars(id) ON DELETE CASCADE,
  user_id text,
  user_type text,
  acknowledged_at timestamptz DEFAULT now(),
  UNIQUE(circular_id, user_id)
);

CREATE TABLE IF NOT EXISTS school_ptm_slots (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  teacher_id text,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text DEFAULT 'available',
  booked_by text,
  student_id integer,
  meeting_notes text
);

CREATE TABLE IF NOT EXISTS school_helpdesk_tickets (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  ticket_no text,
  raised_by text,
  user_type text,
  category text,
  subject text NOT NULL,
  description text,
  priority text DEFAULT 'normal',
  assigned_to text,
  status text DEFAULT 'open',
  sla_due_at timestamptz,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(app_id, ticket_no)
);

CREATE TABLE IF NOT EXISTS school_surveys (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  title text NOT NULL,
  description text,
  questions jsonb DEFAULT '[]'::jsonb,
  target_type text DEFAULT 'all',
  start_date date,
  end_date date,
  status text DEFAULT 'active',
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_survey_responses (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  survey_id integer REFERENCES school_surveys(id) ON DELETE CASCADE,
  respondent_id text,
  respondent_type text,
  responses jsonb DEFAULT '{}'::jsonb,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, respondent_id)
);

CREATE TABLE IF NOT EXISTS school_events (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  title text NOT NULL,
  event_type text,
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  venue text,
  description text,
  target_audience text,
  status text DEFAULT 'planned',
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_certificates (
  id serial PRIMARY KEY,
  app_id text NOT NULL,
  certificate_no text NOT NULL,
  student_id integer REFERENCES school_students(id),
  certificate_type text NOT NULL,
  issue_date date DEFAULT current_date,
  purpose text,
  issued_by text,
  qr_code text,
  status text DEFAULT 'issued',
  UNIQUE(app_id, certificate_no)
);

CREATE INDEX IF NOT EXISTS idx_sh_lib_issue ON school_library_issues(app_id,student_id,status);
CREATE INDEX IF NOT EXISTS idx_sh_trans_alloc ON school_transport_allocations(app_id,student_id);
CREATE INDEX IF NOT EXISTS idx_sh_circulars ON school_circulars(app_id,status);

COMMIT;
