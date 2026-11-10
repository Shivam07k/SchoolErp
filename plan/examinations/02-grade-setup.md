# Step 2 — Grade Setup

**Deliverable:** Scales, pass, weightage, grace, rounding, rank rules, preview, versioning.  
**Exit:** Sample marks give expected grades.

## Database

### Migration
- `sql/42_grade_setup.sql`

### Tables

```sql
-- Grade Scale (versioned per academic year)
CREATE TABLE school_grade_scale (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  academic_year_id INT REFERENCES school_academic_years(id),
  name TEXT NOT NULL, -- "CBSE 2026", "ICSE 2026", "Custom Primary"
  description TEXT,
  version INT DEFAULT 1,
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_grade_scale_year_name ON school_grade_scale(app_id, academic_year_id, name);

-- Grade Bands (per class band: Primary, Middle, Senior)
CREATE TABLE school_grade_band (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  scale_id INT REFERENCES school_grade_scale(id) ON DELETE CASCADE,
  class_band TEXT NOT NULL, -- "primary", "middle", "senior", "custom"
  min_percent NUMERIC(5,2) NOT NULL,
  max_percent NUMERIC(5,2) NOT NULL,
  grade TEXT NOT NULL, -- "A1", "A", "B1", "B", "C", "D", "E"
  grade_points NUMERIC(3,1), -- for CGPA
  remark TEXT,
  sort_order INT DEFAULT 0
);
CREATE INDEX idx_grade_band_scale ON school_grade_band(scale_id);
-- Constraint: no gaps/overlaps per scale + class_band (checked in API)

-- Result Rules (versioned)
CREATE TABLE school_result_rule (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  academic_year_id INT REFERENCES school_academic_years(id),
  class_band TEXT NOT NULL, -- "primary", "middle", "senior", "custom"
  version INT DEFAULT 1,
  effective_from DATE DEFAULT CURRENT_DATE,
  
  -- Weightage scheme (exam type → %)
  weightage_scheme JSONB NOT NULL DEFAULT '{}', 
  -- {"unit_test": 10, "half_yearly": 40, "annual": 50}
  
  -- Best-of rule
  best_of_rule JSONB, -- {"enabled": true, "n": 2, "of": 3, "exam_types": ["unit_test"]}
  
  -- Pass rule
  pass_rule JSONB NOT NULL DEFAULT '{}',
  -- {"per_subject": 33, "aggregate": 33, "both_required": true}
  
  -- Grace marks
  grace_rule JSONB,
  -- {"enabled": true, "max_per_subject": 5, "max_total": 15, "only_if_close": true}
  
  -- Compartment
  compartment_rule JSONB,
  -- {"max_failed_subjects": 2, "allowed": true}
  
  -- Rounding
  rounding_rule TEXT DEFAULT 'nearest', -- "none", "nearest", "up"
  
  -- Rank
  rank_rule JSONB,
  -- {"enabled": true, "tie": "same_rank", "scope": "section"} -- section, class, school
  
  -- Optional/additional subject
  optional_subject_rule JSONB,
  -- {"count_in_total": false, "grade_only": true}
  
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_result_rule_year_band ON school_result_rule(app_id, academic_year_id, class_band, version);

-- Report Templates (per class band)
CREATE TABLE school_report_template (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  academic_year_id INT REFERENCES school_academic_years(id),
  class_band TEXT NOT NULL,
  name TEXT NOT NULL,
  layout JSONB NOT NULL, -- template definition
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Backend API (school_exam.js or school_grade.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/exam/grade-scales` | List scales for year |
| POST | `/school/exam/grade-scales` | Create scale |
| GET | `/school/exam/grade-scales/:id/bands` | List bands for scale |
| POST | `/school/exam/grade-scales/:id/bands` | Create band |
| PUT | `/school/exam/grade-bands/:id` | Update band |
| DELETE | `/school/exam/grade-bands/:id` | Delete band |
| GET | `/school/exam/result-rules` | List rules for year |
| POST | `/school/exam/result-rules` | Create rule |
| PUT | `/school/exam/result-rules/:id` | Update rule (new version) |
| POST | `/school/exam/result-rules/preview` | Preview: input marks → output grade/total/rank |
| GET | `/school/exam/report-templates` | List templates |
| POST | `/school/exam/report-templates` | Create template |
| PUT | `/school/exam/report-templates/:id` | Update template |

## Frontend

| Route | Component |
|-------|-----------|
| `/school/examinations/grade-setup` | `GradeSetup.jsx` |
| `/school/examinations/grade-setup/scales` | `GradeScales.jsx` |
| `/school/examinations/grade-setup/rules` | `ResultRules.jsx` |
| `/school/examinations/grade-setup/templates` | `ReportTemplates.jsx` |

## Preview Engine

```javascript
// Input: raw marks per paper/component, status codes
// Output: totals, percentages, grades, grade_points, rank, outcome
function previewGradeCalculation(marks, rule, scale, classBand) {
  // 1. Sum components → paper total
  // 2. Check component pass minimums
  // 3. Apply exam-level best-of rule
  // 4. Combine exams via weightage_scheme
  // 5. Apply grace (if enabled and eligible)
  // 6. Determine pass/fail/compartment per pass_rule
  // 7. Map percentage → grade_band → grade, grade_points
  // 8. Calculate rank per rank_rule (tie handling)
  // 9. Return { total, percentage, grade, grade_points, rank, outcome, grace_applied }
}
```

## Validation Rules (Hard)
- Grade bands: no gaps, no overlaps per scale + class_band
- Weightage scheme sums to 100% (soft warn if not)
- Best-of N ≤ number of exams of that type
- Grace max per subject ≤ subject max; max total ≤ sum of subject maxes
- Pass marks ≤ max marks per paper/component

## Acceptance
- Create CBSE scale: Primary (A*/A/B/C/D), Middle (A1/A2/B1/B2/C1/C2/D/E), Senior (A1..E)
- Configure weightage: UT 10%, HY 40%, Annual 50%
- Best-of-2 unit tests out of 3
- Grace: max 5 per subject, 15 total, only if within 5 marks of pass
- Preview: student with marks [UT: 80,75,70], HY: 65, Annual: 72 → correct total, grade, rank
- Versioning: changing rule creates new version; old results keep their rule version