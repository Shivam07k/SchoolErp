# Timetable Section Plan

## Scope

This folder contains plans for the four current Timetable child routes plus
shared foundation and later-phase capabilities:

1. [Foundation and Periods](00-foundation-and-periods.md)
2. [Timetable Master](01-timetable-master.md)
3. [Teacher Timetable](02-teacher-timetable.md)
4. [Student Timetable](03-student-timetable.md)
5. [Substitutions](04-substitutions.md)
6. [Calendar and Overrides](05-calendar-and-overrides.md)
7. [Auto-Fill](06-auto-fill.md) (later phase)
8. [Reports and Hardening](07-reports-and-hardening.md)

For the user journey, flow charts, current features, and implementation caveats,
see [Timetable Working Flow](timetableworking%20flow.md).

**Current QA state:** **Phase 1 (Foundation) & Phase 2 (Master) complete.** API workflow suite
`server/tests/timetable_workflows.test.mjs` passed 27 checks. Both test suites
(timetable + academics) pass. Frontend build, backend syntax, `npm run setup:school -- --all`
on all 3 companies, and migration 29 applied successfully. Phase 3 (Views) screens
now wired to backend's effective-version resolver with date-based week navigation.

## Current inventory

- Menu paths defined in `src/school/menu.js`.
- Four child screens dispatched by `src/components/SchoolPage.jsx`.
- Timetable CRUD, draft/publish, authenticated audience scoping, transactional
  conflict checking, and substitution validation/update/cancel implemented in
  `server/src/routes/school_more.js`.
- **Migration 29** adds `school_periods`, `school_timetable_versions`,
  `version_id` + `period_id` on `school_timetables`, unique constraints per
  version+period, baseline version backfill, period backfill, and **exclusion
  constraint preventing overlapping published versions**.
- Phase 2 (Master) screen uses version selector with create/publish/archive
  actions, sends `versionId` + `periodId`, filters entries by version, shows
  version status/effective dates, auto-fills start/end times from period.
- Teacher/Student views use backend's effective-version resolver (send `date`
  param, optional `versionId` override), week navigation reloads with date.
- Teacher/class conflict checks use **time-range overlap** (not just period ID).
- Concurrent version publishes serialized with **advisory lock**.
- Substitutions screen no longer requires `academicYearId`.

## Recommended architecture

Use one immutable-after-publish weekly timetable version per effective period.
Each version belongs to an existing academic year and has draft, published, or
archived state plus effective dates and a row/version token. Editing a published
schedule creates a new draft version; publishing it closes the previous
effective range without overwriting history.

Store day/period assignments in that version. Prefer canonical period IDs from
a school period template over arbitrary per-entry times; this makes slot
conflicts expressible as database uniqueness rules. Keep date-specific changes
as overrides. One date resolver must apply, in order: active version, calendar
day type, resource unavailability, then confirmed overrides. Teacher, student,
and room views all read that resolved schedule.

Reuse the existing academic, HR, room, and allocation records. Add a separate
weekly curriculum-demand record only when auto-fill needs required periods per
week, block length, or subject-specific room needs; do not overload a teacher
allocation with scheduling demand.

Separate hard constraints (double-booking, inactive resources, ineligible
teacher, unavailable room, fixed period) from soft preferences (workload,
gaps, subject distribution). Hard constraints block saves. Soft constraints
warn or become solver preferences. Any permitted override requires a reason,
permission, and audit entry.

## Build order

| Phase | Deliverable | Release boundary |
|---|---|---|
| 0. Decisions and data audit | Confirm week pattern, period model, effective-date rule, timezone, and reuse of existing ERP records. | No schema work until decisions are recorded. |
| 1. Foundation | Period templates, fixed periods, version model, migration/backfill, identity and room/allocation linkage. | Existing weekly entries remain readable. |
| 2. Master | Versioned grid, manual placement/move/swap, validation, draft/publish/archive, audit, atomic conflict rules. | Admin can publish one conflict-free authoritative version. |
| 3. Views and calendar | Shared date resolver plus teacher, student, and room views; holidays and half-days. | All views agree for the same date/version. |
| 4. Absence and substitution | Teacher unavailability, affected-period board, manual substitute assignment, confirmation/cancel lifecycle. | A substitute is eligible and free; no automatic assignment yet. |
| 5. Date overrides | Cancel, room/teacher change, extra class, and copy-day operations without editing the weekly base. | Overrides are date-scoped, audited, and resolved consistently. |
| 6. Auto-fill (optional) | Shortage analysis, solver-generated draft, unplaced reasons, manual review. | Solver output is never published automatically. |
| 7. Operations | Workload/coverage/room reports, notifications, imports/exports, archive/restore, monitoring and recovery. | Notifications are committed through an idempotent outbox. |

**Recommended MVP:** phases 0–5, with a manual master grid, shared views,
calendar basics, and manual substitutions. Defer solver generation, co-teaching,
elective groups, payroll, advanced substitution ranking, parent multi-child
selection, and automated notification channels until the core resolver and
versioning are stable.

Keep the current four menu children for the MVP. Treat Room Timetable as a
read-only view and Calendar as a filter/panel within the master and audience
views; add new top-level menu routes only if users validate that navigation
need.

## Defaults for unresolved decisions

- Weekly recurring timetable with named periods; no A/B week or elective-group
  layer in the first release.
- One effective published version at a time per academic year; revisions are
  new versions, not in-place edits.
- School-local dates and an IANA timezone; use date-only values for school
  calendar dates and UTC instants for audit/notification timestamps.
- Manual substitution selection first; ranked suggestions and bulk auto-assign
  are later features.
- Parent access is deferred until guardian-to-student linking and multi-child
  selection are explicitly defined.

## Linkage contract

```text
Academic Year + Class/Section + Subject Allocation + Periods + Room
                              -> Timetable Master
                              -> Teacher Timetable
                              -> Student Timetable
                              -> Attendance / LMS / Portals / Reports
Timetable occurrence + absent teacher + available substitute
                              -> Substitution
```

- A schedule entry must derive class, section, subject, and teacher from one
  active allocation for the same academic year. Reject a missing or mismatched
  section rather than creating a class-only row for a section allocation.
- Room, teacher, class/section, and time/period conflicts must be rejected
  server-side, including concurrent writes.
- Teacher and student views must derive identity and enrollment from the
  authenticated account. A query parameter must not let a user browse another
  teacher's or student's timetable.
- Student and teacher views must use the same published schedule version.
  Drafts and unpublished changes are visible only to authorized schedulers.
- A substitution applies to a dated timetable occurrence, preserves the
  original entry, and appears consistently in teacher/student views and
  attendance.

## Shared QA contract

For each child, test direct route, refresh, back/forward navigation, empty and
error states, view/manage role enforcement, tenant isolation, duplicate/retry
behavior, audit identity, and persisted values after reload. Use disposable
test data; do not mutate a valuable school database.

## Integrated tests

| Test ID | Expected result |
|---|---|
| TM-LINK-01 | A published entry resolves to the same year, class, section, subject, teacher, and room IDs in the master and both audience views. |
| TM-LINK-02 | Invalid allocation, section/class mismatch, closed year, or archived room is rejected without a partial row. |
| TM-LINK-03 | Room, teacher, and class/section overlaps are rejected within the same version; another academic year does not cause a false conflict. |
| TM-LINK-04 | Time-range overlap is rejected even when period numbers differ; adjacent non-overlapping times pass. |
| TM-LINK-05 | A teacher/student can view only their own published timetable; forged IDs and unpublished schedules are denied. |
| TM-LINK-06 | A valid substitution updates the dated occurrence for affected views while preserving the original timetable record and audit history. |
| TM-LINK-07 | Attendance and reports use the same published schedule and substitution state as the timetable views. |
| TM-LINK-08 | Every linked ID from another tenant is rejected and neither tenant is modified. |
| TM-LINK-09 | Two concurrent requests for the same room, teacher, or class slot cannot both commit. |
| TM-LINK-10 | Publishing a new version preserves the former version and resolves the right version on either side of the effective-date boundary. |
| TM-LINK-11 | Calendar and overrides produce identical effective slots in teacher, student, room, attendance, and report views. |

## Release gate

Do not mark a Timetable child built until its route opens the intended screen,
its CRUD/view APIs pass module tests, role and tenant checks pass, and the
applicable `TM-LINK-*` tests pass. Update the [M13 plan](../modules/M13-timetable.md)
and implementation tracker with test evidence.

## Research notes and sources

The supplied scenario document has strong coverage but its vendor feature list
is discovery material, not a verified product comparison. Keep vendor claims
out of acceptance criteria unless the exact product/version and a public source
are recorded.

- PostgreSQL constraints: prefer `UNIQUE`, `EXCLUDE`, or foreign keys for
  cross-row invariants; a `CHECK` constraint is not a general cross-row guard.
  <https://www.postgresql.org/docs/current/ddl-constraints.html>
- PostgreSQL range types: represent and compare time intervals when a fixed
  period ID is not sufficient.
  <https://www.postgresql.org/docs/current/rangetypes.html>
- PostgreSQL advisory locks: transaction-scoped advisory locks can serialize
  application-controlled conflict checks; keep the transaction short and use
  the same lock protocol for every relevant writer.
  <https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS>
- Google OR-Tools CP-SAT scheduling example: illustrates separating assignment
  feasibility constraints from workload-balancing objectives; use only for the
  optional generation phase.
  <https://developers.google.com/optimization/scheduling/employee_scheduling>
- FET official project: a school/university timetable generator worth
  evaluating for import/export interoperability rather than assuming it is the
  right embedded solver.
  <https://lalescu.ro/liviu/fet/>

Research checked 2026-10-31. The current model should use canonical period
identifiers first; range/exclusion rules are an option if arbitrary durations
are introduced.
