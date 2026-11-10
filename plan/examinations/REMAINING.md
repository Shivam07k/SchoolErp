# Examinations — Current Gaps and Decisions

This is the initial audit register for M15. "Found" means visible in the files/routes inspected; verify deployment-specific migrations and route wiring before changing production data.

## Priority gaps

| Priority | Gap | Required action |
|--------|-----|-----------------|
| P0 | No exam tables exist in current schema | Create migrations 40-45 for all tables |
| P0 | No exam routes exist in backend | Create `server/src/routes/school_exam.js` |
| P0 | No frontend examination pages exist | Create `src/pages/school/examinations/` components |
| P0 | Menu has "Examinations" group but no working routes | Wire routes in `SchoolPage.jsx` |
| P1 | Grade setup must be configurable per board/year | Versioned GradeScale + ResultRule |
| P1 | Marks entry must validate against paper components | Server-side validation on every save |
| P1 | Results must be versioned and reproducible | Single calculation engine, rule_version stored |
| P1 | Corrections need separation of duties | Reuse attendance settings pattern |
| P1 | Report cards need template system | JSON template + PDF generation queue |
| P2 | Exam schedule needs Timetable integration | Calendar events + room/teacher unavailability |
| P2 | Hall tickets need Attendance/Fees eligibility | Cross-module checks before issue |
| P2 | Re-evaluation workflow | Separate request → approve → new result version |

## Decisions required before implementation

1. **Grading system**: Marks+grades for senior, grades-only for primary? CGPA needed?
2. **Exam pattern**: How many exams/terms? Weightage? Best-of-N for unit tests?
3. **Pass/grace/compartment rules**: Confirm against board requirements
4. **Optional subjects**: StudentSubject mapping required for every student?
5. **Report card formats**: Per class band? Bilingual? Board-specific layouts?
6. **Blocking policy**: Hall tickets/report cards blocked for fees/attendance?
7. **Re-evaluation**: Exists? Carries fee?
8. **Hall tickets/seating in first release?** Or only date sheet?

## Open questions from design §13

1. Optional subjects and electives — same question as Timetable module
2. Grading system: marks+grades (senior), grades-only (lower), grade points/CGPA?
3. Exam pattern: number of exams/terms, weightage, best-of-N
4. Pass, grace, compartment, promotion rules — confirm with board
5. Report card formats per class band/board, bilingual?
6. Blocking: hall tickets/report cards for fee dues or low attendance?
7. Re-evaluation: exists? Fee?
8. Hall tickets and seating in first release or only date sheet?

## Implementation Order (from §12)

| Step | Deliverable | Est. Effort |
|------|-------------|-------------|
| 1 | Setup: Years, terms, exams, papers, components, student-subject, dates, Excel import | 3 days |
| 2 | Grade Setup: Scales, pass, weightage, grace, rounding, rank, preview, versioning | 2 days |
| 3 | Marks Entry: Sheets, grid, import, status codes, submit, verify, lock, dashboard, corrections | 4 days |
| 4 | Results: Processing, checks, sheets, ranks, publish+versions, re-eval, promotion | 3 days |
| 5 | Report Cards: Templates, remarks, co-scholastic, bulk PDF, parent portal | 3 days |
| 6 | Exam Schedule: Drag-drop date sheet, clash checks, halls, seating, invigilation, hall tickets, Timetable link | 3 days |
| 7 | Reports & Hardening: Analysis, notifications, roles, soft delete, transactional publish, archiving | 2 days |
| **Total** | **Core module** | **~20 days** |

## Migration Order

```bash
sql/40_exam_setup.sql          # Terms, Exams, Papers, Components, StudentSubject
sql/41_exam_schedule.sql       # Slots, Halls, Seating, Invigilation, HallTickets
sql/42_grade_setup.sql         # GradeScale, GradeBand, ResultRule, ReportTemplate
sql/43_marks_entry.sql         # MarksSheet, MarkEntry, MarkCorrection, Moderation
sql/44_results.sql             # ResultVersion, StudentResult, SubjectResult, GraceMark, Revaluation, Promotion
sql/45_report_cards.sql        # Remark, CommentBank, CoScholasticArea/Grade, ReportCard
```

## Route Structure (to add to SchoolPage.jsx)

```javascript
if (module === 'examinations') {
  if (!sub || sub === 'dashboard') return <ExamDashboard ... />;
  if (sub === 'setup') return <ExamSetup ... />;
  if (sub === 'terms') return <Terms ... />;
  if (sub === 'grade-setup') return <GradeSetup ... />;
  if (sub === 'marks') return <MarksDashboard ... />;
  if (sub === 'results') return <ResultsDashboard ... />;
  if (sub === 'report-cards') return <ReportCardsDashboard ... />;
  if (sub === 'schedule') return <ExamSchedule ... />;
  // ... detail routes
}
```

## Menu (already in menu.js)
```javascript
{
  group: 'Core',
  key: 'examinations', label: 'Examinations', icon: 'bi-journal-check',
  perm: 'exams.view', built: false,
  children: [
    { key: 'dashboard', label: 'Dashboard', path: '/school/examinations', built: false },
    { key: 'setup', label: 'Exam Setup', path: '/school/examinations/setup', built: false },
    { key: 'terms', label: 'Terms', path: '/school/examinations/terms', built: false },
    { key: 'grade-setup', label: 'Grade Setup', path: '/school/examinations/grade-setup', built: false },
    { key: 'marks', label: 'Marks Entry', path: '/school/examinations/marks', built: false },
    { key: 'results', label: 'Results', path: '/school/examinations/results', built: false },
    { key: 'report-cards', label: 'Report Cards', path: '/school/examinations/report-cards', built: false },
    { key: 'schedule', label: 'Exam Schedule', path: '/school/examinations/schedule', built: false },
    { key: 'reports', label: 'Reports', path: '/school/examinations/reports', built: false },
  ]
}
```

## Verification Checklist (per step)

### Step 1 - Setup
- [ ] Exam + papers + components created from UI
- [ ] Excel import creates full hierarchy
- [ ] Student subject mapping works for optional/additional
- [ ] Terms weightages sum to 100%

### Step 2 - Grade Setup
- [ ] Grade scale with bands for Primary/Middle/Senior
- [ ] No gaps/overlaps validation works
- [ ] Result rule: weightage, best-of, pass, grace, rounding, rank
- [ ] Preview engine matches manual calculation

### Step 3 - Marks Entry
- [ ] Grid: 40 students × 3 components, Tab/Enter nav
- [ ] Paste from Excel works
- [ ] Status codes (AB/EX/ML/UFM/WH) beside marks
- [ ] Auto-save draft, Submit → Verify → Lock
- [ ] Correction on locked sheet requires approval
- [ ] Dashboard shows completion per exam/section

### Step 4 - Results
- [ ] Process 500 students in < 5s
- [ ] Checks panel shows missing/unlocked/edge cases
- [ ] Publish: transactional, notifications queued
- [ ] Re-evaluation: request → approve → new version
- [ ] Promotion: creates next year enrollment

### Step 5 - Report Cards
- [ ] Template designer: drag sections, save JSON
- [ ] Generate 40 PDFs in < 30s
- [ ] PDF matches template exactly
- [ ] Duplicate copy has watermark
- [ ] Withhold for fees/attendance works

### Step 6 - Schedule
- [ ] Drag-drop date sheet, real-time clash badges
- [ ] Auto-fill respects gaps
- [ ] Halls assigned, capacities checked
- [ ] Seating: mixed classes, exportable
- [ ] Invigilation: auto-assign, no double-book, no own-subject
- [ ] Hall tickets generated, blocked by eligibility

### Step 7 - Hardening
- [ ] All 16 reports work (PDF/CSV/HTML)
- [ ] Notifications queued and delivered
- [ ] Roles tested: each permission allow/deny
- [ ] Soft delete works
- [ ] Audit trail complete
- [ ] Load test passes