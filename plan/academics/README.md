# Academics Section Plan

## Purpose and scope

This plan covers the six child modules currently listed under **Academics** in `src/school/menu.js`. Each module has its own implementation and QA plan:

1. [Classes & Sections](01-classes-sections.md)
2. [Subjects](02-subjects.md)
3. [Academic Years](03-academic-years.md)
4. [Subject Allocation](04-subject-allocation.md)
5. [Rooms](05-rooms.md)
6. [Homework](06-homework.md)

**QA state:** executed and passed (45 checks). Workflow test suite at
`server/tests/academics_workflows.test.mjs` covers academic-year
validation/overlap/close/delete restrictions, class/section/subject
duplicates and archive rules, allocation validation/duplicates/delete
restrictions, room duplicates/conflicts/delete restrictions, homework
lifecycle transitions, author ownership, teacher/student privacy,
eligible-student derivation, submission/resubmission/grading/grade
bounds, permission denial, tenant app_id spoofing, and cross-tenant
fail-closed behavior. All checks pass on fresh DB (migrations 19–28).

Current audit findings are tracked in [REMAINING.md](REMAINING.md). Do not
mark the section complete until the listed permissions, attachment,
migration/room-conflict, and QA gaps are closed or explicitly accepted.

| Submodule | Current menu path |
|---|---|
| Classes & Sections | `/school/academics/classes` |
| Subjects | `/school/academics/subjects` |
| Academic Years | `/school/academics/years` |
| Subject Allocation | `/school/academics/allocation` |
| Rooms | `/school/academics/rooms` |
| Homework | `/school/academics/homework` |

The menu currently marks all six as built; that flag is not evidence that each route has its own screen or complete workflow.

## Current baseline to verify

- `SchoolPage` contains the operational Classes & Sections and Subjects UI. `/school/classes` returns classes, sections, and subjects; class, section, and subject create/update/delete endpoints exist in `server/src/routes/school.js`.
- The current SQL schema has `school_academic_years`, `school_classes`, `school_sections`, and `school_subjects`.
- `/school/me` returns the school's academic-year list and active year. A dedicated academic-year CRUD screen/API was not identified in the current route inventory.
- A dedicated subject-allocation table/API was not identified. Do not treat the optional `school_subjects.class_id` as a complete teacher/class/section/year allocation.
- The SQL schema has `school_homework` and `school_homework_submissions`; current homework routes cover submission listing, student submission, and grading. A complete homework list/create/edit/publish lifecycle was not identified.
- Timetable and exam rows currently carry a free-text `room_no`; a canonical room master and allocation-conflict API were not identified.
- The menu exposes six Academic children, but `SchoolPage` has no explicit dispatcher for all six child keys. Verify and wire each child path to its own screen; do not silently render the Classes screen for an unfinished child.
- Existing backend academic writes use the `academics.manage` permission and reads use `academics.view`; validate the actual access resolver, tenant scoping, and each child route before extending it.

These are repository inventory findings, not claims that all deployed environments have identical migrations or data. Confirm the live database and route mount before implementing schema changes.

## How the section must work

Establish one authoritative set of tenant-scoped academic records and stable IDs. Forms must select valid parent records; downstream modules must consume those IDs rather than copying names or accepting free-text class, section, subject, year, teacher, or room values.

Academic-year changes must never rewrite historical enrollments, marks, schedules, submissions, or reports. Deletes must not silently cascade away records that have instructional or legal value. Use explicit archive/close behavior or a documented restriction where a record is referenced.

## Linkage map

```text
School / campus / access
  -> Academic Year
  -> Classes & Sections
  -> Subjects
  -> Subject Allocation (class + section + subject + teacher + year)
  -> Timetable and Examinations

Classes + Sections + Academic Year
  -> Admissions and Student Enrollments
  -> Attendance, Promotion, Reports

Class / Section / Subject Allocation / Academic Year
  -> Homework
  -> Student submission -> Teacher grading -> LMS / portal / reports

Rooms
  -> Timetable room occupancy
  -> Exam room assignment
  -> Facilities / maintenance inventory
```

### Linkage contracts

- A section always belongs to exactly one class. A student enrollment's class and section must agree for the same tenant.
- An academic year has one stable ID. A year selected in the shell is not a substitute for validating the year ID on the server.
- A subject remains a catalog record. Teaching a subject to a section in a year is a separate allocation record with an assigned teacher.
- Room bookings are identified by room ID, date/day, period or time interval, and campus. A room name is display data, not a conflict key.
- Homework is attached to one academic year and a valid class/section/subject allocation. Eligible students are derived from active enrollment, not an arbitrary submitted student ID.
- Reports and portals read the same source records and publish state as staff screens; they must not maintain separate copies.

## Build order

1. **Route and access audit:** map each menu child to a rendered screen, API, permission, schema, and test. Confirm `academics.view/manage` are resolved consistently in every route group.
2. **Classes & Sections:** validate CRUD, parent ownership, duplicate handling, capacity, referenced-record behavior, and student enrollment consistency.
3. **Subjects:** stabilize the subject catalog and class eligibility rules; retain historical subject references.
4. **Academic Years:** implement list/create/update/activate/close workflows and prove downstream year scoping.
5. **Subject Allocation:** create the normalized class-section-subject-teacher-year relationship and validate teacher/subject ownership.
6. **Rooms:** create the canonical room master and connect timetable/exam assignments with conflict checks.
7. **Homework:** implement teacher lifecycle, student submission, grading, permissions, and downstream display.
8. **Linkage and release:** run all `AC-LINK-*` scenarios, tenant/role matrix, regression tests, and reconciliation checks before marking menu children built.

## Shared QA contract

Run against an isolated test tenant with disposable fixtures. Record user role, tenant, campus, academic year, route, request/response, database result, and test ID. Do not use production or valuable school data for mutating tests.

Every submodule must test:

- Sidebar visibility, direct hash route, refresh, back/forward, invalid child route, and the correct screen title/content.
- Read/manage roles; unauthenticated, view-only, wrong-tenant, and super-admin behavior. Server guards must deny writes even when a request bypasses the UI.
- Create/read/update/archive or close behavior; required fields; invalid IDs; duplicates; stale IDs; retries/double-submit; not-found; and database rollback.
- Tenant-boundary checks on every referenced ID, not only the primary row.
- Audit event, user identity, and record ID for successful writes; failures must not produce success-shaped responses.
- Correct linked records, accurate counts, filters, empty states, and no leakage of unpublished/student-private data.
- Restrict/archive semantics when records are referenced; prove historical-year data remains readable and unchanged.

## Integrated QA scenarios

| Test ID | Scenario and expected linkage |
|---|---|
| AC-LINK-01 | Configure academic year, class, and section; admit/enroll a student into that exact year/class/section. The student roster and enrollment history show the same IDs and display names. |
| AC-LINK-02 | Change a student's current enrollment in a later year; attendance and class rosters follow the current enrollment while the previous year's enrollment remains unchanged. |
| AC-LINK-03 | Allocate a subject and teacher to a section for a year; timetable and exam forms offer only that valid allocation, and reject mismatched class/section/year/teacher combinations. |
| AC-LINK-04 | Assign rooms to timetable and exam sessions; reject overlapping bookings for the same room and time while allowing separate rooms or non-overlapping slots. |
| AC-LINK-05 | Publish homework for a class/section/subject/year; only eligible enrolled students can view/submit; the teacher can review/grade; the same result appears in the authorized LMS/portal/report view. |
| AC-LINK-06 | Close a year and open the next one; new admissions/enrollments use the new active year while historical schedules, homework, submissions, marks, and reports remain scoped to the closed year. |
| AC-LINK-07 | Compare class/section/subject/year/room totals across source lists and dependent reports; filters and exports return the same tenant/year-scoped rows as the UI. |
| AC-LINK-08 | Attempt to reference a class, section, subject, teacher, year, or room from another tenant; every write is rejected and neither tenant's data changes. |

## Files and ownership

| Concern | Current owner / candidate |
|---|---|
| Menu and child URLs | `src/school/menu.js` |
| Route shell and child dispatch | `src/app.jsx`, `src/components/SchoolPage.jsx` |
| Current class/section/subject UI | `src/components/SchoolPage.jsx`; legacy candidate `src/forms/frmSchoolClasses/` |
| Academic child screens (planned) | `src/pages/school/academics/{ClassesSections,Subjects,AcademicYears,SubjectAllocation,Rooms,Homework}.jsx` |
| Current class/section/subject APIs | `server/src/routes/school.js` |
| Homework submissions and lesson plans | `server/src/routes/school_more.js` |
| Access, active year, and school context | `server/src/school/foundation.js`, `server/src/routes/schoolFoundation.js` |
| Existing core schema | `sql/19_school_core.sql`; homework schema `sql/23_school_full.sql`; versioned changes belong in a new migration |
| Downstream integrations | admissions/students, attendance, timetable, examinations, LMS, reports, and facilities route groups |

Proposed screen names are planning locations, not existing files. Reuse shared layouts and API helpers; add new files only after route and data ownership are confirmed.

## Release gate

Do not mark an Academics child `built` or complete until its route opens the intended screen, its read/write APIs pass module QA, applicable `AC-LINK-*` tests pass, tenant and permission tests pass, and historical-data behavior is verified. Record unfinished functions as not built rather than routing them to an unrelated screen.
