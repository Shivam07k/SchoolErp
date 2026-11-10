# Timetable 2 — Teacher Timetable

**Menu path:** `/school/timetable/teacher`  
**Priority:** Core self-service view.  
**Current baseline:** a weekly/year selector screen and authenticated
teacher-scoped API exist; the API ignores forged teacher filters and fails
closed for unlinked teachers. The workflow suite covers these API cases.

## Goal and behavior

A teacher sees their own published classes by day/week, with period times,
class/section, subject, room, and approved substitutions. The teacher identity
must map consistently between HR employee records, subject allocations, and
the authenticated account.

Ordinary teachers must not select an arbitrary `teacherId`. An authorized
scheduler may view another teacher's timetable for operational purposes.
Unpublished drafts and other teachers' personal views remain inaccessible.

## Linkage and dependencies

Reads the active published version through the shared date resolver and overlays
confirmed date overrides. Uses the authenticated staff identity and school
timezone. Optional print and calendar export must use the same filtered result.

## Implementation requirements

1. Keep `/teacher`; add date selection against effective-dated versions and the
   school calendar. No independent schedule query logic is allowed in the UI.
2. Continue resolving the teacher from the authenticated account; managers may
   select a teacher only through an explicitly authorized server filter.
3. Normalize staff identity in allocations so each assigned teacher resolves
   consistently after login.
4. Overlay only confirmed overrides for the selected date and show the original
   slot and replacement clearly.
5. Add the room view as a read-only audience of the same resolver.
6. Verify print, school-timezone boundaries, empty/error states, direct links,
   and back/forward navigation in browser QA.

## QA cases

- **TM-TEACHER-01 self-scope:** teacher sees their published schedule and
  cannot fetch another teacher by changing a query parameter.
- **TM-TEACHER-02 identity:** allocations created from each supported teacher
  source resolve to the correct logged-in teacher.
- **TM-TEACHER-03 schedule:** periods, rooms, class, section, and subject agree
  with the master.
- **TM-TEACHER-04 substitution:** approved changes appear only for the affected
  date/period; original history remains available to authorized schedulers.
- **TM-TEACHER-05 publish/year:** drafts are hidden and closed-year history
  remains readable.
- **TM-TEACHER-06 access:** view-only, scheduler, and wrong-tenant cases are
  enforced by the API, not only the screen.
- **TM-TEACHER-07 UX:** direct route, refresh, week navigation, print, empty
  schedule, and failed request.

**Acceptance:** an authenticated teacher sees only their current, published
schedule and authorized dated overrides; the room and student views resolve
the same effective schedule for the same date.
