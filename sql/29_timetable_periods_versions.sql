/* Migration 29: Timetable Period Templates and Versioning
   Adds canonical period configuration and effective-dated timetable versions.
   Backfills existing timetable rows into a baseline published version. */

BEGIN;

/* Enable btree_gist for integer/date/time GiST support */
CREATE EXTENSION IF NOT EXISTS btree_gist;

/* ============================================================
   1. Period Templates - canonical period definitions per campus
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_periods (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL,
  campus_id   INT REFERENCES school_campuses(id) ON DELETE SET NULL,
  code        TEXT NOT NULL,
  label       TEXT NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

/* Drop old unique index if it exists (from previous migration run) */
DROP INDEX IF EXISTS uq_school_periods_app_code;

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_periods_app_campus_code
  ON school_periods (app_id, campus_id, code);
CREATE INDEX IF NOT EXISTS ix_school_periods_app_campus
  ON school_periods (app_id, campus_id);

COMMENT ON TABLE school_periods IS 'Canonical period templates per campus. Timetable entries reference these.';

/* ============================================================
   2. Timetable Versions - effective-dated schedule versions
   ============================================================ */
CREATE TABLE IF NOT EXISTS school_timetable_versions (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL,
  academic_year_id      INT NOT NULL REFERENCES school_academic_years(id) ON DELETE RESTRICT,
  name                  TEXT NOT NULL,
  effective_from        DATE NOT NULL,
  effective_to          DATE,
  status                TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  version               INT NOT NULL DEFAULT 1,
  parent_version_id     INT REFERENCES school_timetable_versions(id) ON DELETE SET NULL,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_timetable_versions_app_year_eff
  ON school_timetable_versions (app_id, academic_year_id, effective_from);
CREATE INDEX IF NOT EXISTS ix_school_timetable_versions_app_year_status
  ON school_timetable_versions (app_id, academic_year_id, status);

/* Exclusion constraint: prevent overlapping published versions for same academic year */
ALTER TABLE school_timetable_versions
  DROP CONSTRAINT IF EXISTS excl_school_timetable_versions_no_overlap_published;
ALTER TABLE school_timetable_versions
  ADD CONSTRAINT excl_school_timetable_versions_no_overlap_published
  EXCLUDE USING GIST (
    app_id WITH =,
    academic_year_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date)) WITH &&
  ) WHERE (status = 'published');

COMMENT ON TABLE school_timetable_versions IS 'Effective-dated timetable versions. Each version contains a complete weekly schedule.';

/* ============================================================
   3. Add version_id and period_id to school_timetables
   ============================================================ */
ALTER TABLE school_timetables
  ADD COLUMN IF NOT EXISTS version_id INT REFERENCES school_timetable_versions(id) ON DELETE RESTRICT;

ALTER TABLE school_timetables
  ADD COLUMN IF NOT EXISTS period_id INT REFERENCES school_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_school_timetables_version
  ON school_timetables (version_id);
CREATE INDEX IF NOT EXISTS ix_school_timetables_period
  ON school_timetables (period_id);

/* ============================================================
   4. Unique constraints for conflict prevention (per version + period)
   ============================================================ */
-- Room conflict: one room per period per day per version
ALTER TABLE school_timetables
  DROP CONSTRAINT IF EXISTS uq_timetable_room_slot;
ALTER TABLE school_timetables
  ADD CONSTRAINT uq_timetable_room_slot
  UNIQUE (version_id, room_id, day_of_week, period_id);

-- Teacher conflict: one teacher per period per day per version
ALTER TABLE school_timetables
  DROP CONSTRAINT IF EXISTS uq_timetable_teacher_slot;
ALTER TABLE school_timetables
  ADD CONSTRAINT uq_timetable_teacher_slot
  UNIQUE (version_id, teacher_id, day_of_week, period_id);

-- Class/Section conflict: one class+section per period per day per version
ALTER TABLE school_timetables
  DROP CONSTRAINT IF EXISTS uq_timetable_class_section_slot;
ALTER TABLE school_timetables
  ADD CONSTRAINT uq_timetable_class_section_slot
  UNIQUE (version_id, class_id, section_id, day_of_week, period_id);

/* ============================================================
   5. Seed default period templates for each campus
   ============================================================ */
INSERT INTO school_periods (app_id, campus_id, code, label, start_time, end_time, sort_order)
SELECT c.app_id, c.id, p.code, p.label, p.start_time::time, p.end_time::time, p.sort_order
FROM school_campuses c
CROSS JOIN LATERAL (
  VALUES
    ('P1', 'Period 1', '08:00', '08:45', 1),
    ('P2', 'Period 2', '08:50', '09:35', 2),
    ('P3', 'Period 3', '09:40', '10:25', 3),
    ('P4', 'Period 4', '10:35', '11:20', 4),
    ('P5', 'Period 5', '11:25', '12:10', 5),
    ('P6', 'Period 6', '12:15', '13:00', 6),
    ('P7', 'Period 7', '13:05', '13:50', 7),
    ('P8', 'Period 8', '13:55', '14:40', 8)
) AS p(code, label, start_time, end_time, sort_order)
ON CONFLICT (app_id, campus_id, code) DO NOTHING;

/* ============================================================
   6. Backfill existing timetable rows into baseline versions
   One published version per academic year that has timetable data.
   Rows with no academic_year_id get a catch-all version.
   Uses upsert logic to handle re-runs without leaving rows unattached.
   ============================================================ */
WITH baseline_versions AS (
  INSERT INTO school_timetable_versions (app_id, academic_year_id, name, effective_from, effective_to, status, version, created_by)
  SELECT DISTINCT
    t.app_id,
    t.academic_year_id,
    'Baseline Schedule' AS name,
    COALESCE(ay.start_date, CURRENT_DATE) AS effective_from,
    ay.end_date AS effective_to,
    'published' AS status,
    1 AS version,
    'system_migration_29' AS created_by
  FROM school_timetables t
  JOIN school_academic_years ay ON ay.id = t.academic_year_id AND ay.app_id = t.app_id
  WHERE t.version_id IS NULL
  ON CONFLICT (app_id, academic_year_id, effective_from) DO UPDATE SET
    effective_to = EXCLUDED.effective_to,
    status = EXCLUDED.status,
    version = EXCLUDED.version,
    updated_at = now()
  RETURNING id, app_id, academic_year_id
)
UPDATE school_timetables t
SET version_id = bv.id
FROM baseline_versions bv
WHERE t.app_id = bv.app_id
  AND t.academic_year_id = bv.academic_year_id
  AND t.version_id IS NULL;

/* For rows with academic_year_id but no version (e.g., duplicate effective_from conflict) */
WITH fallback_versions AS (
  INSERT INTO school_timetable_versions (app_id, academic_year_id, name, effective_from, effective_to, status, version, created_by)
  SELECT DISTINCT
    t.app_id,
    t.academic_year_id,
    'Baseline Schedule (fallback)' AS name,
    COALESCE(ay.start_date, CURRENT_DATE) AS effective_from,
    ay.end_date AS effective_to,
    'published' AS status,
    1 AS version,
    'system_migration_29' AS created_by
  FROM school_timetables t
  JOIN school_academic_years ay ON ay.id = t.academic_year_id AND ay.app_id = t.app_id
  WHERE t.version_id IS NULL
  ON CONFLICT (app_id, academic_year_id, effective_from) DO UPDATE SET
    effective_to = EXCLUDED.effective_to,
    status = EXCLUDED.status,
    version = EXCLUDED.version,
    updated_at = now()
  RETURNING id, app_id, academic_year_id
)
UPDATE school_timetables t
SET version_id = fv.id
FROM fallback_versions fv
WHERE t.app_id = fv.app_id
  AND t.academic_year_id = fv.academic_year_id
  AND t.version_id IS NULL;

/* For any remaining timetable rows without academic_year_id, create a catch-all version per app.
   If no academic year exists for the app, create a dummy one first. */
/* First, ensure each app has at least one academic year */
INSERT INTO school_academic_years (app_id, name, start_date, end_date, is_active, is_closed)
SELECT t.app_id, 'Legacy Year', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', true, false
FROM school_timetables t
WHERE t.version_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM school_academic_years ay WHERE ay.app_id = t.app_id)
GROUP BY t.app_id
ON CONFLICT DO NOTHING;

/* Now create catch-all versions for apps that have timetable rows without version_id */
WITH catchall AS (
  INSERT INTO school_timetable_versions (app_id, academic_year_id, name, effective_from, effective_to, status, version, created_by)
  SELECT
    t.app_id,
    (SELECT id FROM school_academic_years WHERE app_id = t.app_id ORDER BY start_date LIMIT 1) AS academic_year_id,
    'Baseline Schedule (catch-all)' AS name,
    CURRENT_DATE AS effective_from,
    NULL AS effective_to,
    'published' AS status,
    1 AS version,
    'system_migration_29' AS created_by
  FROM school_timetables t
  WHERE t.version_id IS NULL
  GROUP BY t.app_id
  ON CONFLICT (app_id, academic_year_id, effective_from) DO UPDATE SET
    effective_to = EXCLUDED.effective_to,
    status = EXCLUDED.status,
    version = EXCLUDED.version,
    updated_at = now()
  RETURNING id, app_id, academic_year_id
)
UPDATE school_timetables t
SET version_id = c.id,
    academic_year_id = c.academic_year_id
FROM catchall c
WHERE t.app_id = c.app_id
  AND t.version_id IS NULL;

/* ============================================================
   7. Backfill period_id from period_no by matching campus periods
   Timetable rows are linked to a room, which has a campus_id.
   Match periods for that specific campus.
   ============================================================ */
WITH period_map AS (
  SELECT p.id, p.app_id, p.campus_id, p.sort_order, p.code
  FROM school_periods p
  WHERE p.is_active
),
timetable_with_campus AS (
  SELECT t.id AS timetable_id, t.app_id, t.period_no, r.campus_id
  FROM school_timetables t
  JOIN school_rooms r ON r.id = t.room_id AND r.app_id = t.app_id
  WHERE t.period_id IS NULL
    AND t.room_id IS NOT NULL
)
UPDATE school_timetables t
SET period_id = pm.id
FROM period_map pm
JOIN timetable_with_campus tc ON tc.app_id = pm.app_id AND tc.campus_id = pm.campus_id AND tc.period_no = pm.sort_order
WHERE t.id = tc.timetable_id
  AND t.period_id IS NULL;

/* For any remaining without period_id (e.g., rows without room_id), assign first available period for that app/campus.
   For rows without a room, use the first campus for that app. If no campus exists, use the first period for that app regardless of campus. */
WITH first_period AS (
  SELECT DISTINCT ON (app_id, campus_id) id, app_id, campus_id
  FROM school_periods
  WHERE is_active
  ORDER BY app_id, campus_id, sort_order
),
timetable_with_campus AS (
  SELECT t.id AS timetable_id, t.app_id, COALESCE(r.campus_id, 
    (SELECT id FROM school_campuses WHERE app_id = t.app_id ORDER BY id LIMIT 1)) AS campus_id
  FROM school_timetables t
  LEFT JOIN school_rooms r ON r.id = t.room_id AND r.app_id = t.app_id
  WHERE t.period_id IS NULL
),
timetable_no_campus AS (
  SELECT t.id AS timetable_id, t.app_id
  FROM school_timetables t
  LEFT JOIN school_rooms r ON r.id = t.room_id AND r.app_id = t.app_id
  LEFT JOIN school_campuses c ON c.app_id = t.app_id
  WHERE t.period_id IS NULL
    AND (r.campus_id IS NULL AND c.id IS NULL)
)
UPDATE school_timetables t
SET period_id = fp.id
FROM first_period fp
JOIN (
  SELECT * FROM timetable_with_campus
  UNION ALL
  SELECT t.timetable_id, t.app_id, fp2.id AS period_id
  FROM timetable_no_campus t
  CROSS JOIN LATERAL (
    SELECT id FROM school_periods p WHERE p.app_id = t.app_id AND p.is_active ORDER BY sort_order LIMIT 1
  ) fp2
) tc ON tc.app_id = fp.app_id AND (tc.campus_id = fp.campus_id OR tc.campus_id IS NULL)
WHERE t.id = tc.timetable_id
  AND t.period_id IS NULL;

/* ============================================================
   8. Make version_id NOT NULL for new rows (after backfill)
   ============================================================ */
-- Note: We don't add NOT NULL yet to avoid breaking existing inserts.
-- Application code must now provide version_id. A future migration can add NOT NULL.

COMMIT;