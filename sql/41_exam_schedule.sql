-- ============================================================
-- M15 Examinations — Step 6: Exam Schedule
-- ============================================================
-- Creates: school_exam_slot, school_exam_hall, school_seat_allocation, school_invigilation, school_hall_ticket
-- ============================================================

BEGIN;

-- Exam Slots (date sheet)
CREATE TABLE IF NOT EXISTS school_exam_slot (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  exam_id           INT REFERENCES school_exam(id) ON DELETE CASCADE,
  paper_id          INT REFERENCES school_exam_paper(id) ON DELETE CASCADE,
  section_id        INT REFERENCES school_sections(id) ON DELETE SET NULL,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_paper_section_date
  ON school_exam_slot (app_id, paper_id, section_id, date, start_time)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_slot_exam_date ON school_exam_slot(exam_id, date);
CREATE INDEX IF NOT EXISTS idx_slot_section_date ON school_exam_slot(section_id, date);

-- Exam Halls
CREATE TABLE IF NOT EXISTS school_exam_hall (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  room_id           INT REFERENCES school_rooms(id) ON DELETE SET NULL,
  name              TEXT, -- override room name
  capacity          INT NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hall_room ON school_exam_hall(room_id);

-- Seat Allocation
CREATE TABLE IF NOT EXISTS school_seat_allocation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  slot_id           INT REFERENCES school_exam_slot(id) ON DELETE CASCADE,
  hall_id           INT REFERENCES school_exam_hall(id) ON DELETE CASCADE,
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  seat_no           TEXT, -- "A1", "B3", etc.
  row_no            INT,
  col_no            INT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_slot_student
  ON school_seat_allocation (slot_id, student_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_slot_hall_seat
  ON school_seat_allocation (slot_id, hall_id, seat_no)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_seat_student ON school_seat_allocation(student_id);

-- Invigilation Duties
CREATE TABLE IF NOT EXISTS school_invigilation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  slot_id           INT REFERENCES school_exam_slot(id) ON DELETE CASCADE,
  hall_id           INT REFERENCES school_exam_hall(id) ON DELETE CASCADE,
  teacher_id        INT REFERENCES school_hr_employees(id) ON DELETE SET NULL,
  user_id           TEXT, -- alternative: user id from auth
  role              TEXT DEFAULT 'invigilator' CHECK (role IN ('invigilator', 'relieving', 'chief')),
  assigned_by       TEXT,
  assigned_at       TIMESTAMPTZ DEFAULT now(),
  status            TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'cancelled')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invigilation_slot_teacher
  ON school_invigilation (slot_id, teacher_id)
  WHERE deleted_at IS NULL AND teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invigilation_teacher ON school_invigilation(teacher_id);
CREATE INDEX IF NOT EXISTS idx_invigilation_slot ON school_invigilation(slot_id);

-- Hall Tickets
CREATE TABLE IF NOT EXISTS school_hall_ticket (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  exam_id           INT REFERENCES school_exam(id) ON DELETE CASCADE,
  slot_id           INT REFERENCES school_exam_slot(id) ON DELETE CASCADE,
  hall_id           INT REFERENCES school_exam_hall(id) ON DELETE SET NULL,
  seat_no           TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'blocked', 'downloaded')),
  blocked_reason    TEXT, -- 'attendance', 'fees', 'discipline'
  issued_at         TIMESTAMPTZ,
  downloaded_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hall_ticket
  ON school_hall_ticket (student_id, exam_id, slot_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hall_ticket_exam ON school_hall_ticket(exam_id, status);
CREATE INDEX IF NOT EXISTS idx_hall_ticket_student ON school_hall_ticket(student_id);

-- Calendar Event Type extension (uses existing school_calendar_event)
-- event_type = 'exam' links to exam_id, paper_id, slot_id via description JSON

COMMENT ON TABLE school_exam_slot IS 'Date sheet: paper × section × date × time';
COMMENT ON TABLE school_exam_hall IS 'Exam halls linked to rooms with capacity';
COMMENT ON TABLE school_seat_allocation IS 'Student seat assignment per slot/hall';
COMMENT ON TABLE school_invigilation IS 'Teacher invigilation duties per slot/hall';
COMMENT ON TABLE school_hall_ticket IS 'Student hall ticket with eligibility status';

COMMIT;