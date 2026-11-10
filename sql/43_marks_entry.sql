-- ============================================================
-- M15 Examinations — Step 3: Marks Entry
-- ============================================================
-- Creates: school_marks_sheet, school_mark_entry, school_mark_correction, school_moderation
-- ============================================================

BEGIN;

-- Marks Sheet (one per paper + section)
CREATE TABLE IF NOT EXISTS school_marks_sheet (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  exam_id           INT REFERENCES school_exam(id) ON DELETE CASCADE,
  paper_id          INT REFERENCES school_exam_paper(id) ON DELETE CASCADE,
  section_id        INT REFERENCES school_sections(id) ON DELETE CASCADE,
  state             TEXT DEFAULT 'not_started' CHECK (state IN ('not_started', 'draft', 'submitted', 'verified', 'locked', 'reopened')),
  deadline          TIMESTAMPTZ,
  submitted_by      TEXT,
  submitted_at      TIMESTAMPTZ,
  verified_by       TEXT,
  verified_at       TIMESTAMPTZ,
  locked_by         TEXT,
  locked_at         TIMESTAMPTZ,
  reopened_by       TEXT,
  reopened_at       TIMESTAMPTZ,
  reopen_reason     TEXT,
  row_version       INT DEFAULT 1,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marks_sheet
  ON school_marks_sheet (app_id, paper_id, section_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marks_sheet_exam ON school_marks_sheet(exam_id, state);
CREATE INDEX IF NOT EXISTS idx_marks_sheet_section ON school_marks_sheet(section_id, state);

-- Mark Entry (one per student per component)
CREATE TABLE IF NOT EXISTS school_mark_entry (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  sheet_id          INT REFERENCES school_marks_sheet(id) ON DELETE CASCADE,
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  component_id      INT REFERENCES school_paper_component(id) ON DELETE CASCADE,
  marks             NUMERIC(6,2), -- NULL = not entered; 0 = zero marks
  status_code       TEXT CHECK (status_code IN ('AB', 'EX', 'ML', 'UFM', 'WH')),
  entered_by        TEXT,
  entered_at        TIMESTAMPTZ DEFAULT now(),
  updated_by        TEXT,
  updated_at        TIMESTAMPTZ DEFAULT now(),
  row_version       INT DEFAULT 1,
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mark_entry
  ON school_mark_entry (sheet_id, student_id, component_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mark_entry_student ON school_mark_entry(student_id);
CREATE INDEX IF NOT EXISTS idx_mark_entry_sheet ON school_mark_entry(sheet_id);

-- Mark Correction (audited changes after lock)
CREATE TABLE IF NOT EXISTS school_mark_correction (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  entry_id              INT REFERENCES school_mark_entry(id) ON DELETE CASCADE,
  sheet_id              INT REFERENCES school_marks_sheet(id) ON DELETE CASCADE,
  student_id            INT REFERENCES school_students(id) ON DELETE CASCADE,
  old_marks             NUMERIC(6,2),
  new_marks             NUMERIC(6,2),
  old_status_code       TEXT,
  new_status_code       TEXT,
  reason                TEXT NOT NULL,
  requested_by          TEXT,
  requested_at          TIMESTAMPTZ DEFAULT now(),
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  decision              TEXT CHECK (decision IN ('approved', 'rejected')),
  decision_reason       TEXT,
  processed_at          TIMESTAMPTZ,
  override              BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mark_correction_sheet ON school_mark_correction(sheet_id);
CREATE INDEX IF NOT EXISTS idx_mark_correction_student ON school_mark_correction(student_id);

-- Moderation (separate audited step)
CREATE TABLE IF NOT EXISTS school_moderation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  paper_id          INT REFERENCES school_exam_paper(id) ON DELETE CASCADE,
  section_id        INT REFERENCES school_sections(id) ON DELETE CASCADE,
  method            TEXT CHECK (method IN ('scale', 'add', 'cap')),
  parameters        JSONB NOT NULL,
  reason            TEXT,
  applied_by        TEXT,
  applied_at        TIMESTAMPTZ DEFAULT now(),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_moderation_paper ON school_moderation(paper_id, section_id);

COMMENT ON TABLE school_marks_sheet IS 'Marks sheet per paper+section with lifecycle state';
COMMENT ON TABLE school_mark_entry IS 'Individual mark entry per student per component with status codes';
COMMENT ON TABLE school_mark_correction IS 'Audited corrections on locked sheets';
COMMENT ON TABLE school_moderation IS 'Moderation/scaling applied to papers';

COMMIT;