/* ============================================================
   Academics section - plan implementation migration
   Implements plan/academics README + 01-06.

   Safe to re-run: every object uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
   Existing academic history is preserved. New columns default to values that
   keep current data readable; destructive deletes remain restricted in the API.
   ============================================================ */

BEGIN;

/* ---------- academic years: close + single active year ---------- */

ALTER TABLE school_academic_years
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

/* Heal any pre-existing data that had more than one active year, keeping the
   most recent start date (then highest id). */
UPDATE school_academic_years y
   SET is_active = false, updated_at = now()
 WHERE y.is_active
   AND EXISTS (
     SELECT 1 FROM school_academic_years newer
      WHERE newer.app_id = y.app_id
        AND newer.is_active
        AND (newer.start_date > y.start_date
             OR (newer.start_date = y.start_date AND newer.id > y.id))
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_academic_years_active
  ON school_academic_years (app_id) WHERE is_active;

/* ---------- classes / sections / subjects: archive flags ---------- */

ALTER TABLE school_classes
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE school_sections
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS class_teacher_id integer;

ALTER TABLE school_subjects
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF to_regclass('public.school_hr_employees') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conname = 'school_sections_class_teacher_id_fkey'
     ) THEN
    ALTER TABLE school_sections
      ADD CONSTRAINT school_sections_class_teacher_id_fkey
      FOREIGN KEY (class_teacher_id)
      REFERENCES school_hr_employees(id) ON DELETE SET NULL;
  END IF;
END $$;

/* Class teacher identity can also be a system user (tblHO_User.UserId), so it
   is stored in the existing text column for compatibility. The API validates
   whichever identifier is supplied against active staff/users. */
ALTER TABLE school_hr_employees
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_school_hr_employees_user
  ON school_hr_employees (app_id, user_id);

/* Older seed runs created duplicate subject codes. Keep every subject row
   (so historic references survive) and make the newer duplicates unique by
   suffixing their own id instead of deleting or clearing catalog data. */
UPDATE school_subjects s
   SET code = s.code || '-' || s.id
 WHERE s.id IN (
   SELECT id FROM (
     SELECT id,
            row_number() OVER (PARTITION BY app_id, lower(code) ORDER BY id DESC) AS rn
       FROM school_subjects
      WHERE code IS NOT NULL AND btrim(code) <> ''
   ) ranked
   WHERE ranked.rn > 1
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_subjects_code
  ON school_subjects (app_id, lower(code))
  WHERE code IS NOT NULL AND btrim(code) <> '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_sections_capacity_positive') THEN
    ALTER TABLE school_sections
      ADD CONSTRAINT school_sections_capacity_positive CHECK (capacity > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_subjects_max_marks_positive') THEN
    ALTER TABLE school_subjects
      ADD CONSTRAINT school_subjects_max_marks_positive CHECK (max_marks > 0) NOT VALID;
  END IF;
END $$;

/* ---------- subject allocation: year + class + section + subject + teacher ---------- */

CREATE TABLE IF NOT EXISTS school_subject_allocations (
  id                serial PRIMARY KEY,
  app_id            text NOT NULL DEFAULT 'default',
  academic_year_id  integer NOT NULL REFERENCES school_academic_years(id) ON DELETE RESTRICT,
  class_id          integer NOT NULL REFERENCES school_classes(id) ON DELETE RESTRICT,
  section_id        integer NOT NULL REFERENCES school_sections(id) ON DELETE RESTRICT,
  subject_id        integer NOT NULL REFERENCES school_subjects(id) ON DELETE RESTRICT,
  teacher_id        text NOT NULL,
  teacher_name      text,
  effective_from    date NOT NULL DEFAULT current_date,
  effective_to      date,
  is_active         boolean NOT NULL DEFAULT true,
  created_by        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_subject_allocations_active
  ON school_subject_allocations
  (app_id, academic_year_id, class_id, section_id, subject_id, teacher_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_school_subject_allocations_lookup
  ON school_subject_allocations
  (app_id, academic_year_id, class_id, section_id, is_active);

/* ---------- rooms: canonical academic room master ---------- */

CREATE TABLE IF NOT EXISTS school_rooms (
  id          serial PRIMARY KEY,
  app_id      text NOT NULL DEFAULT 'default',
  campus_id   integer REFERENCES school_campuses(id) ON DELETE RESTRICT,
  building    text,
  code        text NOT NULL,
  name        text NOT NULL,
  room_type   text NOT NULL DEFAULT 'classroom',
  capacity    integer NOT NULL DEFAULT 40,
  facilities  jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (capacity > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_rooms_campus_code
  ON school_rooms (app_id, coalesce(campus_id, 0), lower(code));

CREATE INDEX IF NOT EXISTS idx_school_rooms_campus
  ON school_rooms (app_id, campus_id, is_active);

/* ---------- timetable + exam timetable: room/allocation references ---------- */

CREATE TABLE IF NOT EXISTS school_timetables (
  id            serial PRIMARY KEY,
  app_id        text NOT NULL DEFAULT 'default',
  class_id      integer NOT NULL,
  section_id    integer,
  subject_id    integer,
  teacher_id    text,
  allocation_id integer REFERENCES school_subject_allocations(id) ON DELETE RESTRICT,
  room_id       integer REFERENCES school_rooms(id) ON DELETE RESTRICT,
  room_no       text,
  day_of_week   integer,
  period_no     integer,
  start_time    time,
  end_time      time,
  academic_year_id integer REFERENCES school_academic_years(id) ON DELETE RESTRICT,
  is_published  boolean NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE school_timetables
  ADD COLUMN IF NOT EXISTS allocation_id integer REFERENCES school_subject_allocations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS room_id integer REFERENCES school_rooms(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS academic_year_id integer REFERENCES school_academic_years(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE school_exam_timetable
  ADD COLUMN IF NOT EXISTS room_id integer REFERENCES school_rooms(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS allocation_id integer REFERENCES school_subject_allocations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE school_substitutions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

/* Granular permissions introduced with the plan. Existing databases seeded
   the old catalogue before these keys existed, so add them idempotently and
   grant the role defaults here as well as in foundation.js. */
INSERT INTO school_permissions (key, module, description) VALUES
  ('homework.create',  'homework',  'Create and edit homework drafts'),
  ('homework.publish', 'homework',  'Publish homework to students'),
  ('homework.close',   'homework',  'Close published homework'),
  ('homework.archive', 'homework',  'Archive homework'),
  ('homework.grade',   'homework',  'Grade student submissions'),
  ('homework.submit',  'homework',  'Submit homework as a student'),
  ('timetable.teacher','timetable', 'View own teacher timetable')
ON CONFLICT (key) DO NOTHING;

INSERT INTO school_role_permissions (role_id, permission_key, scope)
SELECT r.id, grants.permission_key, 'campus'
  FROM school_roles r
  JOIN (VALUES
    ('TEACHER',       'homework.create'),
    ('TEACHER',       'homework.publish'),
    ('TEACHER',       'homework.close'),
    ('TEACHER',       'homework.archive'),
    ('TEACHER',       'homework.grade'),
    ('TEACHER',       'timetable.teacher'),
    ('CLASS_TEACHER', 'homework.create'),
    ('CLASS_TEACHER', 'homework.publish'),
    ('CLASS_TEACHER', 'homework.close'),
    ('CLASS_TEACHER', 'homework.archive'),
    ('CLASS_TEACHER', 'homework.grade'),
    ('CLASS_TEACHER', 'timetable.teacher'),
    ('ADMIN_OFFICER', 'homework.create'),
    ('ADMIN_OFFICER', 'homework.publish'),
    ('ADMIN_OFFICER', 'homework.close'),
    ('ADMIN_OFFICER', 'homework.archive'),
    ('ADMIN_OFFICER', 'homework.grade'),
    ('PRINCIPAL',     'homework.create'),
    ('PRINCIPAL',     'homework.publish'),
    ('PRINCIPAL',     'homework.close'),
    ('PRINCIPAL',     'homework.archive'),
    ('PRINCIPAL',     'homework.grade'),
    ('STUDENT',       'homework.submit')
  ) AS grants(role_code, permission_key) ON grants.role_code = r.code
ON CONFLICT (role_id, permission_key) DO NOTHING;

/* Teachers author, publish, close and grade homework in their own allocations;
   full homework.manage (delete/front-office submit) is an office permission. */
DELETE FROM school_role_permissions rp
 USING school_roles r
 WHERE r.id = rp.role_id
   AND r.code IN ('TEACHER', 'CLASS_TEACHER')
   AND rp.permission_key = 'homework.manage';

CREATE INDEX IF NOT EXISTS idx_school_timetables_published
  ON school_timetables (app_id, academic_year_id, is_published);

CREATE INDEX IF NOT EXISTS idx_school_timetables_room_slot
  ON school_timetables (app_id, room_id, day_of_week, period_no);

CREATE INDEX IF NOT EXISTS idx_school_exam_timetable_room_date
  ON school_exam_timetable (app_id, room_id, exam_date);

CREATE INDEX IF NOT EXISTS idx_school_exam_timetable_published
  ON school_exam_timetable (app_id, is_published);

/* ---------- homework: lifecycle + allocation + publish state ---------- */

ALTER TABLE school_homework
  ADD COLUMN IF NOT EXISTS allocation_id integer REFERENCES school_subject_allocations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS academic_year_id integer REFERENCES school_academic_years(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS assigned_date date,
  ADD COLUMN IF NOT EXISTS max_marks numeric(6,2),
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

/* Existing homework was created before lifecycle states existed: keep it
   readable as published rather than hiding it as a draft. */
UPDATE school_homework SET status = 'published' WHERE status IS NULL;
ALTER TABLE school_homework ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE school_homework ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_homework_status_valid') THEN
    ALTER TABLE school_homework
      ADD CONSTRAINT school_homework_status_valid
      CHECK (status IN ('draft','published','closed','archived')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_homework_max_marks_positive') THEN
    ALTER TABLE school_homework
      ADD CONSTRAINT school_homework_max_marks_positive CHECK (max_marks IS NULL OR max_marks > 0) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_school_homework_scope
  ON school_homework (app_id, academic_year_id, class_id, section_id, status);

ALTER TABLE school_homework_submissions
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE school_homework_submissions
   SET status = CASE WHEN marks IS NOT NULL THEN 'graded' ELSE 'submitted' END
 WHERE status IS NULL;
ALTER TABLE school_homework_submissions ALTER COLUMN status SET DEFAULT 'submitted';
ALTER TABLE school_homework_submissions ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_homework_submission_status_valid') THEN
    ALTER TABLE school_homework_submissions
      ADD CONSTRAINT school_homework_submission_status_valid
      CHECK (status IN ('submitted','late','graded','returned')) NOT VALID;
  END IF;
END $$;

/* Keep one submission per student/work. Old duplicates are collapsed to the
   newest row before the uniqueness rule is installed. */
DELETE FROM school_homework_submissions older
 USING school_homework_submissions newer
 WHERE older.app_id = newer.app_id
   AND older.homework_id = newer.homework_id
   AND older.student_id = newer.student_id
   AND older.id < newer.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_school_homework_submission_student
  ON school_homework_submissions (app_id, homework_id, student_id)
  WHERE homework_id IS NOT NULL AND student_id IS NOT NULL;

ALTER TABLE school_homework_submissions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMIT;
