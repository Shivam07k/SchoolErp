# Examination Module Plan

**Package:** M15 — Examinations  
**Priority:** Core  
**Status:** Planning → Execution  

This folder turns the examination design document into an implementation roadmap grounded in the current ERP.

## Plan documents

- [Setup: Years, Terms, Exams, Papers, Components](01-setup.md)
- [Grade Setup: Scales, Pass Rules, Weightage, Grace, Rounding, Rank](02-grade-setup.md)
- [Marks Entry: Sheets, Grid, Import, Status Codes, Lifecycle](03-marks-entry.md)
- [Results: Processing, Checks, Versions, Re-evaluation, Promotion](04-results.md)
- [Report Cards: Templates, Remarks, Bulk PDF, Parent Portal](05-report-cards.md)
- [Exam Schedule: Date Sheet, Halls, Seating, Invigilation, Hall Tickets](06-exam-schedule.md)
- [Reports, Roles, Notifications, Hardening](07-reports-hardening.md)
- [Current gaps and decisions](REMAINING.md)

## Goals and boundaries

- Configure exams, papers, components and grade rules once; reuse for any board pattern.
- Store only raw marks + status codes; totals, grades, ranks always calculated.
- Every marks/results change audited with who, when, why, old/new values.
- Marks lifecycle: Draft → Submitted → Verified → Locked; corrections require approval.
- Results versioned: processed → published → frozen; corrections create new versions.
- Report cards generated from published snapshot + attendance + remarks in bulk.
- Integrate with Timetable (exam days, halls, invigilation) and Attendance (eligibility, report card attendance).
- First release: no online exams, question banks, OMR, board-specific export files.

## Core tables (from design §6)

| Area | Tables |
|------|--------|
| Exam setup | `school_exam`, `school_exam_paper`, `school_paper_component`, `school_student_subject` |
| Grade Setup | `school_grade_scale`, `school_grade_band`, `school_result_rule`, `school_report_template` |
| Schedule | `school_exam_slot`, `school_exam_hall`, `school_seat_allocation`, `school_invigilation`, `school_hall_ticket` |
| Marks | `school_marks_sheet`, `school_mark_entry`, `school_mark_correction`, `school_moderation` |
| Results | `school_result_version`, `school_student_result`, `school_subject_result`, `school_grace_mark`, `school_revaluation_request` |
| Report Cards | `school_report_card`, `school_remark`, `school_co_scholastic_grade` |

## Build order (from design §12)

| Step | Deliverable | Exit criteria |
|------|-------------|---------------|
| 1 | Setup: Years, terms, exams, papers, components, student-subject mapping, simple dates, Excel import | Whole exam configurable from Excel |
| 2 | Grade Setup: Scales, pass, weightage, grace, rounding, rank rules, preview, versioning | Sample marks give expected grades |
| 3 | Marks Entry: Sheets, entry grid, import, status codes, submit, verify, lock, dashboard, corrections | No marks change after lock without audit |
| 4 | Results: Processing, checks panel, result sheets, ranks, publish with versions, re-evaluation, promotion | Published result reproducible from raw marks |
| 5 | Report Cards: Templates, remarks, co-scholastic, bulk PDF, parent portal | Section report cards in one step |
| 6 | Exam Schedule: Drag-drop date sheet, clash checks, halls, seating, invigilation, hall tickets, Timetable link | Clash-free date sheet in minutes |
| 7 | Reports and hardening: Analysis, notifications, roles, soft delete, transactional publish, archiving | Audit trail and reports complete |
| 8 | Later (optional): Online exams, question bank, OMR, board files, CGPA/semester, mobile entry | Added when needed |

## Dependencies and links

- M07 students/enrollment → student-subject mapping
- M13 timetable → exam days, halls, invigilation substitution
- M14 attendance → eligibility, report card attendance
- M18 HR/payroll → invigilation duties, teacher load
- M26 communication → notifications
- M30 reports/dashboard → result analytics

## QA plan

- Validation: marks > max, negative, decimals, unenrolled students rejected
- Lifecycle: draft edit, submit, verify, lock, reopen, correction, versioned results
- Authorization: teacher own section, HOD department, coordinator, principal, parent read-only
- Reconciliation: raw marks → totals → grades → rank match calculation engine
- Integration: exam day cancels periods, hall blocks rooms, invigilation creates unavailability, eligibility blocks hall tickets, attendance on report card
- Performance: 2400 students × 8 papers × 2 components = ~40k marks per exam; whole-school processing in seconds

## Acceptance criteria

- Results are correct and reproducible; no manual calculation anywhere.
- Teachers enter marks quickly with inline validation.
- Rules configured once, not hard-coded; any board pattern supported.
- Every change recorded with who, when, why, old value, new value.
- Report cards for a section generated in one step.
- All common scenarios covered without complexity.