BEGIN;

ALTER TABLE school_students ADD COLUMN IF NOT EXISTS photo_url text;

CREATE TABLE IF NOT EXISTS school_option_sets (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL,
  campus_id   integer,
  code        text NOT NULL,
  label       text NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(app_id, campus_id, code)
);

CREATE TABLE IF NOT EXISTS school_option_items (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL,
  set_id        integer NOT NULL REFERENCES school_option_sets(id) ON DELETE CASCADE,
  value         text NOT NULL,
  label         text NOT NULL,
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(set_id, value)
);

CREATE INDEX IF NOT EXISTS idx_school_option_items_set ON school_option_items (set_id, sort_order);

COMMIT;
