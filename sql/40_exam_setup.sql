-- ============================================================
-- M15 Examinations — Step 1: Exam Setup
-- ============================================================
-- Creates: school_term, school_exam, school_exam_paper, school_paper_component, school_student_subject
-- ============================================================

BEGIN;

-- Terms
CREATE TABLE IF NOT EXISTS school_term (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  academic_year_id  INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  weightage         NUMERIC(5,2),
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_term_year_name
  ON school_term (app_id, academic_year_id, name)
  WHERE deleted_at IS NULL;

-- Exams
CREATE TABLE IF NOT EXISTS school_exam (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  term_id           INT REFERENCES school_term(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('unit_test', 'half_yearly', 'annual', 'pre_board', 'other')),
  weightage         NUMERIC(5,2) DEFAULT 0,
  start_date        DATE,
  end_date          DATE,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'marks_entry_open', 'marks_locked', 'processed', 'published', 'frozen')),
  best_of_n         INT,
  best_of_m         INT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_term ON school_exam(app_id, term_id);
CREATE INDEX IF NOT EXISTS idx_exam_status ON school_exam(status);

-- Exam Papers
CREATE TABLE IF NOT EXISTS school_exam_paper (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  exam_id           INT REFERENCES school_exam(id) ON DELETE CASCADE,
  class_id          INT REFERENCES school_classes(id) ON DELETE SET NULL,
  subject_id        INT REFERENCES school_subjects(id) ON DELETE SET NULL,
  max_marks         INT NOT NULL,
  pass_marks        INT NOT NULL,
  grades_only       BOOLEAN DEFAULT false,
  counts_in_total   BOOLEAN DEFAULT true,
  optional_subject  BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_paper
  ON school_exam_paper (app_id, exam_id, class_id, subject_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_paper_exam ON school_exam_paper(exam_id);
CREATE INDEX IF NOT EXISTS idx_paper_class ON school_exam_paper(class_id);

-- Paper Components
CREATE TABLE IF NOT EXISTS school_paper_component (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  paper_id          INT REFERENCES school_exam_paper(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  max_marks         INT NOT NULL,
  pass_minimum      INT,
  is_mandatory      BOOLEAN DEFAULT true,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_component
  ON school_paper_component (app_id, paper_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_component_paper ON school_paper_component(paper_id);

-- Student Subject Mapping (optional/additional subjects, language choice)
CREATE TABLE IF NOT EXISTS school_student_subject (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  subject_id        INT REFERENCES school_subjects(id) ON DELETE SET NULL,
  academic_year_id  INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  is_optional       BOOLEAN DEFAULT false,
  is_additional     BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_subject
  ON school_student_subject (app_id, student_id, subject_id, academic_year_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_subject_student ON school_student_subject(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subject_year ON school_student_subject(academic_year_id);

-- Comments
COMMENT ON TABLE school_term IS 'Academic terms within a year (Term 1, Half Yearly, Annual)';
COMMENT ON TABLE school_exam IS 'Exam definition with type, weightage, lifecycle status';
COMMENT ON TABLE school_exam_paper IS 'Exam paper per class-subject with max/pass marks and flags';
COMMENT ON TABLE school_paper_component IS 'Components of a paper (Theory, Practical, Internal, Oral)';
COMMENT ON TABLE school_student_subject IS 'Student-specific subject choices (optional, additional, language)';

COMMIT;