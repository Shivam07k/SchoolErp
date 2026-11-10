# Academics — Remaining Work

This is the current audit register for the six Academics plans. It records
implementation gaps and verification still needed; it does not mark a module
complete.

## Verified progress

- The six Academics screens are dispatched in `src/components/SchoolPage.jsx`.
- `sql/28_academics_plan.sql` is listed in `server/_schoolsetup.mjs` and applies
  to all three configured companies.
- The configured `school_erp`, `xerp`, and `ash1` databases contain the new
  subject-allocation, room, homework, and submission tables with correct columns
  and permissions.
- Granular homework permissions (`homework.create`, `publish`, `close`,
  `archive`, `grade`, `submit`) are seeded and granted to TEACHER,
  CLASS_TEACHER, ADMIN_OFFICER; `homework.manage` is reserved for office/admin.
  Teacher roles no longer have `homework.manage`.
- The frontend production build, backend syntax checks, `npm run setup:school
  -- --all`, and both workflow test suites pass on fresh DB (migrations 19–28).
- `server/_schoolsetup.mjs` restores the `setup:school` entry point and
  reconciles the permission catalogue on every run.

## Remaining issues

### ACD-REM-01 — Use protected homework attachments

`src/pages/school/academics/Homework.jsx` still accepts an attachment URL as
text, and the API stores it directly. The plan requires protected upload and
access behavior.

**Required:** use the school upload service, validate file type and size,
enforce tenant and homework permissions, and test authorized download,
unauthorized access, and upload failure.

### ACD-REM-02 — Make room booking conflict-safe and migration-compatible

Timetable and exam routes check room conflicts and then insert separately;
concurrent requests can both pass the check. Migration 28 adds `room_id` but
does not map legacy `room_no` values. The configured databases currently have
no schedule rows missing room IDs, but representative legacy data still needs
a migration test.

**Required:** make validation and booking atomic (or enforce the conflict rule
at the database level), test simultaneous requests, and provide a room-name
mapping report/backfill for legacy databases.

### ACD-REM-03 — Preserve duplicate submission history

Migration 28 deletes older duplicate homework submissions before adding a
unique index.

**Required:** back up and reconcile duplicates before rollout, or replace the
delete with a documented preservation/archival strategy. Test the migration on
a representative database and compare submission and grade history.

### ACD-REM-04 — Correct late-date timezone handling

Homework late status is computed from `new Date().toISOString()` (UTC), while
school settings default to `Asia/Kolkata`. A submission near local midnight can
be assigned the wrong late status.

**Required:** calculate the effective school-local date and test due-date
boundaries around midnight and daylight-saving transitions where applicable.

### ACD-REM-05 — Execute linkage QA

`AC-LINK-01`–`AC-LINK-08` in `plan/academics/README.md` have not been
explicitly exercised as end-to-end integration tests. The workflow test covers
CRUD, permissions, privacy, and history, but cross-module linkage (admissions
→ enrollment → attendance → timetable → homework → reports) should be run
in an isolated tenant.

**Required:** run the integration linkage scenarios and record evidence before
final sign-off.

## Release decision

Academics workflow tests pass (45 checks). Do not mark Academics complete until
the protected upload policy, room concurrency/migration behavior,
duplicate-history handling, timezone handling, and linkage integration tests
are closed or explicitly accepted as documented policy.
