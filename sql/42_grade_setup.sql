-- ============================================================
-- M15 Examinations — Step 2: Grade Setup
-- ============================================================
-- Creates: school_grade_scale, school_grade_band, school_result_rule, school_report_template
-- ============================================================

BEGIN;

-- Grade Scale (versioned per academic year)
CREATE TABLE IF NOT EXISTS school_grade_scale (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  academic_year_id  INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  version           INT DEFAULT 1,
  effective_from    DATE DEFAULT CURRENT_DATE,
  is_active         BOOLEAN DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_scale_year_name
  ON school_grade_scale (app_id, academic_year_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_grade_scale_year ON school_grade_scale(academic_year_id);

-- Grade Bands (per class band: Primary, Middle, Senior)
CREATE TABLE IF NOT EXISTS school_grade_band (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  scale_id          INT REFERENCES school_grade_scale(id) ON DELETE CASCADE,
  class_band        TEXT NOT NULL, -- 'primary', 'middle', 'senior', 'custom'
  min_percent       NUMERIC(5,2) NOT NULL,
  max_percent       NUMERIC(5,2) NOT NULL,
  grade             TEXT NOT NULL,
  grade_points      NUMERIC(3,1),
  remark            TEXT,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grade_band_scale ON school_grade_band(scale_id);
CREATE INDEX IF NOT EXISTS idx_grade_band_band ON school_grade_band(class_band);

-- Result Rules (versioned per academic year and class band)
CREATE TABLE IF NOT EXISTS school_result_rule (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  academic_year_id      INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_band            TEXT NOT NULL,
  version               INT DEFAULT 1,
  effective_from        DATE DEFAULT CURRENT_DATE,
  
  -- Weightage scheme (exam type -> %)
  weightage_scheme      JSONB NOT NULL DEFAULT '{}',
  -- {"unit_test": 10, "half_yearly": 40, "annual": 50}
  
  -- Best-of rule
  best_of_rule          JSONB,
  -- {"enabled": true, "n": 2, "of": 3, "exam_types": ["unit_test"]}
  
  -- Pass rule
  pass_rule             JSONB NOT NULL DEFAULT '{}',
  -- {"per_subject": 33, "aggregate": 33, "both_required": true}
  
  -- Grace marks
  grace_rule            JSONB,
  -- {"enabled": true, "max_per_subject": 5, "max_total": 15, "only_if_close": true, "close_threshold": 5}
  
  -- Compartment
  compartment_rule      JSONB,
  -- {"max_failed_subjects": 2, "allowed": true}
  
  -- Rounding
  rounding_rule         TEXT DEFAULT 'nearest' CHECK (rounding_rule IN ('none', 'nearest', 'up')),
  
  -- Rank
  rank_rule             JSONB,
  -- {"enabled": true, "tie": "same_rank", "scope": "section"} -- section, class, school
  
  -- Optional/additional subject
  optional_subject_rule JSONB,
  -- {"count_in_total": false, "grade_only": true}
  
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_result_rule_year_band
  ON school_result_rule (app_id, academic_year_id, class_band, version)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_result_rule_year ON school_result_rule(academic_year_id);

-- Report Templates (per class band)
CREATE TABLE IF NOT EXISTS school_report_template (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  academic_year_id  INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_band        TEXT NOT NULL,
  name              TEXT NOT NULL,
  layout            JSONB NOT NULL,
  is_default        BOOLEAN DEFAULT false,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_template_year_band ON school_report_template(academic_year_id, class_band);

-- Co-Scholastic Areas
CREATE TABLE IF NOT EXISTS school_co_scholastic_area (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  grading_type      TEXT DEFAULT 'grade' CHECK (grading_type IN ('grade', 'descriptive')),
  class_bands       TEXT[] DEFAULT '{}',
  sort_order        INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

COMMENT ON TABLE school_grade_scale IS 'Grade scale definition per academic year (CBSE, ICSE, Custom)';
COMMENT ON TABLE school_grade_band IS 'Grade bands per class band (Primary/Middle/Senior) with min/max %, grade, points';
COMMENT ON TABLE school_result_rule IS 'Versioned result calculation rules per class band';
COMMENT ON TABLE school_report_template IS 'Report card template definition per class band';
COMMENT ON TABLE school_co_scholastic_area IS 'Co-scholastic areas (Art, PE, Discipline, Work Education)';

COMMIT;