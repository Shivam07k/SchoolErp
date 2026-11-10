# Step 1 — Exam Setup

**Deliverable:** Years, terms, exams, papers, components, student-subject mapping, simple paper dates, Excel import.  
**Exit:** A whole exam can be configured from Excel.

## Database

### Migrations
- `sql/40_exam_setup.sql` — core tables
- `sql/41_exam_schedule.sql` — slots, halls, seating, invigilation, hall tickets (step 6, but schema here)

### Tables

```sql
-- Academic years already exist (school_academic_years)
-- Terms
CREATE TABLE school_term (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  academic_year_id INT REFERENCES school_academic_years(id),
  name TEXT NOT NULL, -- "Term 1", "Half Yearly", "Annual"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weightage NUMERIC(5,2), -- % of year
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_term_year_name ON school_term(app_id, academic_year_id, name);

-- Exams
CREATE TABLE school_exam (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  term_id INT REFERENCES school_term(id),
  name TEXT NOT NULL, -- "Unit Test 1", "Half Yearly", "Annual"
  type TEXT NOT NULL, -- "unit_test", "half_yearly", "annual", "pre_board"
  weightage NUMERIC(5,2) DEFAULT 0, -- % within term/year
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'draft', -- draft, scheduled, marks_entry_open, marks_locked, processed, published, frozen
  best_of_n INT, -- for unit tests: best N of M
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_exam_term ON school_exam(app_id, term_id);

-- Exam Papers (one per class-subject combination)
CREATE TABLE school_exam_paper (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  exam_id INT REFERENCES school_exam(id) ON DELETE CASCADE,
  class_id INT REFERENCES school_classes(id),
  subject_id INT REFERENCES school_subjects(id),
  max_marks INT NOT NULL,
  pass_marks INT NOT NULL,
  grades_only BOOLEAN DEFAULT false, -- art, discipline, etc.
  counts_in_total BOOLEAN DEFAULT true,
  optional_subject BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_exam_paper ON school_exam_paper(app_id, exam_id, class_id, subject_id);

-- Paper Components (theory, practical, internal, oral)
CREATE TABLE school_paper_component (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  paper_id INT REFERENCES school_exam_paper(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Theory", "Practical", "Internal", "Oral"
  max_marks INT NOT NULL,
  pass_minimum INT, -- minimum to pass this component
  is_mandatory BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_component ON school_paper_component(app_id, paper_id, name);

-- Student Subject Mapping (optional/additional subjects, language choice)
CREATE TABLE school_student_subject (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_id INT REFERENCES school_students(id),
  subject_id INT REFERENCES school_subjects(id),
  academic_year_id INT REFERENCES school_academic_years(id),
  is_optional BOOLEAN DEFAULT false,
  is_additional BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_student_subject ON school_student_subject(app_id, student_id, subject_id, academic_year_id);
```

## Backend API (server/src/routes/school_exam.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/exam/terms` | List terms for academic year |
| POST | `/school/exam/terms` | Create term |
| PUT | `/school/exam/terms/:id` | Update term |
| GET | `/school/exam/exams` | List exams (filter: term, status) |
| POST | `/school/exam/exams` | Create exam |
| PUT | `/school/exam/exams/:id` | Update exam (incl. status transitions) |
| GET | `/school/exam/exams/:id` | Exam detail with papers/components |
| GET | `/school/exam/papers` | List papers (filter: exam, class) |
| POST | `/school/exam/papers` | Create paper |
| PUT | `/school/exam/papers/:id` | Update paper |
| GET | `/school/exam/papers/:id/components` | List components |
| POST | `/school/exam/papers/:id/components` | Create component |
| PUT | `/school/exam/papers/:id/components/:cid` | Update component |
| GET | `/school/exam/student-subjects` | List mappings (filter: student, class, year) |
| POST | `/school/exam/student-subjects` | Bulk upsert student subjects |
| POST | `/school/exam/import` | Excel import: exam + papers + components |

## Frontend (src/pages/school/examinations/)

### Shared
- `shared.jsx` — shell, helpers, status tones, canManage, downloadCsv

### Pages
| Route | Component | Purpose |
|-------|-----------|---------|
| `/school/examinations` | `ExamList.jsx` | List exams, create new, status badges, actions |
| `/school/examinations/setup` | `ExamSetup.jsx` | Multi-step: exam → papers → components grid |
| `/school/examinations/terms` | `Terms.jsx` | CRUD terms per academic year |
| `/school/examinations/student-subjects` | `StudentSubjects.jsx` | Matrix: students × optional subjects |

## Status Tones
| Exam status | Tone |
|-------------|------|
| draft | secondary |
| scheduled | info |
| marks_entry_open | primary |
| marks_locked | warning |
| processed | info |
| published | success |
| frozen | dark |

## Excel Import Format
Sheet 1 (Exam): `exam_name, type, term_name, weightage, start_date, end_date, best_of_n`
Sheet 2 (Papers): `exam_name, class_name, subject_name, max_marks, pass_marks, grades_only, counts_in_total, optional_subject`
Sheet 3 (Components): `exam_name, class_name, subject_name, component_name, max_marks, pass_minimum, is_mandatory`

## Acceptance
- Create exam → add papers for Class 1-12 → add components (Theory/Practical/Internal) → all saved
- Excel import creates full hierarchy in one transaction
- Student subject mapping: Class 11 student takes Hindi + Math + Physics + Chem + English + Optional CS
- Terms weightages sum to 100% per year (soft validation)