# M13 — Timetable

**Package ID:** M13.

**Priority:** Core. **Current status:** four child screens and core API
workflows exist; versioned schedules, period templates, calendar overrides,
and downstream integration remain planned work. The current API test suite
passes 25 checks; browser and attendance/report linkage need separate QA.

## Submodules

- [Timetable Master](../timetable/01-timetable-master.md)
- [Teacher Timetable](../timetable/02-teacher-timetable.md)
- [Student Timetable](../timetable/03-student-timetable.md)
- [Substitutions](../timetable/04-substitutions.md)
- [Foundation and Periods](../timetable/00-foundation-and-periods.md)
- [Calendar and Overrides](../timetable/05-calendar-and-overrides.md)
- [Auto-Fill](../timetable/06-auto-fill.md)
- [Reports and Hardening](../timetable/07-reports-and-hardening.md)

Period/version foundations are defined in the [Foundation plan](../timetable/00-foundation-and-periods.md)
and built through the [Master plan](../timetable/01-timetable-master.md).
Rooms and teaching allocations remain owned by M05 Academics.

## How it must work

Draft schedules validate room, teacher, and class conflicts. Published schedules are consistent for every role. Substitutions update affected views and preserve the original schedule history.

## Dependencies and links

M02 academic year + M05 classes/subjects/rooms + M18 staff → M14 attendance, M16 LMS, M08 portals, M24 facilities, M30 reports.

## Files

- Menu routes: `src/school/menu.js`; screens are dispatched in `src/components/SchoolPage.jsx`.
- Current API and validation: `server/src/routes/school_more.js`.
- Workflow coverage: `server/tests/timetable_workflows.test.mjs`.

See [`plan/timetable/README.md`](../timetable/README.md) for the current route
inventory, module plans, and integrated QA scenarios.

## QA plan

- Reject overlapping teacher, room, and class periods within one version, while allowing identical slots in different academic years.
- Test valid substitution, publish/unpublish permissions, version history, and academic-year boundary.
- Confirm student and teacher views show the same published schedule.
- Test direct route, refresh, empty timetable, and failed save.
- Verify date overrides and downstream attendance/report resolution.

**Acceptance:** published timetable is conflict-free and authoritative for attendance and role-specific views.
