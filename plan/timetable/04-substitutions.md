# Timetable 4 — Substitutions

**Menu path:** `/school/timetable/substitution`  
**Priority:** Operational continuity workflow.  
**Current baseline:** the Substitutions screen and API support dated assignment,
active-teacher validation, availability checks, update/cancel, history, and
tenant-scoped visibility. The workflow suite covers core cases. A sourced
absence/unavailability board, ranked suggestions, and notifications are later
work.

## Goal and behavior

An authorized scheduler assigns an available substitute to a specific dated
timetable occurrence when the scheduled teacher is absent. The substitution
must refer to an existing timetable entry, preserve its original teacher and
allocation, and be visible in the affected teacher/student views. Status,
reason, creator, timestamps, and notification state are auditable.

## Linkage and dependencies

Depends on the versioned Timetable Master, teacher identity, resource
unavailability, academic calendar, periods, class/section, and room. Feeds the
teacher/student/room resolver and later attendance/notification workflows.

## Implementation requirements

1. Keep the current screen and derive class, section, subject, teacher, and
   period from a published timetable occurrence; caller values only confirm.
2. Create one shared unavailability record model for teacher, room, and
   section absences, with date/range and affected periods.
3. Keep manual substitute choice in the first release. Validate active staff,
   eligibility, same-date availability, timetable version, class coverage, and
   duplicate assignments in one transaction.
4. Define the minimal lifecycle as assigned, completed, and cancelled. Add
   proposed/confirmed/declined only when the approval workflow exists.
5. Preserve every status/change in audit history; deleting a timetable must
   never silently erase substitution history.
6. Add ranked suggestions and bulk assignment later, using workload and
   subject/room eligibility as explicit policy inputs.
7. Send notifications through a transactional outbox after commit; retries
   must be idempotent.
8. Apply tenant, campus, year, and `timetable.manage` authorization on every
   write.

## QA cases

- **TM-SUB-01 valid assignment:** assign an available substitute to a real
  occurrence and verify the affected views.
- **TM-SUB-02 invalid references:** reject unknown timetable, teacher,
  substitute, class/section, date, or cross-tenant IDs.
- **TM-SUB-03 availability:** reject inactive substitute and overlapping
  teacher/class/period assignments.
- **TM-SUB-04 identity consistency:** absent teacher and class/section/subject
  are derived from the chosen timetable row.
- **TM-SUB-05 cancel/update:** cancel or replace an assignment while retaining
  audit history and restoring the original view.
- **TM-SUB-06 notification:** successful assignment sends one notification;
  rollback/retry does not create duplicates.
- **TM-SUB-07 authorization:** view-only users cannot assign or alter
  substitutions; direct API and wrong-tenant requests are denied.
- **TM-SUB-08 integration:** teacher/student timetable and attendance use the
  same effective substitution for that date and period.

**Acceptance:** each substitution is a validated, auditable change to one
dated timetable occurrence, consistently reflected in affected views.
