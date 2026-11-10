-- Inventory & Assets core schema
CREATE TABLE IF NOT EXISTS school_inv_store (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(150) NOT NULL,
  type VARCHAR(40) DEFAULT 'central',
  incharge_user_id VARCHAR(64),
  location VARCHAR(150),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, name)
);

CREATE TABLE IF NOT EXISTS school_inv_category (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(150) NOT NULL,
  parent_id INT REFERENCES school_inv_category(id),
  type VARCHAR(20) DEFAULT 'consumable',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, name)
);

CREATE TABLE IF NOT EXISTS school_inv_item (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  code VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category_id INT REFERENCES school_inv_category(id),
  unit VARCHAR(20) DEFAULT 'pcs',
  tracking_type VARCHAR(20) NOT NULL DEFAULT 'consumable',
  reorder_level NUMERIC(12,2) DEFAULT 0,
  reorder_qty NUMERIC(12,2) DEFAULT 0,
  min_qty NUMERIC(12,2) DEFAULT 0,
  batch_required BOOLEAN DEFAULT FALSE,
  expiry_required BOOLEAN DEFAULT FALSE,
  valuation_method VARCHAR(10) DEFAULT 'avg',
  barcode VARCHAR(80),
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, code)
);

CREATE TABLE IF NOT EXISTS school_inv_vendor (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(150),
  phone VARCHAR(30),
  email VARCHAR(150),
  address TEXT,
  gstin VARCHAR(40),
  bank_details JSONB,
  is_approved BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_inv_indent (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  indent_no VARCHAR(40) NOT NULL,
  requester_user_id VARCHAR(64),
  department VARCHAR(100),
  store_id INT REFERENCES school_inv_store(id),
  status VARCHAR(20) DEFAULT 'draft',
  notes TEXT,
  requested_at DATE DEFAULT CURRENT_DATE,
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, indent_no)
);

CREATE TABLE IF NOT EXISTS school_inv_indent_line (
  id SERIAL PRIMARY KEY,
  indent_id INT REFERENCES school_inv_indent(id) ON DELETE CASCADE,
  item_id INT REFERENCES school_inv_item(id),
  qty NUMERIC(12,2) NOT NULL,
  approx_rate NUMERIC(12,2),
  reason TEXT,
  ordered_qty NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS school_inv_po (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  po_no VARCHAR(40) NOT NULL,
  indent_id INT REFERENCES school_inv_indent(id),
  vendor_id INT REFERENCES school_inv_vendor(id),
  store_id INT REFERENCES school_inv_store(id),
  order_date DATE DEFAULT CURRENT_DATE,
  expected_date DATE,
  status VARCHAR(20) DEFAULT 'draft',
  terms TEXT,
  notes TEXT,
  subtotal NUMERIC(14,2) DEFAULT 0,
  tax NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  approved_by VARCHAR(64),
  approved_at TIMESTAMP,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, po_no)
);

CREATE TABLE IF NOT EXISTS school_inv_po_line (
  id SERIAL PRIMARY KEY,
  po_id INT REFERENCES school_inv_po(id) ON DELETE CASCADE,
  item_id INT REFERENCES school_inv_item(id),
  qty NUMERIC(12,2) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(6,2) DEFAULT 0,
  amount NUMERIC(14,2) DEFAULT 0,
  received_qty NUMERIC(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS school_inv_grn (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  grn_no VARCHAR(40) NOT NULL,
  po_id INT REFERENCES school_inv_po(id),
  vendor_id INT REFERENCES school_inv_vendor(id),
  store_id INT REFERENCES school_inv_store(id),
  grn_date DATE DEFAULT CURRENT_DATE,
  challan_no VARCHAR(60),
  received_by VARCHAR(64),
  status VARCHAR(20) DEFAULT 'received',
  notes TEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, grn_no)
);

CREATE TABLE IF NOT EXISTS school_inv_grn_line (
  id SERIAL PRIMARY KEY,
  grn_id INT REFERENCES school_inv_grn(id) ON DELETE CASCADE,
  po_line_id INT REFERENCES school_inv_po_line(id),
  item_id INT REFERENCES school_inv_item(id),
  ordered_qty NUMERIC(12,2),
  received_qty NUMERIC(12,2) NOT NULL,
  accepted_qty NUMERIC(12,2) NOT NULL,
  rejected_qty NUMERIC(12,2) DEFAULT 0,
  rate NUMERIC(12,2) NOT NULL,
  batch_no VARCHAR(60),
  expiry_date DATE,
  serial_no VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS school_inv_vendor_bill (
  id SERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  bill_no VARCHAR(80) NOT NULL,
  vendor_id INT REFERENCES school_inv_vendor(id),
  po_id INT REFERENCES school_inv_po(id),
  grn_id INT REFERENCES school_inv_grn(id),
  bill_date DATE,
  due_date DATE,
  subtotal NUMERIC(14,2) DEFAULT 0,
  tax NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  match_status VARCHAR(20) DEFAULT 'pending',
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(app_id, vendor_id, bill_no)
);

CREATE TABLE IF NOT EXISTS school_inv_stock_ledger (
  id BIGSERIAL PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL DEFAULT 'default',
  item_id INT REFERENCES school_inv_item(id),
  store_id INT REFERENCES school_inv_store(id),
  trans_date TIMESTAMP DEFAULT now(),
  type VARCHAR(20) NOT NULL,
  qty_in NUMERIC(12,2) DEFAULT 0,
  qty_out NUMERIC(12,2) DEFAULT 0,
  rate NUMERIC(12,2) DEFAULT 0,
  value NUMERIC(14,2) DEFAULT 0,
  batch_no VARCHAR(60),
  expiry_date DATE,
  ref_table VARCHAR(40),
  ref_id INT,
  reversal_of BIGINT,
  remarks TEXT,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_ledger_item_store ON school_inv_stock_ledger(app_id, item_id, store_id, trans_date);
