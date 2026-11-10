# Academics 3 - Academic Years

**Menu path:** `/school/academics/years`  
**Priority:** Foundational; implement before year-scoped enrollment and scheduling.  
**Starting status:** schema and school-context read exist; dedicated CRUD/activation UI and API were not identified in the current route inventory.

## Goal and behavior

- Create and maintain a named academic year with validated start/end dates and stable tenant-scoped ID.
- Define whether terms/semesters are in scope. If included, each term belongs to one year, has ordered dates, and cannot overlap another term in that year unless an explicit school policy allows it.
- Allow exactly one active year per tenant (or per campus if the data model explicitly supports campus scope); activation must be an atomic server operation.
- Closing a year prevents new ordinary records for that year but preserves read access and all historic enrollment, attendance, timetable, homework, assessment, grade, and report data.
- Current year selection in the shell is a convenience only; all write endpoints validate the submitted year ID and authorization.

## Current inventory

- Schema: `school_academic_years` in `sql/19_school_core.sql`, with unique `(app_id, name)`.
- Read exposure: `/school/me` returns `academicYears` and `activeAcademicYearId` from `server/src/routes/schoolFoundation.js`.
- References: student enrollment, admission approval, and promotion code use year IDs.
- A dedicated `/school/academics/years` screen and year create/update/activate/close API were not found in the route/UI inventory. Confirm before adding duplicate functionality elsewhere.

## Linkage and dependencies

Academic years scope admissions/enrollments, promotion, class-teacher/subject allocations, timetable, attendance, exams, homework, and analytics. Campus scoping is currently not evident in the year table; resolve tenant-wide versus per-campus year policy before schema design.

## Implementation sequence

1. Decide tenant-wide or campus-specific year ownership and term requirements.
2. Validate date ranges, active/closed transitions, and overlap policy.
3. Implement list/create/update/activate/close with transaction-safe single-active-year enforcement and audit.
4. Ensure shell selection and all downstream forms read the same year list and active ID.
5. Block destructive edits to years already used by academic records; offer close/archive instead.

## QA cases

- **AC-YR-01 CRUD:** create, list, and update a year; verify it is available through `/school/me` and the year selector after refresh.
- **AC-YR-02 dates:** reject missing dates, end before start, invalid dates, and prohibited overlap; test boundary dates.
- **AC-YR-03 activation:** activate one year and verify the previous year is inactive; concurrent activation requests cannot leave two active years.
- **AC-YR-04 close:** close a year and confirm new writes are blocked according to policy while reads/reports still work.
- **AC-YR-05 history:** attempt to delete or change dates for a year referenced by enrollments, schedules, marks, homework, and submissions; history must remain intact.
- **AC-YR-06 shell integration:** choose an active year, reload, navigate, and verify year-scoped screens use the same ID; stale/unauthorized IDs are rejected server-side.
- **AC-YR-07 permissions:** view-only, manager, unauthorized direct API, and audit actor/action.
- **AC-YR-08 tenant:** same year name in another tenant is independent; cross-tenant year IDs are rejected.
- **AC-YR-09 migration:** run migration on empty and representative existing databases; verify existing active year and references are preserved.

## Linkage tests

Run `AC-LINK-01`, `AC-LINK-02`, `AC-LINK-03`, `AC-LINK-05`, `AC-LINK-06`, and `AC-LINK-07` from the [section plan](README.md).

**Acceptance:** active year is unambiguous and consistent across the shell, admission/enrollment, promotion, and all year-scoped teaching workflows; closing never erases history.
