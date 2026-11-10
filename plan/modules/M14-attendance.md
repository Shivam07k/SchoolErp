# M14 — Attendance

**Package ID:** M14.

**Priority:** Core. **Starting status:** partial/verify.

**Detailed plan:** [Attendance module roadmap](../attendance/README.md), including submodule plans, current audit gaps, policy decisions, workflow diagrams, and research references.

## Submodules

Student daily attendance first, optional timetable-linked period attendance, staff attendance, bulk marking, leave, corrections/approvals, registers, summaries/reports, and queued notifications.

## How it must work

Maintain one authoritative record per applicable student/class/period/date. Corrections are audited; counts and notifications reflect saved data only. Staff and student attendance remain separate.

## Dependencies and links

M07 student/enrollment + M13 timetable → attendance. Attendance → M04 dashboard, M08 portal, M09 interventions, M10/M12 safety/discipline/exit, M18 payroll, M30 reporting.

## Existing files and API baseline

- Frontend: `src/components/SchoolPage.jsx`, `src/forms/frmSchoolAttendance/`, `src/components/StudentProfile.jsx`.
- Backend: `server/src/routes/school.js`; the reviewed attendance endpoints are `/attendance`, `/attendance/summary`, plus dashboard/profile consumers.
- Schema: `sql/19_school_core.sql` currently defines a daily student-only table.
- Shared: `src/api.js`, `server/src/school/foundation.js`, student enrollment and timetable modules.

The existing implementation is partial: the current register has no lifecycle/correction/staff/period model, and the two mark-attendance surfaces use different request payloads. See `plan/attendance/REMAINING.md` before implementation.

## QA plan

- Duplicate date/period, bulk save, correction approval, and absent/late/excused states.
- Test wrong-section and cross-tenant student IDs.
- Reconcile status totals and dashboard/report counts to saved rows.
- Verify notification dedupe and that unsaved UI edits do not change totals.
- Confirm staff attendance never appears in student register.

**Acceptance:** attendance records, summaries, corrections, notifications, and dependent workflows agree.
