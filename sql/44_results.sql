-- ============================================================
-- M15 Examinations — Step 4: Results
-- ============================================================
-- Creates: school_result_version, school_student_result, school_subject_result, school_grace_mark, school_revaluation_request, school_promotion_decision
-- ============================================================

BEGIN;

-- Result Version (immutable snapshot)
CREATE TABLE IF NOT EXISTS school_result_version (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  exam_id           INT REFERENCES school_exam(id) ON DELETE SET NULL,
  term_id           INT REFERENCES school_term(id) ON DELETE SET NULL,
  class_band        TEXT NOT NULL,
  version_no        INT NOT NULL,
  rule_version_id   INT REFERENCES school_result_rule(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'published', 'frozen')),
  checks_passed     BOOLEAN DEFAULT false,
  processed_by      TEXT,
  processed_at      TIMESTAMPTZ,
  published_by      TEXT,
  published_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_result_version
  ON school_result_version (app_id, exam_id, term_id, class_band, version_no)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_result_version_exam ON school_result_version(exam_id);
CREATE INDEX IF NOT EXISTS idx_result_version_term ON school_result_version(term_id);

-- Student Result (one per student per version)
CREATE TABLE IF NOT EXISTS school_student_result (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  version_id            INT REFERENCES school_result_version(id) ON DELETE CASCADE,
  student_id            INT REFERENCES school_students(id) ON DELETE CASCADE,
  total_marks           NUMERIC(8,2),
  max_total_marks       INT,
  percentage            NUMERIC(5,2),
  grade                 TEXT,
  grade_points          NUMERIC(3,1),
  rank                  INT,
  outcome               TEXT CHECK (outcome IN ('pass', 'fail', 'compartment', 'withheld', 'incomplete', 'promoted', 'detained')),
  promotion_decision    TEXT CHECK (promotion_decision IN ('promoted', 'detained', 'conditional')),
  grace_total           NUMERIC(6,2) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_result
  ON school_student_result (version_id, student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_result_outcome ON school_student_result(outcome);
CREATE INDEX IF NOT EXISTS idx_student_result_rank ON school_student_result(version_id, rank);

-- Subject Result (one per subject per student)
CREATE TABLE IF NOT EXISTS school_subject_result (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_result_id     INT REFERENCES school_student_result(id) ON DELETE CASCADE,
  paper_id              INT REFERENCES school_exam_paper(id) ON DELETE CASCADE,
  subject_id            INT REFERENCES school_subjects(id) ON DELETE SET NULL,
  marks_obtained        NUMERIC(6,2),
  max_marks             INT,
  percentage            NUMERIC(5,2),
  grade                 TEXT,
  grade_points          NUMERIC(3,1),
  outcome               TEXT CHECK (outcome IN ('pass', 'fail', 'compartment', 'withheld', 'incomplete')),
  grace_marks           NUMERIC(6,2) DEFAULT 0,
  is_additional         BOOLEAN DEFAULT false,
  counts_in_total       BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_result
  ON school_subject_result (student_result_id, paper_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subject_result_paper ON school_subject_result(paper_id);

-- Grace Marks (audited)
CREATE TABLE IF NOT EXISTS school_grace_mark (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  subject_result_id INT REFERENCES school_subject_result(id) ON DELETE CASCADE,
  marks             NUMERIC(6,2) NOT NULL,
  rule_applied      TEXT,
  reason            TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_grace_subject_result ON school_grace_mark(subject_result_id);

-- Re-evaluation Request
CREATE TABLE IF NOT EXISTS school_revaluation_request (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  student_id            INT REFERENCES school_students(id) ON DELETE CASCADE,
  paper_id              INT REFERENCES school_exam_paper(id) ON DELETE CASCADE,
  version_id            INT REFERENCES school_result_version(id) ON DELETE CASCADE,
  old_marks             NUMERIC(6,2),
  new_marks             NUMERIC(6,2),
  old_status_code       TEXT,
  new_status_code       TEXT,
  reason                TEXT NOT NULL,
  fee_paid              BOOLEAN DEFAULT false,
  status                TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  requested_by          TEXT,
  requested_at          TIMESTAMPTZ DEFAULT now(),
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  decision_reason       TEXT,
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reval_student ON school_revaluation_request(student_id);
CREATE INDEX IF NOT EXISTS idx_reval_paper ON school_revaluation_request(paper_id);
CREATE INDEX IF NOT EXISTS idx_reval_version ON school_revaluation_request(version_id);

-- Promotion Decision (links to next year enrollment)
CREATE TABLE IF NOT EXISTS school_promotion_decision (
  id                        SERIAL PRIMARY KEY,
  app_id                    TEXT NOT NULL DEFAULT 'default',
  student_id                INT REFERENCES school_students(id) ON DELETE CASCADE,
  from_academic_year_id     INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  to_academic_year_id       INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  from_class_id             INT REFERENCES school_classes(id) ON DELETE SET NULL,
  to_class_id               INT REFERENCES school_classes(id) ON DELETE SET NULL,
  to_section_id             INT REFERENCES school_sections(id) ON DELETE SET NULL,
  decision                  TEXT CHECK (decision IN ('promoted', 'detained', 'conditional')),
  based_on_version_id       INT REFERENCES school_result_version(id) ON DELETE SET NULL,
  decided_by                TEXT,
  decided_at                TIMESTAMPTZ DEFAULT now(),
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),
  deleted_at                TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_promotion
  ON school_promotion_decision (app_id, student_id, from_academic_year_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE school_result_version IS 'Immutable result snapshot with rule version';
COMMENT ON TABLE school_student_result IS 'Aggregated student result per version';
COMMENT ON TABLE school_subject_result IS 'Per-subject result with grade/outcome';
COMMENT ON TABLE school_grace_mark IS 'Audited grace marks per subject result';
COMMENT ON TABLE school_revaluation_request IS 'Re-evaluation workflow with audit trail';
COMMENT ON TABLE school_promotion_decision IS 'Promotion/detention decision linked to next year enrollment';

COMMIT;