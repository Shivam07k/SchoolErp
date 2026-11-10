# Timetable — Remaining Work

This is the current audit register for the Timetable roadmap. It records
implementation gaps and verification still needed; it does not mark the module
complete.

## Verified progress (Phase 1 Foundation + Phase 2 Master complete)

- All four Timetable screens dispatched in `src/components/SchoolPage.jsx`.
- **Migration 29** adds `school_periods`, `school_timetable_versions`,
  `version_id` + `period_id` on `school_timetables`, unique constraints per
  version+period, baseline version backfill, period backfill, and **exclusion
  constraint preventing overlapping published versions**.
- `server/src/routes/school_more.js` enforces allocation + room requirement,
  derives teacher/class/section/year from allocation, rejects forged filters,
  enforces exact section for section allocations, enforces draft/published
  visibility, and uses advisory lock (`pg_advisory_xact_lock`) for atomic
  conflict check + insert.
- Substitution DELETE cancels (`status='cancelled'`) to preserve history;
  timetable delete is blocked while `assigned` substitutions exist.
- Teacher/student views fail closed when no linked record exists; caller-supplied
  filters (including `academicYearId`) are ignored for non-managers.
- **Phase 2 Master screen** uses version selector with create/publish/archive
  actions, sends `versionId` + `periodId`, filters entries by version, shows
  version status/effective dates, auto-fills start/end times from period.
- Teacher/Student views use backend-resolved effective version (send `date`
  param, optional `versionId` override), week navigation reloads with date.
- Teacher/class conflict checks use **time-range overlap** (not just period ID).
- Concurrent version publishes serialized with **advisory lock**.
- Teacher/class conflict checks use **time-range overlap** (not just period ID).
- Concurrent version publishes serialized with **advisory lock**.
- Frontend production build, backend syntax checks, `npm run setup:school -- --all`
  on all 3 companies, migration 29 applied, both workflow test suites pass
  (timetable 27 checks, academics 45 checks).

## Remaining issues

### TT-REM-01 — Legacy `room_no` backfill for existing databases

Migration 28 adds `room_id` to `school_timetables` and `school_exam_timetable`
but does not map legacy `room_no` values. For databases with existing timetable
rows that have `room_no` but no `room_id`, a backfill migration or mapping
report is needed.

**Required:** provide a migration script that maps `room_no` to `room_id` by
matching room code/name on the same campus, and test on representative legacy
data.

### TT-REM-02 — Substitution notification and calendar integration

Substitutions are created and visible to affected parties, but there is no
automatic notification (email/push/in-app) or calendar event generation for the
absent teacher, substitute, or affected students/parents.

**Required:** integrate with the notification/automation module and test
delivery to all affected roles.

### TT-REM-03 — Teacher/Student timetable calendar export

The teacher and student timetable views return JSON; there is no calendar
export (ICS/CSV) or print-friendly view.

**Required:** add export endpoints and test with real-world calendar
applications.

### TT-REM-04 — Timetable versioning and rollback

Published timetables have version history with effective dates, but there is
no rollback mechanism. A scheduler cannot easily revert a published schedule
to a previous state.

**Required:** implement controlled rollback workflow; test that rollback
preserves substitution history.

### TT-REM-05 — Execute linkage QA

The workflow test suite covers core HTTP workflows, but it does not exercise
attendance/report consumers with real attendance marks and report output, nor
does it cover browser navigation or print/export behavior.

**Required:** run linked attendance/report scenarios in an isolated tenant and
record browser QA separately from API test evidence.

## Release decision

**Phase 1 (Foundation) & Phase 2 (Master) complete.** Phase 3 (Views) screens
wired to effective-version resolver. Do not mark Timetable complete until
legacy room backfill, notification integration, calendar export, versioning/
rollback, browser QA, and attendance/report linkage are closed or explicitly
accepted as documented policy. See the [phased plan](README.md) for the
intended order.