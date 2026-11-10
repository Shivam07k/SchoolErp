-- ============================================================
-- Learning Management System — Core Schema (Step 1–4)
-- Migration: sql/85_lms_core.sql
-- ============================================================
-- Creates courses, chapters, topics, enrollments, teacher assignments,
-- assignments, submissions, evaluations, quizzes, question bank,
-- quiz attempts, study materials, folders, access tracking.
-- Safe to re-run: every object is IF NOT EXISTS.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Course hierarchy
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_lms_course (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  code                  TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  subject_id            INT REFERENCES school_subjects(id) ON DELETE SET NULL,
  class_id              INT REFERENCES school_classes(id) ON DELETE SET NULL,
  section_id            INT REFERENCES school_sections(id) ON DELETE SET NULL,
  academic_year_id      INT REFERENCES school_academic_years(id) ON DELETE SET NULL,
  term_id               INT REFERENCES school_term(id) ON DELETE SET NULL,
  credits               NUMERIC(4,2) DEFAULT 0,
  schedule              JSONB DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  publish_at            TIMESTAMPTZ,
  archive_at            TIMESTAMPTZ,
  syllabus_url          TEXT,
  thumbnail_url         TEXT,
  settings              JSONB DEFAULT '{}'::jsonb,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_course_code ON school_lms_course(app_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_course_lookup ON school_lms_course(app_id, academic_year_id, term_id, class_id, section_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_lms_course_chapter (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  course_id             INT NOT NULL REFERENCES school_lms_course(id) ON DELETE CASCADE,
  sequence              INT NOT NULL DEFAULT 0,
  title                 TEXT NOT NULL,
  description           TEXT,
  estimated_hours       NUMERIC(5,2) DEFAULT 0,
  release_at            TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
  learning_objectives   TEXT[],
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_chapter_seq ON school_lms_course_chapter(app_id, course_id, sequence) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_chapter_course ON school_lms_course_chapter(app_id, course_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_lms_course_topic (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  chapter_id            INT NOT NULL REFERENCES school_lms_course_chapter(id) ON DELETE CASCADE,
  sequence              INT NOT NULL DEFAULT 0,
  title                 TEXT NOT NULL,
  description           TEXT,
  duration_minutes      INT DEFAULT 0,
  learning_objectives   TEXT[],
  prerequisites         INT[] DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_topic_seq ON school_lms_course_topic(app_id, chapter_id, sequence) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_topic_chapter ON school_lms_course_topic(app_id, chapter_id, status) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 2. Enrollment and teacher assignment
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_lms_course_enrollment (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  course_id             INT NOT NULL REFERENCES school_lms_course(id) ON DELETE CASCADE,
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  enrolled_at           TIMESTAMPTZ DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'dropped', 'completed', 'suspended')),
  progress_pct          NUMERIC(5,2) DEFAULT 0,
  completed_at          TIMESTAMPTZ,
  dropped_at            TIMESTAMPTZ,
  drop_reason           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  UNIQUE (course_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_student ON school_lms_course_enrollment(app_id, student_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_course ON school_lms_course_enrollment(app_id, course_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_lms_course_teacher (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  course_id             INT NOT NULL REFERENCES school_lms_course(id) ON DELETE CASCADE,
  staff_id              INT NOT NULL REFERENCES school_staff(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'co_teacher', 'ta', 'grader')),
  assigned_at           TIMESTAMPTZ DEFAULT now(),
  removed_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, staff_id, role)
);
CREATE INDEX IF NOT EXISTS idx_lms_course_teacher_staff ON school_lms_course_teacher(app_id, staff_id);

-- ------------------------------------------------------------
-- 3. Assignments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_lms_assignment (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  course_id             INT NOT NULL REFERENCES school_lms_course(id) ON DELETE CASCADE,
  chapter_id            INT REFERENCES school_lms_course_chapter(id) ON DELETE SET NULL,
  topic_id              INT REFERENCES school_lms_course_topic(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  type                  TEXT NOT NULL DEFAULT 'homework' CHECK (type IN ('homework', 'project', 'essay', 'practical', 'lab_report', 'presentation', 'portfolio', 'other')),
  max_marks             NUMERIC(8,2) NOT NULL DEFAULT 100,
  weightage             NUMERIC(5,2) DEFAULT 1.0,
  release_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at                TIMESTAMPTZ NOT NULL,
  late_policy           TEXT NOT NULL DEFAULT 'none' CHECK (late_policy IN ('none', 'penalty_pct_per_day', 'hard_cutoff', 'grace_period')),
  late_penalty_pct      NUMERIC(5,2) DEFAULT 0,
  grace_period_hours    INT DEFAULT 0,
  allow_resubmission    BOOLEAN DEFAULT false,
  max_resubmissions     INT DEFAULT 0,
  submission_types      TEXT[] DEFAULT '{text,file}',
  max_file_size_mb      INT DEFAULT 50,
  allowed_file_types    TEXT[] DEFAULT '{}',
  rubric_template       JSONB DEFAULT '[]'::jsonb,
  instructions          TEXT,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lms_assignment_course ON school_lms_assignment(app_id, course_id, status, due_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_assignment_due ON school_lms_assignment(app_id, due_at, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_lms_assignment_file (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  assignment_id         INT NOT NULL REFERENCES school_lms_assignment(id) ON DELETE CASCADE,
  file_url              TEXT NOT NULL,
  file_name             TEXT NOT NULL,
  file_size             BIGINT DEFAULT 0,
  mime_type             TEXT,
  uploaded_by           TEXT,
  uploaded_at           TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lms_assignment_file_assignment ON school_lms_assignment_file(app_id, assignment_id);

CREATE TABLE IF NOT EXISTS school_lms_assignment_submission (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  assignment_id         INT NOT NULL REFERENCES school_lms_assignment(id) ON DELETE CASCADE,
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  content_text          TEXT,
  submitted_at          TIMESTAMPTZ DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'late', 'resubmitted', 'graded', 'returned', 'draft')),
  attempt_no            INT NOT NULL DEFAULT 1,
  is_late               BOOLEAN DEFAULT false,
  late_penalty_applied  NUMERIC(8,2) DEFAULT 0,
  graded_at             TIMESTAMPTZ,
  graded_by             TEXT,
  returned_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assignment_id, student_id, attempt_no)
);
CREATE INDEX IF NOT EXISTS idx_lms_submission_assignment ON school_lms_assignment_submission(app_id, assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_lms_submission_student ON school_lms_assignment_submission(app_id, student_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS school_lms_assignment_submission_file (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  submission_id         INT NOT NULL REFERENCES school_lms_assignment_submission(id) ON DELETE CASCADE,
  file_url              TEXT NOT NULL,
  file_name             TEXT NOT NULL,
  file_size             BIGINT DEFAULT 0,
  mime_type             TEXT,
  uploaded_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lms_submission_file_submission ON school_lms_assignment_submission_file(app_id, submission_id);

CREATE TABLE IF NOT EXISTS school_lms_assignment_evaluation (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  submission_id         INT NOT NULL REFERENCES school_lms_assignment_submission(id) ON DELETE CASCADE,
  evaluated_by          TEXT,
  marks_obtained        NUMERIC(8,2) NOT NULL DEFAULT 0,
  feedback              TEXT,
  rubric_scores         JSONB DEFAULT '[]'::jsonb,
  evaluated_at          TIMESTAMPTZ DEFAULT now(),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'corrected')),
  grade                 TEXT,
  correction_reason     TEXT,
  corrected_at          TIMESTAMPTZ,
  corrected_by          TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (submission_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_evaluation_status ON school_lms_assignment_evaluation(app_id, status, evaluated_at DESC);

-- ------------------------------------------------------------
-- 4. Quizzes and Question Bank
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_lms_question_bank (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  subject_id            INT REFERENCES school_subjects(id) ON DELETE SET NULL,
  chapter_id            INT REFERENCES school_lms_course_chapter(id) ON DELETE SET NULL,
  topic_id              INT REFERENCES school_lms_course_topic(id) ON DELETE SET NULL,
  type                  TEXT NOT NULL DEFAULT 'mcq_single' CHECK (type IN ('mcq_single', 'mcq_multi', 'true_false', 'fill_blank', 'short_answer', 'essay', 'matching', 'ordering', 'hotspot', 'drag_drop')),
  difficulty            TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  marks                 NUMERIC(6,2) NOT NULL DEFAULT 1,
  stem                  TEXT NOT NULL,
  explanation           TEXT,
  tags                  JSONB DEFAULT '[]'::jsonb,
  metadata              JSONB DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  usage_count           INT DEFAULT 0,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lms_question_lookup ON school_lms_question_bank(app_id, subject_id, chapter_id, topic_id, type, difficulty, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_question_tags ON school_lms_question_bank USING GIN (tags);

CREATE TABLE IF NOT EXISTS school_lms_question_option (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  question_id           INT NOT NULL REFERENCES school_lms_question_bank(id) ON DELETE CASCADE,
  option_text           TEXT NOT NULL,
  is_correct            BOOLEAN DEFAULT false,
  sequence              INT NOT NULL DEFAULT 0,
  feedback              TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lms_option_question ON school_lms_question_option(app_id, question_id, sequence);

CREATE TABLE IF NOT EXISTS school_lms_quiz (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  course_id             INT NOT NULL REFERENCES school_lms_course(id) ON DELETE CASCADE,
  chapter_id            INT REFERENCES school_lms_course_chapter(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  type                  TEXT NOT NULL DEFAULT 'formative' CHECK (type IN ('practice', 'formative', 'summative', 'exam', 'diagnostic')),
  time_limit_minutes    INT,
  max_attempts          INT DEFAULT 1,
  shuffle_questions     BOOLEAN DEFAULT false,
  shuffle_options       BOOLEAN DEFAULT false,
  show_results          TEXT NOT NULL DEFAULT 'immediate' CHECK (show_results IN ('immediate', 'after_deadline', 'manual', 'never')),
  release_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at                TIMESTAMPTZ,
  passing_score_pct     NUMERIC(5,2) DEFAULT 0,
  allow_review          BOOLEAN DEFAULT true,
  show_correct_answers  BOOLEAN DEFAULT true,
  instructions          TEXT,
  settings              JSONB DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lms_quiz_course ON school_lms_quiz(app_id, course_id, status, release_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_lms_quiz_question (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  quiz_id               INT NOT NULL REFERENCES school_lms_quiz(id) ON DELETE CASCADE,
  question_id           INT NOT NULL REFERENCES school_lms_question_bank(id) ON DELETE CASCADE,
  marks_override        NUMERIC(6,2),
  sequence              INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (quiz_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_quiz_question_quiz ON school_lms_quiz_question(app_id, quiz_id, sequence);

CREATE TABLE IF NOT EXISTS school_lms_quiz_attempt (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  quiz_id               INT NOT NULL REFERENCES school_lms_quiz(id) ON DELETE CASCADE,
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  started_at            TIMESTAMPTZ DEFAULT now(),
  submitted_at          TIMESTAMPTZ,
  time_spent_seconds    INT DEFAULT 0,
  score                 NUMERIC(8,2) DEFAULT 0,
  max_score             NUMERIC(8,2) DEFAULT 0,
  score_pct             NUMERIC(5,2) DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded', 'abandoned', 'expired')),
  attempt_no            INT NOT NULL DEFAULT 1,
  source                TEXT DEFAULT 'online' CHECK (source IN ('online', 'offline')),
  ip_address            INET,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (quiz_id, student_id, attempt_no)
);
CREATE INDEX IF NOT EXISTS idx_lms_attempt_quiz ON school_lms_quiz_attempt(app_id, quiz_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_attempt_student ON school_lms_quiz_attempt(app_id, student_id, quiz_id, attempt_no);

CREATE TABLE IF NOT EXISTS school_lms_quiz_answer (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  attempt_id            INT NOT NULL REFERENCES school_lms_quiz_attempt(id) ON DELETE CASCADE,
  question_id           INT NOT NULL REFERENCES school_lms_question_bank(id) ON DELETE CASCADE,
  answer_data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  marks_awarded         NUMERIC(8,2) DEFAULT 0,
  auto_graded           BOOLEAN DEFAULT false,
  graded_by             TEXT,
  graded_at             TIMESTAMPTZ,
  time_spent_seconds    INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_answer_attempt ON school_lms_quiz_answer(app_id, attempt_id);

-- ------------------------------------------------------------
-- 5. Study Materials
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_lms_material_folder (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  course_id             INT NOT NULL REFERENCES school_lms_course(id) ON DELETE CASCADE,
  parent_folder_id      INT REFERENCES school_lms_material_folder(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  sequence              INT NOT NULL DEFAULT 0,
  description           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lms_folder_seq ON school_lms_material_folder(app_id, course_id, parent_folder_id, sequence) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_folder_course ON school_lms_material_folder(app_id, course_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_lms_study_material (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  course_id             INT NOT NULL REFERENCES school_lms_course(id) ON DELETE CASCADE,
  chapter_id            INT REFERENCES school_lms_course_chapter(id) ON DELETE SET NULL,
  topic_id              INT REFERENCES school_lms_course_topic(id) ON DELETE SET NULL,
  folder_id             INT REFERENCES school_lms_material_folder(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  type                  TEXT NOT NULL DEFAULT 'document' CHECK (type IN ('pdf', 'video', 'audio', 'document', 'link', 'embed', 'scorm', 'html_package', 'image', 'other')),
  source_url            TEXT,
  file_url              TEXT,
  file_size             BIGINT DEFAULT 0,
  mime_type             TEXT,
  duration_seconds      INT,
  version               INT DEFAULT 1,
  is_published          BOOLEAN DEFAULT false,
  release_at            TIMESTAMPTZ,
  expiry_at             TIMESTAMPTZ,
  access_level          TEXT NOT NULL DEFAULT 'enrolled' CHECK (access_level IN ('enrolled', 'public', 'teacher_only', 'parent')),
  tags                  JSONB DEFAULT '[]'::jsonb,
  metadata              JSONB DEFAULT '{}'::jsonb,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_lms_material_course ON school_lms_study_material(app_id, course_id, is_published, release_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_material_folder ON school_lms_study_material(app_id, folder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lms_material_type ON school_lms_study_material(app_id, type, is_published) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS school_lms_material_access (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  material_id           INT NOT NULL REFERENCES school_lms_study_material(id) ON DELETE CASCADE,
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  accessed_at           TIMESTAMPTZ DEFAULT now(),
  duration_seconds      INT DEFAULT 0,
  progress_pct          NUMERIC(5,2) DEFAULT 0,
  position_data         JSONB DEFAULT '{}'::jsonb,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lms_material_access_material ON school_lms_material_access(app_id, material_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_material_access_student ON school_lms_material_access(app_id, student_id, material_id, accessed_at DESC);

CREATE TABLE IF NOT EXISTS school_lms_material_bookmark (
  id                    SERIAL PRIMARY KEY,
  app_id                TEXT NOT NULL DEFAULT 'default',
  material_id           INT NOT NULL REFERENCES school_lms_study_material(id) ON DELETE CASCADE,
  student_id            INT NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  position_data         JSONB DEFAULT '{}'::jsonb,
  note                  TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (material_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_lms_bookmark_student ON school_lms_material_bookmark(app_id, student_id);

-- Settings
CREATE TABLE IF NOT EXISTS school_lms_setting (
  id              SERIAL PRIMARY KEY,
  app_id          TEXT NOT NULL DEFAULT 'default',
  setting_key     TEXT NOT NULL,
  setting_value   JSONB NOT NULL,
  description     TEXT,
  is_editable     BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (app_id, setting_key)
);

COMMIT;