# Staff Attendance

## Scope and ownership

Staff attendance is a separate HR capability. Do not store staff rows in the student attendance table or infer payroll deductions directly from a student register.

First release capture should be manual administrator marking and, if staff authentication/authorization is ready, self check-in/out. QR, RFID, biometric, GPS, and face capture are deferred until privacy, consent, device integrity, correction, and retention requirements are approved.

## Core workflows

### Daily staff register

1. Resolve active staff and their assigned campus/work schedule for the date.
2. Load approved HR leave and non-working calendar context.
3. Record manual attendance or check-in/out events, including source, actor, and timestamps.
4. Calculate late/early/working-time values from a versioned shift policy; flag missing punches for review instead of guessing.
5. Correct a punch or status through a reasoned, audited correction.
6. Publish the staff day's accepted summary to HR reports and, for teaching staff, the agreed timetable unavailability integration.

### Leave and absence

- HR remains the authority for staff leave types, balances, approvals, and payroll treatment.
- Attendance consumes approved leave as a non-working/authorized context; it does not create a second conflicting leave balance.
- Unplanned absence remains distinguishable from approved leave and official duty/training.
- Joining, termination, campus/role changes, and shift changes are effective-dated; historical registers remain stable.

## Proposed data boundary

Keep staff attendance records separate from student registers. A staff daily summary may reference staff, campus, date, shift, accepted status, first-in/last-out, calculated duration, source, and correction history. Raw device punches are a separate optional ingestion domain; do not introduce a device log table until a capture method is selected.

Shift policy should be effective-dated and configurable for start time, grace interval, expected duration, and half-day/late rules. Store raw punch timestamps separately from derived daily status so policy changes do not erase source evidence.

## Timetable and payroll contracts

- A teacher absence/approved leave should create or update an availability signal consumed by the Timetable substitution workflow; attendance must not create substitutions itself.
- Confirm timetable's supported unavailability endpoint, ownership, and publish behavior before implementing the link. Treat this integration as blocked until that contract is verified.
- Payroll receives a reviewed period export/API of approved paid leave, unpaid leave, and unapproved absence. Attendance does not calculate salary or make deductions.
- Make integrations idempotent and include source identifiers, effective dates, and reconciliation status.

## Roles

- HR/attendance administrator: configure staff policy, mark staff attendance, review missing punches and corrections.
- Principal/authorized manager: view school-level summaries and approve exceptions if granted.
- Staff member: view own record, check in/out where enabled, and request correction.
- Teacher timetable roles receive only the absence/availability information required for cover planning.

## Acceptance criteria

- Staff records cannot appear in student attendance queries, exports, or parent views.
- A shift policy change does not rewrite previously accepted raw punch data or audit history.
- Missing check-in/out, late arrival, approved leave, duty, and manual correction have separate, tested outcomes.
- HR leave is not double-counted or independently altered by the attendance module.
- Timetable and payroll outputs have explicit authorization, idempotency, and reconciliation; neither integration silently changes attendance.
- Device capture is not enabled without a separate approved data-protection and threat review.
