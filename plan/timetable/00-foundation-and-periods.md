# Timetable Foundation and Periods

## Goal

Establish one authoritative weekly timetable model without duplicating
Academic, HR, student, room, or allocation data.

## Reuse existing records

Use the existing academic years, classes, sections, students/enrollments,
subjects, subject allocations, staff, rooms, permissions, and audit log.
Timetable-specific records should reference these using `app_id`-scoped
relationships. Do not create parallel Teacher, Room, Subject, or AcademicYear
tables.

Subject allocation describes who may teach which class/section/subject in a
year. If the generator later needs required periods per week, block length, or
special room requirements, store those as curriculum demand rather than
overloading the allocation's identity fields.

## Period and version model

1. Define a school-owned weekly period template: weekday, period number, start,
   end, and type (`lesson`, `break`, `assembly`, `lunch`, or another configured
   fixed period). Periods in one template may not overlap.
2. Add a timetable version scoped to an existing academic year and period
   template. Track version number, `draft`/`published`/`archived` state,
   effective start/end dates, creator, timestamps, and a row-version token.
3. Keep assignments attached to a version and canonical period ID. On publish,
   make the version immutable. Editing a published schedule clones it to a new
   draft; publish closes the prior effective range and preserves its history.
4. Backfill existing `school_timetables` rows into a clearly named baseline
   version. Reconcile missing year/period data before publishing; do not infer
   uncertain legacy values silently.
5. Add a separate teacher link only if existing staff/user IDs cannot be
   normalized safely; keep that mapping tenant-scoped and unique.

## Invariants

- At most one published version is effective for a date and academic year.
- A slot references one allocation for the same year, class, section, subject,
  and teacher; derive those values server-side.
- Fixed periods cannot receive lesson assignments.
- Within one version and period, a section, teacher, and room cannot be assigned
  twice. Include the version in every conflict key so one year's schedule does
  not block another year's schedule.
- If entries can use arbitrary durations instead of canonical periods, reject
  overlapping time ranges as well as duplicate period numbers.
- Preserve `app_id` on every new row and enforce tenant identity in foreign-key
  strategy or validated API references.

## Migration and QA

- Migration is idempotent and safe for existing timetable data.
- Verify old entries remain readable before and after the baseline-version
  backfill.
- Test repeated migration, rollback, missing allocation, duplicate period
  template, and tenant-crossing references.
- Test that the same teacher/class/room slot is allowed in another academic
  year but blocked in the same version.

**Acceptance:** the app can identify the authoritative timetable version and
period template for any date, while retaining all existing data and history.
