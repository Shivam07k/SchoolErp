# Attendance — Current Gaps and Decisions

This is the initial audit register for M14. “Found” means visible in the files/routes inspected; verify deployment-specific migrations and route wiring before changing production data.

## Priority gaps

| Priority | Gap | Required action |
|---|---|---|
| P0 | Current table is daily-only and has no register lifecycle, period, correction, staff, or policy model. | Design a non-destructive migration that preserves and reconciles every existing `(tenant, student, date)` row. |
| P0 | Attendance UI payloads are inconsistent: `SchoolPage.jsx` posts `entries`, while `frmSchoolAttendance/ListPage.jsx` posts `students`; the current API reads `entries`. | Identify the active entry surfaces, define one API contract, and test it end-to-end before expanding UI. |
| P0 | The POST route upserts rows and skips unsupported/invalid entries rather than rejecting them; submitted rows have no correction history. | Validate the entire batch and roster server-side; make writes transactional and return explicit conflicts/errors. |
| P0 | Current roster is based on present-day student class/section fields, not effective enrollment on the attendance date. | Use dated enrollment history and validate student-section membership on every write. |
| P0 | The daily GET counts are date-wide and are not restricted to selected class/section. | Scope counts to the displayed register; define one summary query/service for screen, profile, and reports. |
| P1 | Current uniqueness is tenant/student/date, so it cannot represent sections/periods and could prevent a safe daily/period model. | Introduce register-context uniqueness and one entry per student/register without losing existing daily records. |
| P1 | Menu advertises Register, Corrections, Staff, and Reports; reviewed attendance API only includes mark, summary, and profile/dashboard paths. | Trace route components and add module-specific workflows; update any inaccurate built-state indicators after evidence. |
| P1 | Current table cascades attendance on student deletion and has no policy/status catalogue or school calendar linkage. | Preserve history through archival/soft-delete; link effective-dated policies/calendar and exclude non-instructional days. |
| P1 | Student attendance reads feed dashboard/profile and student promotion/exit data. | Reconcile these consumers against the canonical effective attendance view; verify counts remain stable after corrections. |
| P2 | Staff attendance and leave are not part of the current attendance schema/routes inspected. | Define ownership with HR before implementation; do not mix staff with students or calculate payroll in M14. |
| P2 | Timetable substitution/unavailability contract must be confirmed. | Verify the timetable API, publish behavior, and unavailability semantics before linking staff absences. |

## Decisions required before implementation

1. Confirm the school's country/board and required attendance/admission register fields and codes.
2. Select daily-only first-release policy, with period attendance deferred but supported by the register context.
3. Approve status definitions and calculation rules separately for physical presence, excused/authorized absence, and reporting denominators.
4. Set late/partial-day rules, correction window, finalization cutoff, approval separation, and minimum-attendance alerts.
5. Confirm whether parent portal and notification channels are available, consented, and affordable; choose SMS/app/email only after Communication integration review.
6. Assign ownership for staff leave/shift policy (HR) and decide whether attendance should publish staff availability to timetable.
7. Specify retention/attachment/export rules and any statutory reporting formats.

Do not treat the feature/competitor statements in the supplied source as verified comparative research. Validate specific vendor claims independently if a product comparison is needed.
