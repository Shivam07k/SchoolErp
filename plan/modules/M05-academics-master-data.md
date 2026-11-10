# M05 — Academics Master Data

**Package ID:** M05.

**Priority:** Core. **Starting status:** partial/verify.

## Menu submodules

The current Academics menu has six children: Classes & Sections, Subjects, Academic Years, Subject Allocation, Rooms, and Homework. Each has a separate implementation and QA specification in [`plan/academics/README.md`](../academics/README.md).

Curriculum/standards, lesson plans, and gradebook/report-card setup are related capabilities, but are not among these six current Academics menu children. Track them under the owning LMS/Examinations work packages unless the menu scope is deliberately expanded.

## How it must work

Create validated academic structures before enrollment and scheduling. Prevent duplicate names/codes and mismatched class/section/course references. Edits preserve historical records; delete/archive behavior for referenced records is explicit.

## Dependencies and links

M02 campus/year → class/section/course → M06/M07 admissions and enrollment, M13 timetable, M14 attendance, M15 exams, M16 LMS, M30 reporting.

## Files

- Frontend: `src/components/SchoolPage.jsx`; `src/forms/frmSchoolClasses/`.
- Backend: class/section/subject endpoints in `server/src/routes/school.js`; school academic-year context in `server/src/routes/schoolFoundation.js`; homework submissions and lesson plans in `server/src/routes/school_more.js`. Dedicated CRUD route ownership for the other children is specified in `plan/academics/`.
- Shared: `src/school/menu.js`, `src/api.js`.

## QA plan

- Use the six submodule plans for CRUD, validation, permissions, tenant isolation, history, and module-specific test cases.
- Run all `AC-LINK-*` cases in [`plan/academics/README.md`](../academics/README.md), especially enrollment, timetable/exam, room-conflict, and homework submission/grading linkages.
- Keep this work package in partial status until every child route is explicit and the shared section release gate passes.

**Acceptance:** all dependent modules use the same validated academic master records.
