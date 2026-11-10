-- ============================================================
-- Hostel & Residential Life — Core Schema (Step 1–3)
-- Migration: sql/80_hostel_core.sql
-- ============================================================
-- Creates hostels, blocks, floors, rooms, beds, inspections,
-- maintenance, applications, allocations, waitlist, room changes,
-- vacates, deposits, fee rules, mess plans, fee plans, rebates,
-- bills and damage recovery.
-- Safe to re-run: every object is IF NOT EXISTS.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Physical layout
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'boys' CHECK (type IN ('boys', 'girls', 'coed')),
  campus_id             INT,
  address               TEXT,
  phone                 TEXT,
  chief_warden_staff_id INT REFERENCES school_staff(id) ON DELETE SET NULL,
  capacity              INT DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  notes                 TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_name ON school_hostel(app_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_type ON school_hostel(app_id, type, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_block (
  id               SERIAL PRIMARY KEY,
  app_id           TEXT NOT NULL DEFAULT 'default',
  hostel_id        INT NOT NULL REFERENCES school_hostel(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  warden_staff_id  INT REFERENCES school_staff(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_block_name ON school_hostel_block(app_id, hostel_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_floor (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL DEFAULT 'default',
  block_id    INT NOT NULL REFERENCES school_hostel_block(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  level       INT DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_floor_name ON school_hostel_floor(app_id, block_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_room (
  id             SERIAL PRIMARY KEY,
  app_id         TEXT NOT NULL DEFAULT 'default',
  hostel_id      INT NOT NULL REFERENCES school_hostel(id) ON DELETE CASCADE,
  block_id       INT REFERENCES school_hostel_block(id) ON DELETE SET NULL,
  floor_id       INT REFERENCES school_hostel_floor(id) ON DELETE SET NULL,
  number         TEXT NOT NULL,
  room_type      TEXT NOT NULL DEFAULT 'double' CHECK (room_type IN ('single', 'double', 'triple', 'dormitory', 'warden', 'guest', 'accessible')),
  capacity       INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  amenities      TEXT[] DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'full', 'maintenance', 'closed')),
  fee_category   TEXT,
  is_accessible  BOOLEAN DEFAULT false,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_room_number ON school_hostel_room(app_id, hostel_id, number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_room_status ON school_hostel_room(app_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_bed (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL DEFAULT 'default',
  room_id     INT NOT NULL REFERENCES school_hostel_room(id) ON DELETE CASCADE,
  bed_no      TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'reserved', 'maintenance')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (room_id, bed_no)
);
CREATE INDEX IF NOT EXISTS idx_hostel_bed_status ON school_hostel_bed(app_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_room_inspection (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  room_id         INT NOT NULL REFERENCES school_hostel_room(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspected_by    TEXT,
  condition       TEXT DEFAULT 'good',
  findings        TEXT,
  damage_amount   NUMERIC(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_inspection_room ON school_hostel_room_inspection(app_id, room_id, inspection_date DESC);

CREATE TABLE IF NOT EXISTS school_hostel_maintenance (
  id            SERIAL PRIMARY KEY,
  app_id        TEXT NOT NULL DEFAULT 'default',
  room_id       INT NOT NULL REFERENCES school_hostel_room(id) ON DELETE CASCADE,
  issue         TEXT NOT NULL,
  reported_by   TEXT,
  reported_at   TIMESTAMPTZ DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
  cost          NUMERIC(12,2) DEFAULT 0,
  vendor        TEXT,
  resolved_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_maint_status ON school_hostel_maintenance(app_id, status, reported_at DESC);

CREATE TABLE IF NOT EXISTS school_hostel_room_asset (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL DEFAULT 'default',
  room_id     INT NOT NULL REFERENCES school_hostel_room(id) ON DELETE CASCADE,
  asset_id    INT REFERENCES school_inv_asset(id) ON DELETE SET NULL,
  quantity    INT DEFAULT 1,
  condition   TEXT DEFAULT 'good',
  issued_at   DATE DEFAULT CURRENT_DATE,
  returned_at DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_room_asset_room ON school_hostel_room_asset(app_id, room_id);

-- ------------------------------------------------------------
-- 2. Applications and allocation
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel_application (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  application_no        TEXT NOT NULL,
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  requested_hostel_id   INT REFERENCES school_hostel(id) ON DELETE SET NULL,
  requested_room_type   TEXT,
  preferences           JSONB DEFAULT '{}'::jsonb,
  guardian_consent      BOOLEAN DEFAULT false,
  consent_at            TIMESTAMPTZ,
  documents             JSONB DEFAULT '[]'::jsonb,
  status                TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'allocated', 'waitlisted', 'cancelled')),
  priority              INT DEFAULT 0,
  applied_at            DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_by           TEXT,
  approved_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  notes                 TEXT,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_application_no ON school_hostel_application(app_id, application_no) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_application_student ON school_hostel_application(app_id, student_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_allocation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  application_id    INT REFERENCES school_hostel_application(id) ON DELETE SET NULL,
  hostel_id         INT NOT NULL REFERENCES school_hostel(id),
  block_id          INT REFERENCES school_hostel_block(id) ON DELETE SET NULL,
  floor_id          INT REFERENCES school_hostel_floor(id) ON DELETE SET NULL,
  room_id           INT NOT NULL REFERENCES school_hostel_room(id),
  bed_id            INT NOT NULL REFERENCES school_hostel_bed(id),
  from_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  to_date           DATE,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('reserved', 'active', 'changed', 'vacated', 'cancelled')),
  deposit_paid      NUMERIC(12,2) DEFAULT 0,
  deposit_status    TEXT NOT NULL DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'held', 'adjusted', 'refunded', 'forfeited', 'not_required')),
  checkin_date      DATE,
  checkout_date     DATE,
  guardian_consent  BOOLEAN DEFAULT false,
  consent_at        TIMESTAMPTZ,
  rules_ack_at      TIMESTAMPTZ,
  notes             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_active_student ON school_hostel_allocation(app_id, student_id) WHERE status IN ('reserved', 'active') AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_active_bed ON school_hostel_allocation(app_id, bed_id) WHERE status IN ('reserved', 'active') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_allocation_room ON school_hostel_allocation(app_id, room_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_allocation_student ON school_hostel_allocation(app_id, student_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_waitlist (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  application_id  INT REFERENCES school_hostel_application(id) ON DELETE CASCADE,
  student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  priority        INT DEFAULT 0,
  requested_type  TEXT,
  status          TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'expired', 'converted', 'cancelled')),
  offered_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_waitlist_status ON school_hostel_waitlist(app_id, status, priority DESC, created_at);

CREATE TABLE IF NOT EXISTS school_hostel_room_change (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  allocation_id   INT NOT NULL REFERENCES school_hostel_allocation(id) ON DELETE CASCADE,
  from_bed_id     INT REFERENCES school_hostel_bed(id) ON DELETE SET NULL,
  to_bed_id       INT REFERENCES school_hostel_bed(id) ON DELETE SET NULL,
  reason          TEXT,
  requested_by    TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_change_allocation ON school_hostel_room_change(app_id, allocation_id, status);

CREATE TABLE IF NOT EXISTS school_hostel_vacate (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  allocation_id       INT NOT NULL REFERENCES school_hostel_allocation(id) ON DELETE CASCADE,
  vacate_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  reason              TEXT,
  clearance           JSONB DEFAULT '{}'::jsonb,
  dues_cleared        BOOLEAN DEFAULT false,
  assets_cleared      BOOLEAN DEFAULT false,
  keys_returned       BOOLEAN DEFAULT false,
  damage_amount       NUMERIC(12,2) DEFAULT 0,
  deposit_settlement  NUMERIC(12,2) DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'cancelled')),
  cleared_by          TEXT,
  cleared_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_vacate_allocation ON school_hostel_vacate(app_id, allocation_id, status);

CREATE TABLE IF NOT EXISTS school_hostel_deposit (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  allocation_id       INT NOT NULL REFERENCES school_hostel_allocation(id) ON DELETE CASCADE,
  student_id          INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  amount              NUMERIC(12,2) DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('pending', 'held', 'adjusted', 'refunded', 'forfeited')),
  held_at             DATE DEFAULT CURRENT_DATE,
  settled_at          DATE,
  settlement_amount   NUMERIC(12,2) DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (allocation_id)
);
CREATE INDEX IF NOT EXISTS idx_hostel_deposit_status ON school_hostel_deposit(app_id, status);

-- ------------------------------------------------------------
-- 3. Hostel fees
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_hostel_fee_rule (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  hostel_id       INT REFERENCES school_hostel(id) ON DELETE CASCADE,
  room_category   TEXT,
  room_type       TEXT,
  fee_head_id     INT REFERENCES school_fee_head(id) ON DELETE SET NULL,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  frequency       TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'term', 'annual', 'one_time')),
  months_billed   INT[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  is_active       BOOLEAN DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_hostel_fee_rule_lookup ON school_hostel_fee_rule(app_id, hostel_id, room_category, effective_from DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_mess_plan (
  id                  SERIAL PRIMARY KEY,
  app_id              TEXT NOT NULL DEFAULT 'default',
  name                TEXT NOT NULL,
  amount_per_month    NUMERIC(12,2) NOT NULL DEFAULT 0,
  rebate_min_days     INT DEFAULT 0,
  rebate_daily_rate   NUMERIC(12,2) DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_mess_plan_name ON school_hostel_mess_plan(app_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_hostel_fee_plan (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  allocation_id   INT NOT NULL REFERENCES school_hostel_allocation(id) ON DELETE CASCADE,
  fee_rule_id     INT REFERENCES school_hostel_fee_rule(id) ON DELETE SET NULL,
  mess_plan_id    INT REFERENCES school_hostel_mess_plan(id) ON DELETE SET NULL,
  monthly_rent    NUMERIC(12,2) DEFAULT 0,
  monthly_mess    NUMERIC(12,2) DEFAULT 0,
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_fee_plan_active ON school_hostel_fee_plan(app_id, allocation_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS school_hostel_mess_rebate (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  allocation_id   INT NOT NULL REFERENCES school_hostel_allocation(id) ON DELETE CASCADE,
  student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  from_date       DATE NOT NULL,
  to_date         DATE NOT NULL,
  days            INT NOT NULL DEFAULT 0,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_rebate_status ON school_hostel_mess_rebate(app_id, status, from_date);

CREATE TABLE IF NOT EXISTS school_hostel_bill (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  allocation_id   INT NOT NULL REFERENCES school_hostel_allocation(id) ON DELETE CASCADE,
  student_id      INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  rent_amount     NUMERIC(12,2) DEFAULT 0,
  mess_amount     NUMERIC(12,2) DEFAULT 0,
  extras_amount   NUMERIC(12,2) DEFAULT 0,
  rebate_amount   NUMERIC(12,2) DEFAULT 0,
  total_amount    NUMERIC(12,2) DEFAULT 0,
  invoice_id      INT REFERENCES school_invoice(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (allocation_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_hostel_bill_student ON school_hostel_bill(app_id, student_id, period_start DESC);

CREATE TABLE IF NOT EXISTS school_hostel_damage (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  allocation_id   INT REFERENCES school_hostel_allocation(id) ON DELETE SET NULL,
  room_id         INT REFERENCES school_hostel_room(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'waived')),
  invoice_id      INT REFERENCES school_invoice(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hostel_damage_status ON school_hostel_damage(app_id, status);

COMMIT;
