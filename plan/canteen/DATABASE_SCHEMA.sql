-- ============================================================
-- School ERP Canteen Module — Core Schema
-- Migration: plan/canteen/DATABASE_SCHEMA.sql
-- Based on PART B CANTEEN MODULE B6 Data Model
-- Safe to re-run: every object is IF NOT EXISTS.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Suppliers and Stock
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_canteen_supplier (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  name                TEXT NOT NULL,
  contact_name        TEXT,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  is_active           BOOLEAN DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_supplier_name ON school_canteen_supplier(app_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canteen_supplier_active ON school_canteen_supplier(app_id, is_active) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_stock_item (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  stock_code          TEXT,
  name                TEXT NOT NULL,
  unit                TEXT,
  reorder_level       NUMERIC(12,2) DEFAULT 0,
  current_qty         NUMERIC(12,2) DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_stock_item_code ON school_canteen_stock_item(app_id, stock_code) WHERE stock_code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canteen_stock_item_name ON school_canteen_stock_item(app_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_purchase (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  po_no               TEXT NOT NULL,
  supplier_id         INT REFERENCES school_canteen_supplier(id) ON DELETE SET NULL,
  purchase_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  received_date       DATE,
  status              TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','received','cancelled')),
  total_amount        NUMERIC(12,2) DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_purchase_po ON school_canteen_purchase(app_id, po_no) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_stock_movement (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  stock_item_id       INT NOT NULL REFERENCES school_canteen_stock_item(id) ON DELETE CASCADE,
  movement_type       TEXT NOT NULL CHECK (movement_type IN ('purchase','consumption','wastage','adjustment')),
  qty                 NUMERIC(12,2) NOT NULL,
  ref_order_id        INT,
  ref_purchase_id     INT REFERENCES school_canteen_purchase(id) ON DELETE SET NULL,
  movement_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by          TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canteen_stock_movement_item ON school_canteen_stock_movement(app_id, stock_item_id, movement_date DESC);

-- ------------------------------------------------------------
-- 2. Menu and Recipes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_canteen_menu_item (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  item_code           TEXT,
  name                TEXT NOT NULL,
  category            TEXT,
  description         TEXT,
  unit                TEXT,
  price               NUMERIC(12,2) DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  allergen_tags       TEXT[] DEFAULT '{}',
  dietary_tags        TEXT[] DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_menu_item_code ON school_canteen_menu_item(app_id, item_code) WHERE item_code IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canteen_menu_item_name ON school_canteen_menu_item(app_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_recipe (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  item_id             INT NOT NULL REFERENCES school_canteen_menu_item(id) ON DELETE CASCADE,
  stock_item_id       INT NOT NULL REFERENCES school_canteen_stock_item(id) ON DELETE CASCADE,
  qty_per_unit        NUMERIC(12,4) NOT NULL,
  uom                 TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_recipe_item_stock ON school_canteen_recipe(app_id, item_id, stock_item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_combo (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  name                TEXT NOT NULL,
  description         TEXT,
  price               NUMERIC(12,2) DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  items               JSONB DEFAULT '[]'::jsonb,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_combo_name ON school_canteen_combo(app_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_menu_plan (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  week_start_date     DATE NOT NULL,
  day_of_week         INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  meal_type           TEXT NOT NULL,
  item_id             INT REFERENCES school_canteen_menu_item(id) ON DELETE SET NULL,
  price               NUMERIC(12,2),
  effective_from      DATE,
  effective_to        DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_canteen_menu_plan_week ON school_canteen_menu_plan(app_id, week_start_date, day_of_week);

CREATE TABLE IF NOT EXISTS school_canteen_menu_override (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  menu_date           DATE NOT NULL,
  item_id             INT REFERENCES school_canteen_menu_item(id) ON DELETE SET NULL,
  is_available        BOOLEAN DEFAULT true,
  override_price      NUMERIC(12,2),
  reason              TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_menu_override_date_item ON school_canteen_menu_override(app_id, menu_date, item_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_price_history (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  item_id             INT NOT NULL REFERENCES school_canteen_menu_item(id) ON DELETE CASCADE,
  price               NUMERIC(12,2) NOT NULL,
  effective_from      DATE NOT NULL,
  effective_to        DATE,
  changed_by          TEXT,
  reason              TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canteen_price_history_item ON school_canteen_price_history(app_id, item_id, effective_from DESC);

-- ------------------------------------------------------------
-- 3. Staff, Settings, Documents
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_canteen_staff (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  staff_id            INT REFERENCES school_staff(id) ON DELETE SET NULL,
  role                TEXT,
  is_active           BOOLEAN DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_staff_staff ON school_canteen_staff(app_id, staff_id) WHERE staff_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_setting (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  setting_key         TEXT NOT NULL,
  setting_value       TEXT,
  description         TEXT,
  updated_by          TEXT,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_setting_key ON school_canteen_setting(app_id, setting_key);

CREATE TABLE IF NOT EXISTS school_canteen_document (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  doc_type            TEXT NOT NULL,
  doc_no              TEXT,
  file_path           TEXT,
  related_table       TEXT,
  related_id          INT,
  uploaded_by         TEXT,
  uploaded_at         TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_canteen_document_related ON school_canteen_document(app_id, related_table, related_id);

-- ------------------------------------------------------------
-- 4. Wallet and Orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_canteen_wallet (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  student_id          INT NOT NULL,
  balance             NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_limit         NUMERIC(12,2) DEFAULT 0,
  parent_blocked_items JSONB DEFAULT '[]'::jsonb,
  is_active           BOOLEAN DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_wallet_student ON school_canteen_wallet(app_id, student_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_wallet_entry (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  wallet_id           INT NOT NULL REFERENCES school_canteen_wallet(id) ON DELETE CASCADE,
  entry_type          TEXT NOT NULL CHECK (entry_type IN ('credit','debit')),
  amount              NUMERIC(12,2) NOT NULL,
  balance_after       NUMERIC(12,2) NOT NULL,
  ref_order_id        INT,
  ref_bill_id         INT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canteen_wallet_entry_wallet ON school_canteen_wallet_entry(app_id, wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS school_canteen_order (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  order_no            TEXT NOT NULL,
  student_id          INT,
  order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  order_type          TEXT NOT NULL DEFAULT 'pos' CHECK (order_type IN ('preorder','pos')),
  status              TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','confirmed','served','cancelled','refunded')),
  total_amount        NUMERIC(12,2) DEFAULT 0,
  idempotency_key     TEXT,
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_order_no ON school_canteen_order(app_id, order_no) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canteen_order_student ON school_canteen_order(app_id, student_id, order_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_order_line (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  order_id            INT NOT NULL REFERENCES school_canteen_order(id) ON DELETE CASCADE,
  item_id             INT REFERENCES school_canteen_menu_item(id) ON DELETE SET NULL,
  combo_id            INT REFERENCES school_canteen_combo(id) ON DELETE SET NULL,
  qty                 INT NOT NULL DEFAULT 1,
  price               NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total          NUMERIC(12,2) DEFAULT 0,
  allergen_warning_shown BOOLEAN DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canteen_order_line_order ON school_canteen_order_line(app_id, order_id);

CREATE TABLE IF NOT EXISTS school_canteen_bulk_order (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  order_no            TEXT NOT NULL,
  class_id            INT,
  teacher_id          INT,
  order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  status              TEXT NOT NULL DEFAULT 'placed',
  total_amount        NUMERIC(12,2) DEFAULT 0,
  notes               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_bulk_order_no ON school_canteen_bulk_order(app_id, order_no) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_subscription (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  student_id          INT NOT NULL,
  plan_name           TEXT NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE,
  meal_type           TEXT,
  days                TEXT[] DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_canteen_subscription_student ON school_canteen_subscription(app_id, student_id, status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 5. Billing, Payments, Closing
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_canteen_bill (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  bill_no             TEXT NOT NULL,
  order_id            INT REFERENCES school_canteen_order(id) ON DELETE SET NULL,
  bulk_order_id       INT REFERENCES school_canteen_bulk_order(id) ON DELETE SET NULL,
  bill_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  amount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode        TEXT CHECK (payment_mode IN ('wallet','cash','card','mixed')),
  status              TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('draft','paid','refunded','void')),
  day_closed          BOOLEAN DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_bill_no ON school_canteen_bill(app_id, bill_no) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_canteen_bill_date ON school_canteen_bill(app_id, bill_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_canteen_payment (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  bill_id             INT REFERENCES school_canteen_bill(id) ON DELETE CASCADE,
  payment_mode        TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  transaction_ref     TEXT,
  payment_date        TIMESTAMPTZ DEFAULT now(),
  status              TEXT NOT NULL DEFAULT 'success',
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canteen_payment_bill ON school_canteen_payment(app_id, bill_id);

CREATE TABLE IF NOT EXISTS school_canteen_day_closing (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  close_date          DATE NOT NULL,
  opening_cash        NUMERIC(12,2) DEFAULT 0,
  closing_cash        NUMERIC(12,2) DEFAULT 0,
  wallet_settlement   NUMERIC(12,2) DEFAULT 0,
  total_sales         NUMERIC(12,2) DEFAULT 0,
  closed_by           TEXT,
  closed_at           TIMESTAMPTZ DEFAULT now(),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_canteen_day_closing_date ON school_canteen_day_closing(app_id, close_date) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 6. Notifications and Audit
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_canteen_notification (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  student_id          INT,
  parent_id           INT,
  type                TEXT NOT NULL,
  message             TEXT NOT NULL,
  sent_at             TIMESTAMPTZ DEFAULT now(),
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canteen_notification_student ON school_canteen_notification(app_id, student_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS school_canteen_audit (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  table_name          TEXT NOT NULL,
  record_id           INT,
  action              TEXT NOT NULL,
  changed_by          TEXT,
  changed_at          TIMESTAMPTZ DEFAULT now(),
  old_values          JSONB,
  new_values          JSONB,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canteen_audit_table ON school_canteen_audit(app_id, table_name, record_id, changed_at DESC);

COMMIT;
