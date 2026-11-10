-- ============================================================
-- M15 Examinations — Step 5: Report Cards
-- ============================================================
-- Creates: school_comment_bank, school_remark, school_co_scholastic_grade, school_report_card
-- ============================================================

BEGIN;

-- Comment Bank (reusable remarks)
CREATE TABLE IF NOT EXISTS school_comment_bank (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  category          TEXT, -- 'academic', 'behavior', 'attendance', 'general'
  text              TEXT NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comment_bank_category ON school_comment_bank(category);

-- Remarks (class teacher / subject teacher / principal)
CREATE TABLE IF NOT EXISTS school_remark (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  version_id        INT REFERENCES school_result_version(id) ON DELETE CASCADE,
  remark_type       TEXT CHECK (remark_type IN ('class_teacher', 'principal', 'subject_teacher')),
  author_id         TEXT,
  text              TEXT,
  comment_bank_id   INT REFERENCES school_comment_bank(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_remark_student_version ON school_remark(student_id, version_id);
CREATE INDEX IF NOT EXISTS idx_remark_type ON school_remark(remark_type);

-- Co-Scholastic Grades (art, PE, discipline, work education, etc.)
CREATE TABLE IF NOT EXISTS school_co_scholastic_grade (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_id            INT REFERENCES school_students(id) ON DELETE CASCADE,
  version_id            INT REFERENCES school_result_version(id) ON DELETE CASCADE,
  area_id               INT REFERENCES school_co_scholastic_area(id) ON DELETE CASCADE,
  grade                 TEXT,
  grade_points          NUMERIC(3,1),
  teacher_id            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_coscholastic
  ON school_co_scholastic_grade (student_id, version_id, area_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coscholastic_student ON school_co_scholastic_grade(student_id);

-- Report Card (generated artifact)
CREATE TABLE IF NOT EXISTS school_report_card (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  version_id        INT REFERENCES school_result_version(id) ON DELETE CASCADE,
  template_id       INT REFERENCES school_report_template(id) ON DELETE SET NULL,
  file_path         TEXT,
  copy_no           INT DEFAULT 1,
  generated_by      TEXT,
  generated_at      TIMESTAMPTZ DEFAULT now(),
  published_at      TIMESTAMPTZ,
  published_by      TEXT,
  status            TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'published', 'withheld')),
  withheld_reason   TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_card_student ON school_report_card(student_id, version_id);
CREATE INDEX IF NOT EXISTS idx_report_card_version ON school_report_card(version_id);
CREATE INDEX IF NOT EXISTS idx_report_card_status ON school_report_card(status);

COMMENT ON TABLE school_comment_bank IS 'Reusable comment bank for remarks';
COMMENT ON TABLE school_remark IS 'Teacher remarks per student per result version';
COMMENT ON TABLE school_co_scholastic_grade IS 'Co-scholastic grades (Art, PE, Discipline, Work Education)';
COMMENT ON TABLE school_report_card IS 'Generated report card PDF artifacts';

COMMIT;