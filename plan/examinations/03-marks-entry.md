# Step 3 — Marks Entry

**Deliverable:** Sheets, entry grid, import, status codes, submit, verify, lock, completion dashboard, corrections.  
**Exit:** No marks change after lock without an audit entry.

## Database

### Migration
- `sql/43_marks_entry.sql`

### Tables

```sql
-- Marks Sheet (one per paper + section)
CREATE TABLE school_marks_sheet (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  exam_id INT REFERENCES school_exam(id),
  paper_id INT REFERENCES school_exam_paper(id),
  section_id INT REFERENCES school_sections(id),
  state TEXT DEFAULT 'not_started', -- not_started, draft, submitted, verified, locked, reopened
  deadline TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  reopened_by TEXT,
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,
  row_version INT DEFAULT 1, -- optimistic locking
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_marks_sheet ON school_marks_sheet(app_id, paper_id, section_id);
CREATE INDEX idx_marks_sheet_exam ON school_marks_sheet(exam_id, state);

-- Mark Entry (one per student per component)
CREATE TABLE school_mark_entry (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  sheet_id INT REFERENCES school_marks_sheet(id) ON DELETE CASCADE,
  student_id INT REFERENCES school_students(id),
  component_id INT REFERENCES school_paper_component(id),
  marks NUMERIC(6,2), -- NULL = not entered; 0 = zero marks
  status_code TEXT, -- 'AB' absent, 'EX' exempt, 'ML' medical, 'UFM' malpractice, 'WH' withheld
  entered_by TEXT,
  entered_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  row_version INT DEFAULT 1
);
CREATE UNIQUE INDEX uq_mark_entry ON school_mark_entry(sheet_id, student_id, component_id);
CREATE INDEX idx_mark_entry_student ON school_mark_entry(student_id);

-- Mark Correction (audited changes after lock)
CREATE TABLE school_mark_correction (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  entry_id INT REFERENCES school_mark_entry(id),
  sheet_id INT REFERENCES school_marks_sheet(id),
  student_id INT REFERENCES school_students(id),
  old_marks NUMERIC(6,2),
  new_marks NUMERIC(6,2),
  old_status_code TEXT,
  new_status_code TEXT,
  reason TEXT NOT NULL,
  requested_by TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  decision TEXT, -- 'approved', 'rejected'
  decision_reason TEXT,
  processed_at TIMESTAMPTZ,
  override BOOLEAN DEFAULT false, -- admin override of separation of duties
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_mark_correction_sheet ON school_mark_correction(sheet_id);

-- Moderation (separate audited step)
CREATE TABLE school_moderation (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  paper_id INT REFERENCES school_exam_paper(id),
  section_id INT REFERENCES school_sections(id),
  method TEXT, -- "scale", "add", "cap"
  parameters JSONB, -- {"factor": 1.05} or {"add": 3} or {"cap": 95}
  reason TEXT,
  applied_by TEXT,
  applied_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Status Codes (fixed catalogue)
| Code | Label | Meaning | Counts as attempted |
|------|-------|---------|---------------------|
| (empty) | — | Marks entered | Yes |
| AB | Absent | Student absent | No |
| EX | Exempt | Exempted (e.g., transfer) | No |
| ML | Medical | Medical leave | No* |
| UFM | Malpractice | Unfair means | Yes (0 marks) |
| WH | Withheld | Result withheld | No |

*Medical: policy decides if counted as attempted

## Sheet Lifecycle
```
not_started → draft (auto-save) → submitted → verified → locked
                    ↑                    ↓
                    └──────── reopened ←─┘ (with reason)
```
- **Draft**: teacher editing; auto-save every 30s or on blur
- **Submitted**: teacher done; verifier (HOD/class teacher) reviews
- **Verified**: verifier accepted; can still reopen before deadline
- **Locked**: deadline passed or coordinator locked; no edits without correction
- **Reopened**: coordinator reopens with reason; goes back to draft

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/exam/marks-sheets` | List sheets (filter: exam, section, state) |
| POST | `/school/exam/marks-sheets/ensure` | Create sheets for exam (one per paper×section) |
| GET | `/school/exam/marks-sheets/:id` | Sheet detail with entries grid |
| POST | `/school/exam/marks-sheets/:id/entries` | Bulk upsert entries (draft auto-save) |
| POST | `/school/exam/marks-sheets/:id/submit` | Submit sheet (teacher) |
| POST | `/school/exam/marks-sheets/:id/verify` | Verify sheet (HOD/class teacher) |
| POST | `/school/exam/marks-sheets/:id/lock` | Lock sheet (coordinator) |
| POST | `/school/exam/marks-sheets/:id/reopen` | Reopen with reason (coordinator) |
| POST | `/school/exam/marks-sheets/:id/import` | CSV/Excel import by admission_no |
| POST | `/school/exam/marks-sheets/preview-import` | Preview import: validate, return row errors |
| GET | `/school/exam/marks-sheets/dashboard` | Completion dashboard per exam/section |
| GET | `/school/exam/marks-sheets/:id/corrections` | List corrections |
| POST | `/school/exam/marks-sheets/corrections` | Request correction |
| PUT | `/school/exam/marks-sheets/corrections/:id` | Approve/reject correction |
| POST | `/school/exam/marks-sheets/:id/moderate` | Apply moderation |

## Frontend

| Route | Component |
|-------|-----------|
| `/school/examinations/marks` | `MarksDashboard.jsx` |
| `/school/examinations/marks/sheet/:id` | `MarksSheet.jsx` |
| `/school/examinations/marks/import` | `MarksImport.jsx` |

### MarksSheet.jsx — Grid Features
- Rows: students (enrolled in section for that subject)
- Columns: components + total (calculated live)
- Status code dropdown beside marks
- Navigation: Tab → next cell, Enter → next row
- Paste from Excel (Ctrl+V) → parses to grid
- Color coding: AB=red, ML=orange, EX=blue, UFM=dark red
- Totals column updates as you type
- Validation inline: >max=red border, negative=red, decimals per config
- Footer: entered/pending/total counts
- Auto-save draft (debounced 1s) → POST `/entries`
- Submit/Verify/Lock buttons per permission

### CSV Import Format
```
admission_no,component_1_marks,component_1_status,component_2_marks,component_2_status,...
ADM001,85,,28,,
ADM002,,AB,,ML,
```
- Preview shows: valid rows, errors (unknown admission, >max, invalid status, wrong student for section)
- Only saves if zero errors

## Validation Rules (Hard)
- Marks ≤ component max_marks
- Marks ≥ 0
- Decimals allowed per component config (default 0)
- Status code must be from catalogue
- Student must be enrolled in section for that subject (check student_subject or paper class)
- Cannot edit if sheet state ∈ {verified, locked} unless correction
- Row version check on save (optimistic locking)

## Soft Warnings
- Many zeros or AB in a sheet → "Unusual pattern"
- Average far from class norm → "Check entries"
- Entry after deadline → "Late entry"

## Correction Workflow
1. Teacher/coordinator requests correction on locked sheet
2. Enters old/new values, reason
3. If separation_of_duties (setting): requester ≠ approver unless admin override
4. Approver reviews → approve/reject with reason
5. If approved: entry updated, correction logged, affected results re-processed (new version if published)

## Acceptance
- Teacher enters marks for 40 students × 3 components in < 2 min
- Paste 40 rows from Excel works
- Invalid rows caught in preview, nothing saved
- Submit → verifier sees totals, anomalies highlighted
- Lock → no edits possible; correction requires reason+approval
- Correction on published result → new result version created
- Dashboard shows: exam=Annual, section=1-A: 5/5 sheets locked, 0 pending