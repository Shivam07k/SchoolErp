# M15 — Examinations

**Package ID:** M15.

**Priority:** Core. **Starting status:** planning.

**Detailed plan:** [Examination module roadmap](../examinations/README.md), including submodule plans, current audit gaps, policy decisions, workflow diagrams, and research references.

## Submodules

Exam Setup, Grade Setup, Marks Entry, Results, Report Cards, Exam Schedule, Reports & Hardening.

## How it must work

Configure exams, papers, components and grade rules once; reuse for any board pattern. Store only raw marks + status codes; totals, grades, ranks always calculated. Every marks/results change audited with who, when, why, old/new values. Marks lifecycle: Draft → Submitted → Verified → Locked; corrections require approval. Results versioned: processed → published → frozen; corrections create new versions. Report cards generated from published snapshot + attendance + remarks in bulk. Integrate with Timetable (exam days, halls, invigilation) and Attendance (eligibility, report card attendance).

## Dependencies and links

M07 students/enrollment → student-subject mapping  
M13 timetable → exam days, halls, invigilation substitution  
M14 attendance → eligibility, report card attendance  
M18 HR/payroll → invigilation duties, teacher load  
M26 communication → notifications  
M30 reports/dashboard → result analytics

## Existing files and API baseline

- Frontend: (none yet — to be created in `src/pages/school/examinations/`)
- Backend: (none yet — to be created in `server/src/routes/school_exam.js`)
- Schema: (none yet — migrations `sql/40-45_exam_*.sql`)
- Shared: `src/api.js`, `server/src/school/foundation.js`, student enrollment, timetable, attendance modules

## QA plan

- Validation: marks > max, negative, decimals, unenrolled students rejected
- Lifecycle: draft edit, submit, verify, lock, reopen, correction, versioned results
- Authorization: teacher own section, HOD department, coordinator, principal, parent read-only
- Reconciliation: raw marks → totals → grades → rank match calculation engine
- Integration: exam day cancels periods, hall blocks rooms, invigilation creates unavailability, eligibility blocks hall tickets, attendance on report card
- Performance: 2400 students × 8 papers × 2 components = ~40k marks per exam; whole-school processing in seconds

## Acceptance

Results are correct and reproducible; no manual calculation anywhere. Teachers enter marks quickly with inline validation. Rules configured once, not hard-coded; any board pattern supported. Every change recorded with who, when, why, old value, new value. Report cards for a section generated in one step. All common scenarios covered without complexity.