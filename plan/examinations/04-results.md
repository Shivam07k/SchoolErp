# Step 4 — Results

**Deliverable:** Processing, checks panel, result sheets, ranks, publish with versions, re-evaluation, promotion.  
**Exit:** A published result is reproducible from raw marks.

## Database

### Migration
- `sql/44_results.sql`

### Tables

```sql
-- Result Version (immutable snapshot)
CREATE TABLE school_result_version (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  exam_id INT REFERENCES school_exam(id), -- or term_id for term results
  term_id INT REFERENCES school_term(id),
  class_band TEXT NOT NULL,
  version_no INT NOT NULL,
  rule_version_id INT REFERENCES school_result_rule(id), -- rule version used
  status TEXT DEFAULT 'draft', -- draft, processed, published, frozen
  checks_passed BOOLEAN DEFAULT false,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  published_by TEXT,
  published_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_result_version ON school_result_version(app_id, exam_id, term_id, class_band, version_no);

-- Student Result (one per student per version)
CREATE TABLE school_student_result (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  version_id INT REFERENCES school_result_version(id) ON DELETE CASCADE,
  student_id INT REFERENCES school_students(id),
  total_marks NUMERIC(8,2),
  max_total_marks INT,
  percentage NUMERIC(5,2),
  grade TEXT,
  grade_points NUMERIC(3,1),
  rank INT,
  outcome TEXT, -- 'pass', 'fail', 'compartment', 'withheld', 'incomplete', 'promoted', 'detained'
  promotion_decision TEXT, -- 'promoted', 'detained', 'conditional'
  grace_total NUMERIC(6,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_student_result ON school_student_result(version_id, student_id);
CREATE INDEX idx_student_result_outcome ON school_student_result(outcome);

-- Subject Result (one per subject per student)
CREATE TABLE school_subject_result (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_result_id INT REFERENCES school_student_result(id) ON DELETE CASCADE,
  paper_id INT REFERENCES school_exam_paper(id),
  subject_id INT REFERENCES school_subjects(id),
  marks_obtained NUMERIC(6,2),
  max_marks INT,
  percentage NUMERIC(5,2),
  grade TEXT,
  grade_points NUMERIC(3,1),
  outcome TEXT, -- 'pass', 'fail', 'compartment', 'withheld', 'incomplete'
  grace_marks NUMERIC(6,2) DEFAULT 0,
  is_additional BOOLEAN DEFAULT false,
  counts_in_total BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_subject_result ON school_subject_result(student_result_id, paper_id);

-- Grace Marks (audited)
CREATE TABLE school_grace_mark (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  subject_result_id INT REFERENCES school_subject_result(id) ON DELETE CASCADE,
  marks NUMERIC(6,2) NOT NULL,
  rule_applied TEXT, -- reference to grace_rule key
  reason TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Re-evaluation Request
CREATE TABLE school_revaluation_request (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_id INT REFERENCES school_students(id),
  paper_id INT REFERENCES school_exam_paper(id),
  version_id INT REFERENCES school_result_version(id),
  old_marks NUMERIC(6,2),
  new_marks NUMERIC(6,2),
  old_status_code TEXT,
  new_status_code TEXT,
  reason TEXT NOT NULL,
  fee_paid BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, processed
  requested_by TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  decision_reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reval_student ON school_revaluation_request(student_id);

-- Promotion Decision (links to next year enrollment)
CREATE TABLE school_promotion_decision (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  student_id INT REFERENCES school_students(id),
  from_academic_year_id INT REFERENCES school_academic_years(id),
  to_academic_year_id INT REFERENCES school_academic_years(id),
  from_class_id INT REFERENCES school_classes(id),
  to_class_id INT REFERENCES school_classes(id),
  to_section_id INT REFERENCES school_sections(id),
  decision TEXT, -- 'promoted', 'detained', 'conditional'
  based_on_version_id INT REFERENCES school_result_version(id),
  decided_by TEXT,
  decided_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_promotion ON school_promotion_decision(app_id, student_id, from_academic_year_id);
```

## Calculation Engine (pure function, testable)

```javascript
// Input: version_id, rule, scale, marks entries
// Output: populates school_student_result, school_subject_result, school_grace_mark

async function processResults(versionId) {
  const version = await getResultVersion(versionId);
  const rule = await getResultRule(version.rule_version_id);
  const scale = await getGradeScaleForBand(version.class_band, version.exam_id);
  
  // 1. Get all locked marks sheets for this exam/term/class_band
  const sheets = await getLockedSheets(version.exam_id, version.class_band);
  
  // 2. For each student, collect marks per paper/component
  const studentMarks = await aggregateMarks(sheets);
  
  // 3. For each student:
  for (const student of studentMarks) {
    // a. Sum components → paper totals (check component pass minimums)
    // b. Apply best-of rule (if unit tests)
    // c. Apply weightage_scheme → subject totals
    // d. Check pass/fail per subject (pass_rule)
    // e. Apply grace (if eligible per grace_rule) → record in school_grace_mark
    // f. Determine overall outcome (pass/fail/compartment/withheld/incomplete)
    // g. Map percentage → grade_band → grade, grade_points
    // h. Calculate rank (per rank_rule: scope section/class/school, tie handling)
  }
  
  // 4. Bulk insert results in single transaction
  // 5. Mark version status = 'processed', checks_passed = true
}
```

## Checks Panel (before publish)
| Check | Severity | Action |
|-------|----------|--------|
| Unlocked sheets exist | Error | Block publish |
| Missing marks for enrolled students | Error | List students |
| Component pass minimum failed | Warning | List students |
| Grace eligibility edge cases | Warning | List students |
| Rank ties unresolved | Warning | List tied students |
| Promotion decisions missing | Warning | List students |

## Result Publishing (transactional)
```sql
BEGIN;
  -- 1. Verify all checks passed
  -- 2. UPDATE school_result_version SET status='published', published_by=..., published_at=now()
  -- 3. INSERT INTO school_notification_outbox (event_type='result.published', ...)
  -- 4. Generate report cards (async queue)
COMMIT;
```
- **Draft**: internal review only
- **Processed**: calculations done, checks panel visible
- **Published**: frozen, parents/students notified, report cards unlock
- **Frozen**: absolute lock; only new version allowed

## Re-evaluation Workflow
1. Parent/student requests → `school_revaluation_request` (status=pending)
2. Coordinator assigns different teacher
3. Teacher re-marks → enters new marks
4. Coordinator reviews → approve/reject
5. If approved: correction on original entry → re-process → new result version
6. Parent notified of outcome

## Promotion
- After annual result published
- Run promotion rule: pass → promoted, compartment → conditional, fail → detained
- Creates `school_promotion_decision` + next year enrollment
- Class teacher reviews conditional cases

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/exam/result-versions` | List versions (filter: exam, term, class) |
| POST | `/school/exam/result-versions` | Create draft version |
| POST | `/school/exam/result-versions/:id/process` | Run calculation engine |
| GET | `/school/exam/result-versions/:id/checks` | Checks panel |
| POST | `/school/exam/result-versions/:id/publish` | Publish (transactional) |
| GET | `/school/exam/result-versions/:id/students` | Result sheet (paginated) |
| GET | `/school/exam/result-versions/:id/ranks` | Rank list |
| GET | `/school/exam/result-versions/:id/analysis` | Subject-wise analysis |
| POST | `/school/exam/revaluation` | Request re-evaluation |
| PUT | `/school/exam/revaluation/:id` | Decide re-evaluation |
| POST | `/school/exam/promotion` | Run promotion |
| GET | `/school/exam/promotion/list` | Promotion list |

## Frontend

| Route | Component |
|-------|-----------|
| `/school/examinations/results` | `ResultsDashboard.jsx` |
| `/school/examinations/results/version/:id` | `ResultVersion.jsx` |
| `/school/examinations/results/sheet/:id` | `ResultSheet.jsx` |
| `/school/examinations/results/ranks` | `Ranks.jsx` |
| `/school/examinations/results/analysis` | `Analysis.jsx` |
| `/school/examinations/results/revaluation` | `Revaluation.jsx` |
| `/school/examinations/results/promotion` | `Promotion.jsx` |

## Acceptance
- Process Annual 2026 for Senior band: 500 students, 6 subjects → completes in < 5s
- Checks panel shows: 0 unlocked sheets, 3 missing marks, 2 grace eligible
- Publish: transactional, notifications queued, report cards generated async
- Published result: totals/grades/ranks match manual calculation
- Re-evaluation: request → approve → new version created, old version preserved
- Promotion: 450 promoted, 30 conditional, 20 detained → enrollment created
- Version history: v1 (draft), v2 (processed), v3 (published) all queryable