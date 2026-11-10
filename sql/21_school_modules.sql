-- Generic records for school modules. Every navigation sub-page can store its
-- own rows here without needing a dedicated table, so all modules are usable
-- immediately and can be promoted to their own schema later.

CREATE TABLE IF NOT EXISTS school_module_records (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL,
  module_key  TEXT NOT NULL,
  sub_key     TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  ref_no      TEXT,
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  record_date DATE,
  campus_id   INTEGER,
  notes       TEXT,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_school_module_records_lookup
  ON school_module_records (app_id, module_key, sub_key, id DESC);

CREATE INDEX IF NOT EXISTS idx_school_module_records_campus
  ON school_module_records (app_id, campus_id);

CREATE INDEX IF NOT EXISTS idx_school_module_records_active
  ON school_module_records (app_id, module_key, sub_key)
  WHERE deleted_at IS NULL;
