# Timetable 1 — Timetable Master

**Menu path:** `/school/timetable/master`  
**Priority:** Core authoring workflow.  
**Current baseline:** the master screen, CRUD, draft/publish actions, allocation
and room validation, and transactional overlap checks exist. The API workflow
suite covers its current basic behavior. Effective-dated versions and canonical
period templates are not implemented yet; see [Foundation](00-foundation-and-periods.md).

## Goal and behavior

Authorized schedulers create, review, publish, revise, and retire a weekly
timetable for an academic year. Each published version has an effective date
range and immutable history. A slot links to one active subject allocation and
one canonical room. Class, section, subject, and teacher values derive from
that allocation.

The school must choose and document whether schedules are weekly recurring,
date-specific, or recurring with dated exceptions. Drafts must not appear in
student or teacher views until published. Revisions must preserve the prior
published version and record who changed it and when.

## Linkage and dependencies

Depends on Academic Years, Classes & Sections, Subject Allocation, Rooms,
staff identity, and the school's period/calendar configuration. Feeds teacher
and student views, substitutions, attendance, LMS, portals, and reports.

## Implementation requirements

1. Keep the existing master route and dependent selectors; add period-template
   and version selection without duplicating Academic/HR master data.
2. Derive class, section, subject, teacher, and academic year from the active
   allocation. Require the exact section for section-scoped allocations.
3. Add timetable versions with draft, published, and archived states, effective
   ranges, row-version checks, and clone-before-edit for published schedules.
4. Validate room type/capacity, active resources, year, and section ownership.
   Scope conflicts to the same version; also detect overlapping time ranges
   when two entries use different period IDs.
5. Keep conflict checks and persistence atomic. Add database uniqueness rules
   for canonical slots as defense in depth; do not rely only on a screen check.
6. Preserve legacy rows through an explicit backfill into a baseline version;
   never silently discard or publish legacy rows.

## QA cases

- **TM-MASTER-01 CRUD:** create, retrieve, update, and retire a draft; values
  persist after refresh.
- **TM-MASTER-02 allocation:** reject inactive or cross-tenant allocation,
  closed year, wrong class/section, and missing section.
- **TM-MASTER-03 room:** reject unknown, inactive, undersized, or
  cross-tenant room.
- **TM-MASTER-04 conflict:** reject room, teacher, and class/section overlap;
  allow different rooms and non-overlapping times.
- **TM-MASTER-05 concurrency:** competing requests for the same slot cannot
  both commit.
- **TM-MASTER-06 publish/history:** drafts stay hidden; publish makes one
  version authoritative; later revisions preserve prior published data.
- **TM-MASTER-07 permissions/tenant:** view-only cannot author; forged IDs and
  wrong-tenant references fail with no writes.
- **TM-MASTER-08 reliability:** duplicate submit, failed save, transaction
  rollback, audit row, and post-save refresh failure.
- **TM-MASTER-09 year/version isolation:** identical teacher/class/room slots
  are allowed in separate years or non-overlapping versions, but not within the
  same active version.
- **TM-MASTER-10 time overlap:** conflicting time ranges are rejected even when
  callers submit different period numbers; adjacent non-overlapping ranges pass.

**Acceptance:** one authoritative, effective-dated, conflict-free published
version drives every date resolver and downstream timetable view.
