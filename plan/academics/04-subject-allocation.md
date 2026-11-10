# Academics 4 - Subject Allocation

**Menu path:** `/school/academics/allocation`  
**Priority:** High; prerequisite for authoritative teacher timetables, exam schedules, and class-specific homework.  
**Starting status:** a dedicated allocation entity, screen, and API were not identified in the current inventory.

## Goal and behavior

Allocate a subject to a class and section for one academic year, with one or more valid teachers and explicit effective dates/lead-teacher policy. Support team teaching only if the workflow and downstream timetable rules define it.

Each allocation must reference same-tenant records:

`academic_year_id + class_id + section_id + subject_id + teacher_id`

The section must belong to the selected class, the subject must be eligible for that class, and the teacher must be active and authorized for the campus/year. Prevent duplicate active allocations under the chosen teacher/team rule.

## Current inventory

- The subject catalog is in `school_subjects`; its optional `class_id` cannot represent section/year/teacher assignment.
- `school_timetables` stores class/section/subject/teacher values directly; no allocation foreign key was identified in the inspected schema.
- No dedicated allocation table or `/school/academics/allocation` API was found in the route inventory.
- Planned ownership: `src/pages/school/academics/SubjectAllocation.jsx`; backend route in the agreed school academic route group; versioned schema migration.

## Linkage and dependencies

Depends on Classes & Sections, Subjects, Academic Years, staff identity/active status, and campus policy. Feeds timetable, teacher timetable, exam schedule eligibility, homework authoring, LMS courses, and academic reports.

## Implementation sequence

1. Decide teacher cardinality, lead/co-teacher rules, effective dates, and whether allocations are campus-specific.
2. Add the normalized allocation model with tenant-scoped foreign-key/unique constraints and indexes.
3. Implement filters by year, class, section, subject, and teacher; use dependent selectors and clear stale selections when a parent changes.
4. Validate every foreign key and combination on the server; do not trust hidden UI choices.
5. Connect timetable/exam/homework forms to allocations; preserve historical allocations when staff or catalog records become inactive.

## QA cases

- **AC-ALLOC-01 CRUD:** create, list, update dates/teacher, deactivate, and reactivate a valid allocation.
- **AC-ALLOC-02 required links:** reject missing year, class, section, subject, or teacher.
- **AC-ALLOC-03 ownership:** reject cross-tenant IDs, inactive teacher, wrong-class section, and class-ineligible subject.
- **AC-ALLOC-04 duplicate:** reject duplicate active allocation for the same year/class/section/subject and teacher set; allow policy-approved team teaching.
- **AC-ALLOC-05 effective dates:** reject invalid ranges and overlapping active assignment according to policy; verify historical date-bound queries.
- **AC-ALLOC-06 downstream:** allocation appears in timetable, exam, and homework selectors; a deactivated allocation cannot be used for new records but historical rows remain visible.
- **AC-ALLOC-07 permissions:** read/manage split, direct API access, campus scope, and audit.
- **AC-ALLOC-08 concurrency:** simultaneous duplicate allocation requests create one valid active allocation only.
- **AC-ALLOC-09 UX:** changing year/class resets invalid section/subject/teacher choices; empty and stale-reference states are actionable.

## Linkage tests

Run `AC-LINK-03`, `AC-LINK-05`, and `AC-LINK-08` from the [section plan](README.md).

**Acceptance:** every section's subject/teacher offering is explicit, year-scoped, validated, and reused consistently by timetable, examination, and homework workflows.
