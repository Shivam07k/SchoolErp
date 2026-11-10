# Student Attendance and Registers

## Scope

Deliver the first reliable attendance workflow for students. Daily attendance is the initial mode; period attendance is enabled only after the timetable/session contract is agreed and tested.

## Marking workflow

1. Resolve the user's permitted campus and section, defaulting to their assigned section when available. Choose the school date and daily/period mode.
2. Confirm that the date is an instructional date. Show a closure/holiday state without creating an attendance register for a non-instructional day.
3. Load the effective enrollment roster for the selected date, including students who joined or left mid-year correctly.
4. Load the existing register or create one with a version/state. Display approved leave and event/activity context as badges; these rows are not overwritten by “All present.”
5. The teacher uses “All present” for eligible unmarked students, changes exceptions (Absent, Late, Partial/Early departure, Approved leave, Event/School activity, or locally configured codes), and may add a restricted internal remark.
6. The teacher saves a draft or submits. Submitted data becomes read-only to ordinary marking; a permitted correction flow handles later changes.
7. The system recalculates counts from saved entries and updates student history/dashboard views. A successful submission emits an idempotent event for notification processing.

## Data and integrity contract

Use the existing tenant-scoped database and migration conventions. Prefer a normalized register/entry model over extending the current one-row-per-student/date key.

| Entity | Required responsibilities |
|---|---|
| Attendance policy/status catalogue | Configured status code/label, student or staff applicability, active dates, physical-presence category, reason/authorization category, and policy calculation mapping. |
| Register | Tenant/campus, academic year, section, date, optional timetable session/period, state, creator/submitter/finalizer, timestamps, optimistic version, source. |
| Register entry | Register, student, status, optional late/partial minutes, internal remark, source, actor and timestamps. Unique by register/student. |
| Calendar context | School day type and instructional sessions. Holidays/closures change whether a register is expected; they are not student status entries. |
| Enrollment history | Student-section membership with effective start/end dates; roster eligibility is date-based. |

Required integrity:

- Unique register context: tenant/campus + academic year + section + date + mode/session.
- Unique student entry per register.
- Foreign keys and server-side validation ensure the student, section, timetable session, and register all belong to the same tenant and effective enrollment.
- Validate date and status codes, reject unsupported statuses and malformed entries, and return row-level errors rather than silently dropping them.
- Enforce policy-dependent past/future date rules and permissions server-side. Do not rely on hidden controls.
- Bulk writes are transactional and use a register version to detect competing submissions. A conflict returns a clear response and does not overwrite the other user's work.
- Retain student/enrollment history; avoid hard deletion cascading attendance history.

## Register lifecycle

`Not started -> Draft -> Submitted -> Finalized`

- A register may be reopened only by an authorized role with a reason; reopening is itself audited.
- Finalization can be manual or policy-scheduled. The scheduler must be idempotent and report failures for follow-up.
- A non-instructional date or cancelled class session is not finalized as an all-absent register.
- Keep the distinction between “not marked” and “marked with zero attendance”; dashboard reminders must identify missing registers.

## UI requirements

- Default to the user's authorized section and today; prevent accidental cross-section marking.
- Provide bulk “All present,” search by name/roll/admission number, clear status labels, exception controls, and saved-count feedback.
- Show roster total, marked/unmarked count, and status totals based on the displayed register only.
- Mark approved leave/activity and finalized state visibly; do not mix staff records into the student register.
- Support keyboard/touch use and avoid one-click destructive edits after submission.

## Acceptance criteria

- A teacher can mark and submit a normal class roster in a usability test; benchmark a 40-student roster and use one transactional save.
- Reloading the register reproduces the saved state; counts equal the entry rows and are scoped to that register.
- Duplicate context, duplicate student entries, invalid statuses, wrong-tenant students, wrong-section students, and stale versions are rejected explicitly.
- A student admitted, transferred, or exited mid-year appears only for valid enrollment dates, while historical attendance remains readable.
- A holiday/closure produces no expected register and does not lower attendance percentages.
- Daily and period contexts cannot create ambiguous duplicate entries; period mode cannot be enabled before timetable mapping is accepted.
- UI and API return consistent status and validation errors; no partial batch is reported as fully saved.
