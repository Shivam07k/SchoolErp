# Step 5 — Report Cards

**Deliverable:** Templates, remarks, co-scholastic grades, bulk PDF, parent portal.  
**Exit:** A section's report cards generated in one step.

## Database

### Migration
- `sql/45_report_cards.sql`

### Tables

```sql
-- Remarks (class teacher / subject teacher)
CREATE TABLE school_remark (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_id INT REFERENCES school_students(id),
  version_id INT REFERENCES school_result_version(id),
  remark_type TEXT, -- 'class_teacher', 'principal', 'subject_teacher'
  author_id INT, -- teacher/user id
  text TEXT,
  comment_bank_id INT, -- reference to comment bank
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_remark_student_version ON school_remark(student_id, version_id);

-- Comment Bank (reusable remarks)
CREATE TABLE school_comment_bank (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  category TEXT, -- 'academic', 'behavior', 'attendance', 'general'
  text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Co-Scholastic Grades (art, PE, discipline, work education, etc.)
CREATE TABLE school_co_scholastic_grade (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_id INT REFERENCES school_students(id),
  version_id INT REFERENCES school_result_version(id),
  area_id INT REFERENCES school_co_scholastic_area(id),
  grade TEXT, -- 'A', 'B', 'C' or custom
  grade_points NUMERIC(3,1),
  teacher_id INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_coscholastic ON school_co_scholastic_grade(student_id, version_id, area_id);

-- Co-Scholastic Areas
CREATE TABLE school_co_scholastic_area (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  name TEXT NOT NULL, -- "Art Education", "Physical Education", "Discipline", "Work Education"
  grading_type TEXT DEFAULT 'grade', -- 'grade', 'descriptive'
  class_bands TEXT[], -- which bands this applies to
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Report Card (generated artifact)
CREATE TABLE school_report_card (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_id INT REFERENCES school_students(id),
  version_id INT REFERENCES school_result_version(id),
  template_id INT REFERENCES school_report_template(id),
  file_path TEXT, -- path to generated PDF
  copy_no INT DEFAULT 1, -- original=1, duplicate=2...
  generated_by TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  published_by TEXT,
  status TEXT DEFAULT 'generated', -- generated, published, withheld
  withheld_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_report_card_student ON school_report_card(student_id, version_id);
CREATE INDEX idx_report_card_version ON school_report_card(version_id);
```

## Template System

### Template Definition (JSON)
```json
{
  "header": {
    "school_name": true,
    "logo": true,
    "exam_name": true,
    "term": true,
    "academic_year": true
  },
  "student_info": {
    "admission_no": true,
    "roll_no": true,
    "name": true,
    "class": true,
    "section": true,
    "dob": true,
    "photo": true
  },
  "attendance": {
    "show": true,
    "source": "attendance_module",
    "fields": ["total_days", "present_days", "percentage"]
  },
  "subjects": {
    "layout": "table",
    "columns": ["subject", "max", "theory", "practical", "internal", "total", "grade", "grade_points"],
    "group_by": "paper",
    "show_failed_only": false
  },
  "totals": {
    "grand_total": true,
    "percentage": true,
    "grade": true,
    "grade_points": true,
    "rank": true,
    "outcome": true
  },
  "grace_marks": { "show": true, "separate_column": true },
  "co_scholastic": { "show": true, "areas": ["Art", "PE", "Discipline"] },
  "remarks": { 
    "class_teacher": true, 
    "principal": true,
    "subject_teachers": false 
  },
  "signatures": {
    "class_teacher": true,
    "principal": true,
    "parent": true
  },
  "footer": {
    "instructions": true,
    "promotion_policy": true,
    "revaluation_info": true
  }
}
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/exam/report-cards/templates` | List templates |
| POST | `/school/exam/report-cards/templates` | Create template |
| PUT | `/school/exam/report-cards/templates/:id` | Update template |
| GET | `/school/exam/report-cards/remarks` | List remarks (filter: student, version) |
| POST | `/school/exam/report-cards/remarks` | Save remark |
| GET | `/school/exam/report-cards/comment-bank` | List comment bank |
| POST | `/school/exam/report-cards/comment-bank` | Add comment |
| GET | `/school/exam/report-cards/co-scholastic` | List co-scholastic areas |
| POST | `/school/exam/report-cards/co-scholastic` | Save co-scholastic grade |
| POST | `/school/exam/report-cards/generate` | Generate bulk PDF for version+section |
| GET | `/school/exam/report-cards/status/:jobId` | Check generation status |
| GET | `/school/exam/report-cards/download/:id` | Download single PDF |
| POST | `/school/exam/report-cards/publish` | Publish to parent portal |
| POST | `/school/exam/report-cards/withhold` | Withhold (fees/attendance) |
| GET | `/school/exam/report-cards/preview/:studentId/:versionId` | HTML preview |

## PDF Generation (async queue)

```javascript
// POST /generate body: { version_id, section_id, template_id, copy_no }
// Response: { job_id }
// Worker:
// 1. Fetch students in section
// 2. For each student:
//    - Build data: student, results, attendance, remarks, co-scholastic
//    - Render HTML via template (handlebars/nunjucks)
//    - Convert to PDF (puppeteer/chromium)
//    - Save to storage (local/S3)
//    - Record in school_report_card
// 3. Update job status: completed/failed
// 4. Notify when all done
```

## Frontend

| Route | Component |
|-------|-----------|
| `/school/examinations/report-cards` | `ReportCardsDashboard.jsx` |
| `/school/examinations/report-cards/templates` | `ReportTemplates.jsx` |
| `/school/examinations/report-cards/remarks` | `RemarksEntry.jsx` |
| `/school/examinations/report-cards/co-scholastic` | `CoScholasticEntry.jsx` |
| `/school/examinations/report-cards/generate` | `ReportCardGenerator.jsx` |
| `/school/examinations/report-cards/preview/:id` | `ReportCardPreview.jsx` |

### ReportCardGenerator.jsx Flow
1. Select: Result Version → Section → Template
2. Preview: shows first 3 students as HTML
3. Options: copy_no, withhold if fees due, withhold if attendance < min
4. Click **Generate** → starts async job, shows progress bar
5. When done: **Download ZIP** (all PDFs) or **Publish to Portal**
6. Duplicate copy: re-run with `copy_no=2` → adds "DUPLICATE" watermark

### RemarksEntry.jsx
- Grid: students × remark types (class teacher, principal)
- Comment bank picker (searchable)
- Auto-save draft
- Validation: "X remarks missing" before generate

### CoScholasticEntry.jsx
- Grid: students × areas (Art, PE, Discipline, Work Ed)
- Grade picker per area (A/B/C or custom)
- Teacher attribution

## Withhold Policy (configurable)
| Condition | Action |
|-----------|--------|
| Fee dues > 0 | Withhold, reason: "Fee dues pending" |
| Attendance < 75% | Withhold, reason: "Below minimum attendance" |
| Both | Withhold, combined reason |

## Parent Portal View
- Published report cards visible at `/parent/report-cards/:versionId/:studentId`
- Download button (if not withheld)
- Shows: results, attendance, remarks, co-scholastic, signatures

## Acceptance
- Template designer: drag sections, toggle fields, save as JSON
- Generate Class 1-A (40 students) → 40 PDFs in < 30s
- PDF matches template: header, subjects table, totals, attendance, remarks, signatures
- Duplicate copy has "DUPLICATE" watermark and copy_no=2
- Withheld cards: not downloadable from portal, shows reason
- Remarks: comment bank search works, auto-save works
- Co-scholastic: grades saved per area per student
- Bulk ZIP download works for 500+ students