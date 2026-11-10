-- ============================================================
-- School HR & Payroll — Step 1: Staff Directory
-- ============================================================
-- Creates: school_staff, school_staff_employment, school_staff_qualification,
--          school_staff_document, school_staff_bank, school_staff_statutory,
--          school_staff_nominee, school_staff_emergency_contact
-- ============================================================

BEGIN;

-- Staff master
CREATE TABLE IF NOT EXISTS school_staff (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    employee_code       TEXT NOT NULL,
    name                TEXT NOT NULL,
    date_of_birth       DATE,
    gender              TEXT CHECK (gender IN ('male', 'female', 'other')),
    contact_phone       TEXT,
    contact_email       TEXT,
    address             TEXT,
    photo_url           TEXT,
    status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'exited')),
    user_id             TEXT,  -- link to auth user
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_employee_code ON school_staff(app_id, employee_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_status ON school_staff(app_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON school_staff(app_id, user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;

-- Employment history (effective-dated)
CREATE TABLE IF NOT EXISTS school_staff_employment (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    designation         TEXT NOT NULL,
    department          TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('permanent', 'contract', 'part_time', 'visiting', 'probation')),
    joining_date        DATE NOT NULL,
    confirmation_date   DATE,
    reports_to          INT REFERENCES school_staff(id) ON DELETE SET NULL,
    exit_date           DATE,
    exit_reason         TEXT,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_employment_staff ON school_staff_employment(app_id, staff_id, effective_from) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_employment_dept ON school_staff_employment(app_id, department) WHERE deleted_at IS NULL;

-- Qualifications and teachable subjects
CREATE TABLE IF NOT EXISTS school_staff_qualification (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    degree              TEXT NOT NULL,
    subject             TEXT,
    institute           TEXT,
    year                INT,
    teachable_subjects  INT[],          -- school_subjects IDs
    teachable_classes   INT[],          -- school_classes IDs
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_qual_staff ON school_staff_qualification(app_id, staff_id) WHERE deleted_at IS NULL;

-- Documents
CREATE TABLE IF NOT EXISTS school_staff_document (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,  -- 'id_proof', 'address_proof', 'qualification', 'experience', 'contract', 'medical', 'other'
    file_url            TEXT NOT NULL,
    expiry_date         DATE,
    verified            BOOLEAN DEFAULT false,
    verified_by         TEXT,
    verified_at         TIMESTAMPTZ,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_doc_staff ON school_staff_document(app_id, staff_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_doc_expiry ON school_staff_document(expiry_date) WHERE deleted_at IS NULL AND expiry_date IS NOT NULL;

-- Bank details
CREATE TABLE IF NOT EXISTS school_staff_bank (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    bank_name           TEXT NOT NULL,
    account_number      TEXT NOT NULL,
    ifsc_code           TEXT NOT NULL,
    account_holder_name TEXT,
    is_primary          BOOLEAN DEFAULT true,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_bank_primary ON school_staff_bank(app_id, staff_id) WHERE deleted_at IS NULL AND is_primary = true;

-- Statutory details
CREATE TABLE IF NOT EXISTS school_staff_statutory (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    pan                 TEXT,
    pf_number           TEXT,
    pf_join_date        DATE,
    esi_number          TEXT,
    esi_join_date       DATE,
    pt_registration     TEXT,
    pt_state            TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pan ON school_staff_statutory(app_id, pan) WHERE deleted_at IS NULL AND pan IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_pf ON school_staff_statutory(app_id, pf_number) WHERE deleted_at IS NULL AND pf_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_esi ON school_staff_statutory(app_id, esi_number) WHERE deleted_at IS NULL AND esi_number IS NOT NULL;

-- Nominees
CREATE TABLE IF NOT EXISTS school_staff_nominee (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    relation            TEXT NOT NULL,
    share_percent       NUMERIC(5,2) NOT NULL,
    phone               TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

-- Emergency contacts
CREATE TABLE IF NOT EXISTS school_staff_emergency_contact (
    id                  SERIAL PRIMARY KEY,
    app_id              TEXT NOT NULL DEFAULT 'default',
    staff_id            INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    relation            TEXT NOT NULL,
    phone               TEXT NOT NULL,
    is_primary          BOOLEAN DEFAULT false,
    created_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE school_staff IS 'Staff master record';
COMMENT ON TABLE school_staff_employment IS 'Effective-dated employment history';
COMMENT ON TABLE school_staff_qualification IS 'Qualifications and teachable subjects (shared with Timetable)';
COMMENT ON TABLE school_staff_document IS 'Documents with expiry tracking';
COMMENT ON TABLE school_staff_bank IS 'Bank account details for salary credit';
COMMENT ON TABLE school_staff_statutory IS 'PAN, PF, ESI, Professional Tax details';
COMMENT ON TABLE school_staff_nominee IS 'Nominees for gratuity, PF, etc.';
COMMENT ON TABLE school_staff_emergency_contact IS 'Emergency contact persons';

COMMIT;