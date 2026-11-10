CREATE TABLE IF NOT EXISTS school_inv_issue (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  issue_no VARCHAR(40) NOT NULL,
  store_id INT REFERENCES school_inv_store(id),
  issued_to_type VARCHAR(20), -- staff|department|room|class|student
  issued_to_id VARCHAR(64),
  issued_to_name VARCHAR(150),
  issue_date DATE DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  status VARCHAR(20) DEFAULT 'issued',
  purpose TEXT,
  issued_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, issue_no)
);

CREATE TABLE IF NOT EXISTS school_inv_issue_line (
  id SERIAL PRIMARY KEY,
  issue_id INT REFERENCES school_inv_issue(id) ON DELETE CASCADE,
  item_id INT REFERENCES school_inv_item(id),
  qty NUMERIC(12,2) NOT NULL,
  returnable BOOLEAN DEFAULT FALSE,
  returned_qty NUMERIC(12,2) DEFAULT 0,
  asset_id INT
);

CREATE TABLE IF NOT EXISTS school_inv_return (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  return_no VARCHAR(40) NOT NULL,
  issue_id INT REFERENCES school_inv_issue(id),
  store_id INT REFERENCES school_inv_store(id),
  return_date DATE DEFAULT CURRENT_DATE,
  received_by VARCHAR(64),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, return_no)
);

CREATE TABLE IF NOT EXISTS school_inv_return_line (
  id SERIAL PRIMARY KEY,
  return_id INT REFERENCES school_inv_return(id) ON DELETE CASCADE,
  issue_line_id INT REFERENCES school_inv_issue_line(id),
  item_id INT REFERENCES school_inv_item(id),
  qty NUMERIC(12,2) NOT NULL,
  condition VARCHAR(20) DEFAULT 'good'
);

CREATE TABLE IF NOT EXISTS school_inv_transfer (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  transfer_no VARCHAR(40) NOT NULL,
  from_store_id INT REFERENCES school_inv_store(id),
  to_store_id INT REFERENCES school_inv_store(id),
  transfer_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) DEFAULT 'pending', -- pending|acknowledged|completed|cancelled
  transferred_by VARCHAR(64),
  acknowledged_by VARCHAR(64),
  acknowledged_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, transfer_no)
);

CREATE TABLE IF NOT EXISTS school_inv_transfer_line (
  id SERIAL PRIMARY KEY,
  transfer_id INT REFERENCES school_inv_transfer(id) ON DELETE CASCADE,
  item_id INT REFERENCES school_inv_item(id),
  qty NUMERIC(12,2) NOT NULL,
  batch_no VARCHAR(60)
);

CREATE TABLE IF NOT EXISTS school_inv_adjustment (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  adj_no VARCHAR(40) NOT NULL,
  store_id INT REFERENCES school_inv_store(id),
  adj_date DATE DEFAULT CURRENT_DATE,
  type VARCHAR(20) DEFAULT 'adjustment', -- adjustment|damage|writeoff
  reason TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft|approved|posted
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, adj_no)
);

CREATE TABLE IF NOT EXISTS school_inv_adjustment_line (
  id SERIAL PRIMARY KEY,
  adjustment_id INT REFERENCES school_inv_adjustment(id) ON DELETE CASCADE,
  item_id INT REFERENCES school_inv_item(id),
  system_qty NUMERIC(12,2),
  counted_qty NUMERIC(12,2),
  diff_qty NUMERIC(12,2), -- + in, - out
  rate NUMERIC(12,2)
);

CREATE TABLE IF NOT EXISTS school_inv_asset (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  tag_no VARCHAR(80) NOT NULL,
  item_id INT REFERENCES school_inv_item(id),
  category_id INT REFERENCES school_inv_category(id),
  serial_no VARCHAR(80),
  grn_id INT REFERENCES school_inv_grn(id),
  grn_line_id INT REFERENCES school_inv_grn_line(id),
  purchase_date DATE,
  cost NUMERIC(14,2) DEFAULT 0,
  vendor_id INT REFERENCES school_inv_vendor(id),
  store_id INT REFERENCES school_inv_store(id),
  location VARCHAR(150),
  room_id INT,
  custodian_user_id VARCHAR(64),
  department VARCHAR(100),
  status VARCHAR(20) DEFAULT 'in_use', -- in_use|idle|under_maintenance|lost|disposed
  condition VARCHAR(20) DEFAULT 'good',
  warranty_end DATE,
  capitalisation_date DATE,
  depreciation_method VARCHAR(20) DEFAULT 'slm',
  life_years INT DEFAULT 0,
  rate NUMERIC(6,2) DEFAULT 0,
  salvage_value NUMERIC(14,2) DEFAULT 0,
  accumulated_dep NUMERIC(14,2) DEFAULT 0,
  book_value NUMERIC(14,2) DEFAULT 0,
  disposed_at TIMESTAMP,
  disposal_reason TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, tag_no)
);

CREATE TABLE IF NOT EXISTS school_inv_asset_movement (
  id SERIAL PRIMARY KEY,
  asset_id INT REFERENCES school_inv_asset(id),
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  from_location VARCHAR(150),
  to_location VARCHAR(150),
  from_custodian VARCHAR(64),
  to_custodian VARCHAR(64),
  moved_by VARCHAR(64),
  moved_at TIMESTAMP DEFAULT now(),
  reason TEXT,
  acknowledged_by VARCHAR(64),
  acknowledged_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS school_inv_asset_maintenance (
  id SERIAL PRIMARY KEY,
  asset_id INT REFERENCES school_inv_asset(id),
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  type VARCHAR(20) DEFAULT 'preventive', -- preventive|repair
  task VARCHAR(200),
  vendor_id INT REFERENCES school_inv_vendor(id),
  scheduled_date DATE,
  done_date DATE,
  cost NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled|in_progress|done|cancelled
  notes TEXT,
  done_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_inv_asset_disposal (
  id SERIAL PRIMARY KEY,
  asset_id INT REFERENCES school_inv_asset(id),
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  disposal_type VARCHAR(20), -- sale|scrap|writeoff|donation
  disposal_date DATE DEFAULT CURRENT_DATE,
  proceeds NUMERIC(12,2) DEFAULT 0,
  reason TEXT,
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  gain_loss NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_asset_app_status ON school_inv_asset(app_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_issue_store_date ON school_inv_issue(app_id, store_id, issue_date);
