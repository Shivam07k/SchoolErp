# Academics 2 - Subjects

**Menu path:** `/school/academics/subjects`  
**Priority:** Foundational.  
**Starting status:** partial; subject CRUD currently appears alongside Classes & Sections and must be separated or deliberately routed.

## Goal and behavior

- Maintain a subject catalog with stable ID, name, optional code, active/archive state, and documented grading metadata.
- Support a school-wide subject or class-eligible subject without encoding each teaching assignment into the catalog row.
- Keep the actual offering to a class/section/year/teacher in Subject Allocation. The optional `school_subjects.class_id` is an eligibility constraint, not a substitute for an allocation.
- Preserve subject identity and historic marks when the display name/code changes. Archive referenced subjects rather than deleting them.
- Validate max marks as positive where used; prefer assessment-specific max marks in Examinations rather than treating one catalog value as every exam's range.

## Current inventory

- UI: subject create/edit/delete and list cards are in `src/components/SchoolPage.jsx`; legacy candidate `src/forms/frmSchoolClasses/`.
- API: `/school/classes` returns subjects; `POST/PUT/DELETE /school/subjects` in `server/src/routes/school.js`.
- Schema: `school_subjects` in `sql/19_school_core.sql`; `code` does not currently have a declared uniqueness constraint in the inspected schema.
- Risk: a subject may be class-specific in the catalog today, but future teacher/year/section offerings require a separate allocation table.

## Linkage and dependencies

Depends on class eligibility and tenant setup. Feeds Subject Allocation, timetable, exam scheduling/marks, homework, lesson plans/LMS, gradebook, and reports. All downstream references must use `subject_id`, not subject name.

## Implementation sequence

1. Agree code uniqueness scope and whether a subject can be globally available, class-restricted, or both.
2. Add validation and tenant checks for any optional class eligibility.
3. Define archive/restrict behavior for subjects referenced by allocations, marks, homework, and reports.
4. Keep catalog CRUD separate from yearly teaching assignments.
5. Wire the Subjects child path to a screen with class filter, status, edit/archive, and clear duplicate/error states.

## QA cases

- **AC-SUB-01 CRUD:** create, list, update, and archive a school-wide and a class-restricted subject.
- **AC-SUB-02 validation:** reject blank subject names, invalid max marks, malformed code, and unknown/cross-tenant class IDs.
- **AC-SUB-03 uniqueness:** test duplicate codes under the approved uniqueness policy; same code in another tenant must not conflict.
- **AC-SUB-04 eligibility:** class filters and allocation selectors include global subjects plus eligible class subjects, never an ineligible subject.
- **AC-SUB-05 history:** rename or archive a subject referenced by timetable, exam marks, homework, and reports; historical rows still resolve to the same subject ID and display an archived marker.
- **AC-SUB-06 permissions:** view/manage roles and direct API authorization.
- **AC-SUB-07 tenant:** CRUD and joined class labels remain tenant-scoped.
- **AC-SUB-08 UX:** empty list, search/filter, failed request, save followed by refresh failure, repeated submit, and route refresh.

## Linkage tests

Run `AC-LINK-03`, `AC-LINK-05`, and `AC-LINK-07` from the [section plan](README.md).

**Acceptance:** the subject catalog is canonical, duplicate behavior is defined, and every teaching/exam/homework record links to a stable subject ID.
