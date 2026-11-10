# Academics 6 - Homework

**Menu path:** `/school/academics/homework`  
**Priority:** Core teaching workflow.  
**Starting status:** schema and partial submission/grading APIs exist; a complete teacher-facing assignment lifecycle and dedicated Academic child screen were not identified.

## Goal and behavior

Teachers create a draft assignment for a valid academic year, class/section, and allocated subject; add title, instructions, assigned/due dates, attachment, marks/rubric, and visibility. Publishing exposes it only to eligible active students. Student submissions are attached to the homework and student, use protected upload rules, and obey resubmission/late policies. Teachers can review, grade, return, and close work; authorized students/guardians see only their own published work and feedback.

Draft, published, closed, and archived states must be explicit. Deleting a homework item with submissions must not cascade away evidence or grades. Duplicate submissions and repeated requests must follow an explicit idempotency/revision policy.

## Current inventory

- Schema: `school_homework` and `school_homework_submissions` in `sql/23_school_full.sql`.
- Routes found in `server/src/routes/school_more.js`: `GET /school/homework/:id/submissions`, `POST /school/homework/:id/submit`, and `POST /school/homework/submissions/:id/grade`.
- A homework list/create/update/publish API was not identified. Existing `GET/POST /school/lesson-plans` is a distinct workflow and does not replace homework assignment CRUD.
- Planned screen: `src/pages/school/academics/Homework.jsx`; connect or reuse LMS assignment/submission components only after field ownership and authorization are agreed.
- Current schema/routes need review for explicit foreign keys, tenant-safe parent joins, unique submission/revision policy, grade bounds, and permission separation between teacher/student.

## Linkage and dependencies

Depends on Classes & Sections, Academic Years, Subjects, Subject Allocation, student enrollment, staff identity, and protected attachments. Connects to LMS/student/guardian portal views and authorized grade/report outputs. Do not imply homework marks are exam marks unless a separate, explicit gradebook mapping is implemented.

## Implementation sequence

1. Specify author, audience, draft/publish/close lifecycle, student revision policy, late policy, grading scale, and attachment limits.
2. Add teacher-facing list/create/edit/publish/archive endpoints with permission and allocation checks.
3. Derive eligible students from tenant/year/class/section enrollments; do not trust client-supplied student IDs.
4. Add protected student submission and teacher grading flows with audit, idempotency, and grade validation.
5. Wire student/guardian/LMS read views to the same published assignment and submission records.

## QA cases

- **AC-HW-01 lifecycle:** create draft, edit, preview, publish, close, and archive; confirm each status transition and who can perform it.
- **AC-HW-02 validation:** reject missing title, invalid year/class/section/subject allocation, invalid date range, out-of-range marks, and unsupported/oversized attachment.
- **AC-HW-03 audience:** only active students enrolled in the exact tenant/year/class/section can view and submit; withdrawn, promoted, or cross-tenant students cannot.
- **AC-HW-04 submission:** submit text and protected attachment; test before due, late, duplicate request, allowed resubmission, and closed assignment.
- **AC-HW-05 grading:** teacher grades only assigned work, validates score bounds, records feedback/graded-by/time, and updates the same submission visible to the authorized student.
- **AC-HW-06 privacy:** student/guardian sees only own work; teacher sees only authorized assigned classes; unpublished drafts and peer submissions are hidden.
- **AC-HW-07 deletion/history:** archive homework with submissions; verify submissions and grades remain queryable and reports retain historical values.
- **AC-HW-08 authorization/tenant:** test view/manage/student roles, direct API bypass, all referenced IDs, and wrong-tenant IDs.
- **AC-HW-09 reliability:** concurrent submit/grade, network retry, upload failure, committed-write refresh failure, audit event, and transaction rollback.
- **AC-HW-10 reports:** published/late/submitted/missing/graded counts reconcile to assignment and enrollment source rows.

## Linkage tests

Run `AC-LINK-05`, `AC-LINK-06`, `AC-LINK-07`, and `AC-LINK-08` from the [section plan](README.md).

**Acceptance:** homework assignment, student submission, teacher grading, and student-facing result are one permission-checked, year-scoped workflow with preserved history.
