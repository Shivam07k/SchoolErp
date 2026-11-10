-- Transport module
CREATE TABLE IF NOT EXISTS school_trans_route (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  code VARCHAR(40) NOT NULL,
  name VARCHAR(150) NOT NULL,
  direction VARCHAR(20) DEFAULT 'both',
  campus_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, code)
);

CREATE TABLE IF NOT EXISTS school_trans_zone (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(80) NOT NULL,
  fee_amount NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(app_id, name)
);

CREATE TABLE IF NOT EXISTS school_trans_stop (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(150) NOT NULL,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  landmark VARCHAR(150),
  zone_id INT REFERENCES school_trans_zone(id),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(app_id, name)
);

CREATE TABLE IF NOT EXISTS school_trans_route_stop (
  id SERIAL PRIMARY KEY,
  route_id INT REFERENCES school_trans_route(id) ON DELETE CASCADE,
  stop_id INT REFERENCES school_trans_stop(id),
  seq INT NOT NULL,
  pick_time TIME,
  drop_time TIME,
  fare NUMERIC(12,2) DEFAULT 0,
  UNIQUE(route_id, seq)
);

CREATE TABLE IF NOT EXISTS school_trans_trip (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  route_id INT REFERENCES school_trans_route(id),
  trip_type VARCHAR(20) DEFAULT 'morning',
  start_time TIME,
  end_time TIME,
  weekdays VARCHAR(20) DEFAULT '1111100',
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS school_trans_vehicle (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  reg_no VARCHAR(40) NOT NULL,
  type VARCHAR(40),
  make VARCHAR(60),
  year INT,
  capacity INT DEFAULT 0,
  ownership VARCHAR(20) DEFAULT 'own',
  gps_device_id VARCHAR(60),
  status VARCHAR(20) DEFAULT 'active',
  asset_id INT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, reg_no)
);

CREATE TABLE IF NOT EXISTS school_trans_vehicle_doc (
  id SERIAL PRIMARY KEY,
  vehicle_id INT REFERENCES school_trans_vehicle(id) ON DELETE CASCADE,
  doc_type VARCHAR(40),
  doc_no VARCHAR(80),
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_trans_driver (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  staff_id INT,
  name VARCHAR(150),
  phone VARCHAR(30),
  licence_no VARCHAR(60),
  licence_class VARCHAR(20),
  licence_expiry DATE,
  medical_date DATE,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS school_trans_attendant (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  staff_id INT,
  name VARCHAR(150),
  phone VARCHAR(30),
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS school_trans_trip_assign (
  id SERIAL PRIMARY KEY,
  trip_id INT REFERENCES school_trans_trip(id),
  vehicle_id INT REFERENCES school_trans_vehicle(id),
  driver_id INT REFERENCES school_trans_driver(id),
  attendant_id INT REFERENCES school_trans_attendant(id),
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_to DATE,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS school_trans_allocation (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  student_id INT NOT NULL,
  route_id INT REFERENCES school_trans_route(id),
  trip_id INT REFERENCES school_trans_trip(id),
  pick_stop_id INT REFERENCES school_trans_stop(id),
  drop_stop_id INT REFERENCES school_trans_stop(id),
  seat_no VARCHAR(10),
  fee_zone_id INT REFERENCES school_trans_zone(id),
  from_date DATE DEFAULT CURRENT_DATE,
  to_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_trans_allocation_req (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  student_id INT NOT NULL,
  req_type VARCHAR(20),
  route_id INT,
  pick_stop_id INT,
  drop_stop_id INT,
  effective_date DATE,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_trans_trip_run (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  trip_id INT REFERENCES school_trans_trip(id),
  run_date DATE DEFAULT CURRENT_DATE,
  vehicle_id INT,
  driver_id INT,
  attendant_id INT,
  status VARCHAR(20) DEFAULT 'scheduled',
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  start_lat NUMERIC(10,6),
  start_lng NUMERIC(10,6),
  end_lat NUMERIC(10,6),
  end_lng NUMERIC(10,6)
);

CREATE TABLE IF NOT EXISTS school_trans_location_ping (
  id BIGSERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  trip_run_id INT REFERENCES school_trans_trip_run(id),
  device_id VARCHAR(60),
  vehicle_id INT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  speed NUMERIC(6,2),
  heading NUMERIC(6,2),
  ping_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_trans_boarding (
  id SERIAL PRIMARY KEY,
  trip_run_id INT REFERENCES school_trans_trip_run(id),
  student_id INT,
  stop_id INT,
  event_type VARCHAR(10),
  event_time TIMESTAMP DEFAULT now(),
  source VARCHAR(20) DEFAULT 'app'
);

CREATE TABLE IF NOT EXISTS school_trans_alert (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  trip_run_id INT,
  type VARCHAR(30),
  message TEXT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  alert_at TIMESTAMP DEFAULT now(),
  status VARCHAR(20) DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_trans_ping_run ON school_trans_location_ping(trip_run_id, ping_at);
CREATE INDEX IF NOT EXISTS idx_trans_alloc_student ON school_trans_allocation(app_id, student_id, status);
