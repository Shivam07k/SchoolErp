# Step 6 — Exam Schedule

**Deliverable:** Drag-and-drop date sheet, clash checks, halls, seating, invigilation, hall tickets, Timetable link.  
**Exit:** A clash-free date sheet in minutes.

## Database

### Migration
- `sql/41_exam_schedule.sql` (created in step 1)

### Tables

```sql
-- Exam Slots (date sheet)
CREATE TABLE school_exam_slot (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  exam_id INT REFERENCES school_exam(id),
  paper_id INT REFERENCES school_exam_paper(id),
  section_id INT REFERENCES school_sections(id), -- NULL = all sections of paper's class
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, published, cancelled
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_slot_paper_section_date ON school_exam_slot(app_id, paper_id, section_id, date, start_time);
CREATE INDEX idx_slot_exam_date ON school_exam_slot(exam_id, date);

-- Exam Halls
CREATE TABLE school_exam_hall (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  room_id INT REFERENCES school_rooms(id), -- link to Rooms module
  capacity INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seat Allocation
CREATE TABLE school_seat_allocation (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  slot_id INT REFERENCES school_exam_slot(id) ON DELETE CASCADE,
  hall_id INT REFERENCES school_exam_hall(id),
  student_id INT REFERENCES school_students(id),
  seat_no TEXT, -- "A1", "B3", etc.
  row_no INT,
  col_no INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_seat_slot_student ON school_seat_allocation(slot_id, student_id);
CREATE UNIQUE INDEX uq_seat_slot_hall_seat ON school_seat_allocation(slot_id, hall_id, seat_no);

-- Invigilation Duties
CREATE TABLE school_invigilation (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  slot_id INT REFERENCES school_exam_slot(id) ON DELETE CASCADE,
  hall_id INT REFERENCES school_exam_hall(id),
  teacher_id INT REFERENCES school_hr_employees(id), -- or user id
  role TEXT DEFAULT 'invigilator', -- 'invigilator', 'relieving', 'chief'
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'assigned', -- assigned, confirmed, cancelled
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_invigilation_slot_teacher ON school_invigilation(slot_id, teacher_id);

-- Hall Tickets
CREATE TABLE school_hall_ticket (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_id INT REFERENCES school_students(id),
  exam_id INT REFERENCES school_exam(id),
  slot_id INT REFERENCES school_exam_slot(id),
  hall_id INT REFERENCES school_exam_hall(id),
  seat_no TEXT,
  status TEXT DEFAULT 'pending', -- pending, issued, blocked, downloaded
  blocked_reason TEXT, -- 'attendance', 'fees', 'discipline'
  issued_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_hall_ticket ON school_hall_ticket(student_id, exam_id, slot_id);
CREATE INDEX idx_hall_ticket_exam ON school_hall_ticket(exam_id, status);

-- Calendar Event Type (for Timetable integration)
-- Uses existing school_calendar_event with event_type='exam'
-- Links to exam_id, paper_id, slot_id
```

## Clash Detection Rules (Hard)
1. **Section clash**: Same section, same date, overlapping time
2. **Hall clash**: Same hall, same date, overlapping time
3. **Teacher clash**: Same teacher invigilating two halls same time
4. **Student clash**: Student in two papers same time (via section/subject)
5. **Capacity**: Hall capacity < students assigned
6. **Teacher own subject**: Invigilator teaching that subject (soft warn)

## Auto-Fill Algorithm
```
Input: exam_id, papers, sections, start_date, end_date, papers_per_day, min_gap_hours
Output: slots for each paper×section

Algorithm:
1. Sort papers by priority (core subjects first)
2. For each paper:
   a. Get eligible dates (within exam start/end, not holiday/closure from calendar)
   b. For each section of paper:
      i. Find first date with < papers_per_day slots for that section
      ii. Check min_gap_hours from last slot for that section
      iii. Assign earliest available time slot
3. If cannot place: return conflicts for manual resolution
```

## Timetable Integration

### Exam Days → Calendar
- Each slot creates `school_calendar_event` with `event_type='exam'`
- `applies_to_all=false`, `section_ids=[section_id]`
- Timetable: periods cancelled for those sections on those dates

### Halls → Room Unavailability
- Each slot + hall → Room unavailability for that date/time
- Normal classes in that room cancelled

### Invigilation → Teacher Unavailability
- Each invigilation duty → Teacher unavailability for that date/time
- Substitution module: suggests replacements for affected regular classes
- If invigilator absent: substitution ranking replaces them

## Hall Ticket Eligibility
- Generated for all enrolled students in exam sections
- Status=blocked if:
  - Attendance < minimum (from Attendance module eligibility)
  - Fee dues > 0 (from Fees module)
  - Discipline flag (from Students module)
- Downloadable only if status=issued and not blocked

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/exam/schedule/slots` | List slots (filter: exam, date, section) |
| POST | `/school/exam/schedule/slots` | Create slot |
| PUT | `/school/exam/schedule/slots/:id` | Update slot |
| DELETE | `/school/exam/schedule/slots/:id` | Delete slot |
| POST | `/school/exam/schedule/auto-fill` | Auto-fill date sheet |
| GET | `/school/exam/schedule/clashes` | Detect all clashes |
| POST | `/school/exam/schedule/publish` | Publish date sheet (creates calendar events) |
| GET | `/school/exam/schedule/halls` | List halls |
| POST | `/school/exam/schedule/halls` | Create hall |
| POST | `/school/exam/schedule/seating/auto` | Auto-assign seats (by roll or mixed) |
| GET | `/school/exam/schedule/seating/:slotId` | Seating plan for slot |
| POST | `/school/exam/schedule/invigilation/auto` | Auto-assign invigilators |
| GET | `/school/exam/schedule/invigilation/:slotId` | Invigilation chart |
| POST | `/school/exam/schedule/hall-tickets/generate` | Generate hall tickets |
| GET | `/school/exam/schedule/hall-tickets/:examId` | List hall tickets |
| GET | `/school/exam/schedule/hall-tickets/download/:studentId/:examId` | Download PDF |

## Frontend

| Route | Component |
|-------|-----------|
| `/school/examinations/schedule` | `ExamSchedule.jsx` |
| `/school/examinations/schedule/date-sheet` | `DateSheet.jsx` |
| `/school/examinations/schedule/halls` | `Halls.jsx` |
| `/school/examinations/schedule/seating` | `Seating.jsx` |
| `/school/examinations/schedule/invigilation` | `Invigilation.jsx` |
| `/school/examinations/schedule/hall-tickets` | `HallTickets.jsx` |

### DateSheet.jsx — Drag & Drop Grid
- **Rows**: sections (grouped by class)
- **Columns**: dates (within exam start/end)
- **Cells**: papers (color-coded by subject)
- Drag paper from palette → drop on cell
- **Real-time clash badges**: red (hard), yellow (soft)
- Right-click: edit time, assign hall, delete
- **Auto-fill** button: runs algorithm, shows preview, confirm
- **Publish** button: creates calendar events, notifies

### Seating.jsx
- View: hall grid (rows × cols) with student names/seat nos
- Modes: by roll (sequential), mixed classes (shuffle)
- Manual override: drag student to different seat
- Export: seating chart PDF per hall

### Invigilation.jsx
- Table: slots × halls → assigned teachers
- Auto-assign: free teachers, fewest duties, not own subject
- Conflict: teacher already assigned, teacher teaching subject
- Manual override: reassign
- Export: duty chart PDF

### HallTickets.jsx
- List: student, exam, slot, hall, seat, status
- Filter: blocked (attendance/fees)
- Bulk: generate, issue, download ZIP
- Single: download PDF (admit card format)

## Acceptance
- Date sheet: drag 20 papers across 10 dates for 12 sections → no clashes
- Auto-fill: places all papers respecting papers_per_day=2, gap=3h
- Publish: creates calendar events, cancels timetable periods
- Halls: 5 halls assigned, capacities respected
- Seating: 40 students/hall, mixed classes, exportable chart
- Invigilation: 30 duties assigned, no teacher double-booked, no own-subject
- Hall tickets: 480 generated, 5 blocked (attendance), 475 downloadable
- Substitution: invigilator absent → replacement suggested in Substitution module