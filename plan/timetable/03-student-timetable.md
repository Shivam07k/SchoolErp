# Timetable 3 — Student Timetable

**Menu path:** `/school/timetable/student`  
**Priority:** Core student/guardian self-service view.  
**Current baseline:** a student timetable screen and enrollment-scoped API
exist. The API ignores forged class/section filters and returns an empty result
when no active enrollment is linked; the workflow suite covers these cases.

## Goal and behavior

A student sees the published timetable for their active enrollment's academic
year, class, and section. The schedule must include period/time, subject,
teacher, and room, with dated substitutions shown consistently. A parent view,
if enabled, must derive the linked child rather than accept arbitrary student,
class, or section IDs.

## Linkage and dependencies

Depends on the authenticated student-to-account link, the enrollment for the
selected academic year, and the shared date resolver. Connects to the teacher
and room views, attendance, LMS, portal, and reports.

## Implementation requirements

1. Keep `/student`; have the server resolve the enrollment for the selected
   year and return only the active published version for that class/section.
2. Continue ignoring client-supplied student, class, and section identity
   filters; do not reveal another class or draft.
3. Render the shared resolved day, including calendar closures and confirmed
   date overrides, without implementing separate UI resolution rules.
4. Keep no-enrollment behavior fail-closed and actionable.
5. Defer guardian/multiple-child selection until guardian linkage and its
   authorization policy are explicitly designed.
6. Verify direct route, refresh, responsive view, print, school-timezone
   boundaries, and browser navigation.

## QA cases

- **TM-STUDENT-01 self-scope:** student sees only their active class/section
  schedule; forged class, section, or student IDs do not change the result.
- **TM-STUDENT-02 year change:** current enrollment selects the new year's
  schedule while prior-year history remains unchanged.
- **TM-STUDENT-03 publication:** drafts and archived versions are hidden;
  published changes appear consistently.
- **TM-STUDENT-04 substitution:** affected date/period displays the approved
  substitute without changing the original record.
- **TM-STUDENT-05 no enrollment:** show an actionable empty state without
  falling back to another class.
- **TM-STUDENT-06 parent access:** linked guardians see only the selected
  linked child's schedule.
- **TM-STUDENT-07 tenant/UX:** wrong-tenant IDs fail; direct route, refresh,
  responsive view, and print preserve the same scope.

**Acceptance:** students see only their enrollment-scoped published schedule
and confirmed overrides; guardian access remains disabled until its link model
is defined and tested.
