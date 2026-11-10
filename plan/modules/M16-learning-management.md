# M16 — Learning Management

**Package ID:** M16.

**Priority:** Core capability; advanced LMS scope may vary. **Starting status:** partial/verify.

## Submodules

Courses/materials; assignments/homework; quizzes; submissions/attachments; grading/feedback; progress.

## How it must work

Teachers assign work to authorized classes. Students submit under configured due/late policy. Staff review updates grade/progress, and feedback visibility follows role policy.

## Dependencies and links

M05 class/course + M07 student + M18 teacher → M13 timetable, M15 gradebook, M08 portals, M26 communication, M30 reporting.

## Files

- Form candidate: `src/forms/frmSchoolLMS/`; menu in `src/school/menu.js`.
- Backend candidates: `server/src/routes/school_more.js`, `school_comprehensive.js`.
- Verify that each LMS child route dispatches to an actual screen.

## QA plan

- Class membership and teacher ownership; due/late boundary.
- Secure attachment upload/download; reject cross-tenant file IDs.
- Test duplicate submission, allowed resubmission, grade sync, and feedback privacy.
- Student and teacher see only their own/assigned courses and work.

**Acceptance:** assignment lifecycle and grade/progress links match authoritative class/student records.
