# Reports, Roles, and Integrations

## Reports and registers

Deliver reports from accepted attendance entries plus the effective approved corrections. Do not maintain separately edited tally tables.

### Student views

- Daily register by campus, section, and date; show marked and unmarked students.
- Monthly register and student history with status/reason distinction.
- Date-range summary: instructional sessions scheduled, present/attended sessions, absent sessions, approved absence, late/partial sessions, and unmarked sessions.
- Defaulter/threshold list and trends by class, section, weekday, month, or term, using configured policy.
- Optional period/subject view after timetable integration.
- Printable/exportable results with the exact selected filters, generation time, and authorized fields.

### Staff views

- Daily and monthly register, late/missing punch list, approved leave, attendance summary, and department/campus filters.
- Payroll-linked export contains only agreed attendance/leave fields and is clearly marked as a source report, not a salary calculation.
- Device reconciliation and overtime reports are deferred until device capture and overtime policy exist.

### Shared rules

- Show “not marked” as missing data, never as absent.
- Exclude closure/holiday and non-instructional sessions from the denominator.
- Report physical attendance separately from approved/authorized absence.
- Make numerator, denominator, rounding, period weighting, and threshold policy explicit and effective-dated. Avoid a fixed universal 75%/80% threshold.
- Exports must honor tenant, campus, role, date, and field-level permissions; audit sensitive export generation.
- Reconcile aggregates against the underlying register entries and approved corrections.

## Integration contracts

| Module | Contract |
|---|---|
| M02 organization/calendar | Source of campus, academic year, time zone, instructional dates, holidays, closures, and school sessions. |
| M07 students/enrollment | Effective-dated student-section membership; determines the eligible roster and historical section. |
| M13 timetable | Optional period/session key; later, staff unavailability input for substitution. Validate current timetable capabilities before committing this integration. |
| M08 parent/student portal | Read-only attendance history and authorized leave submission; identity must be linked to the correct student. |
| M09 student support | Authorized, minimized trend signal only; attendance should not automatically create a sensitive support case. |
| M18 HR/payroll | Staff leave and shift authority; attendance exports accepted attendance facts, not payroll decisions. |
| M26 communication | Queued, deduplicated notifications and delivery records. |
| M30 reports/dashboard | Read attendance aggregates from the canonical effective register data. |
| M32 import/export | Validate imports before apply; show row-level errors, preview, permission, and audit trail. |

## Security and operations

- Every read and write is scoped to authenticated tenant/campus permissions; the server validates student/staff membership and register ownership.
- Separate student/staff roles and restrict internal remarks, medical details, and evidence attachments.
- Audit marking, submission, reopening, correction request/decision, policy changes, export, and administrative override.
- Use soft deletion/archival and retention policy; do not cascade-delete accepted attendance history with a student/staff row.
- Notification and integration retries are idempotent, observable, and safe after partial service outages.
- Add indexes for register/date/section, student history, and status-filtered reporting after query patterns are measured.

## QA and release gates

1. Daily marking: all present, one absent, late, leave pre-mark, empty/unmarked roster, invalid status, duplicate save, and competing teacher save.
2. Enrollment/calendar: mid-year admission, section transfer, exit, holiday, closure, half-day, and student without a valid enrollment.
3. Lifecycle: draft edit, submit, finalization, reopen with permission/reason, correction approval/rejection, and report after correction.
4. Authorization: teacher own section, subject/cover period, attendance admin, principal, HR, parent, student, wrong tenant, and unauthorized export.
5. Integration: leave apply/approve/reject; notification dedupe/failure/retry; dashboard/profile totals; timetable unavailability; HR export.
6. Reconciliation: compare displayed counts, summary APIs, monthly register, student history, and exported totals to canonical accepted entries.
7. Operational: migration on a copy of existing data, rollback/recovery plan, concurrent writes, large-date-range report, and 40-student marking usability benchmark.

Release only when there are no unresolved high-severity tenant/privacy/integrity issues, the old attendance data is reconciled, and applicable M14 plus `LINK-*` tests pass.
