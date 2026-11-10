# M15 — Examinations & Gradebook

**Package ID:** M15.

**Priority:** Core. **Starting status:** partial/verify.

## Submodules

Exam calendar/schedule; assessment setup; marks entry/import; grading scales; report cards/comments; transcripts; result publication; graduation checks.

## How it must work

Teachers enter only assigned assessments. Marks obey maximum/rubric rules; grades calculate deterministically; published report cards reproduce source marks and authorized comments.

## Dependencies and links

M05 academic setup + M13 timetable + M18 teacher assignments → assessments → M07 profile, M08 portals, M30 reports, M12 promotion.

## Files

- Form candidate: `src/forms/frmSchoolExams/`; menu routes in `src/school/menu.js`.
- Must verify a dedicated frontend route through `SchoolPage`/router.
- Backend candidate: `server/src/routes/school_more.js`.

## QA plan

- Test minimum, maximum, decimal, absent, exempt, and out-of-range marks.
- Verify unauthorized teacher cannot edit an unassigned assessment.
- Check grade-scale boundaries and recalculation after correction.
- Unpublished results remain hidden; published report card totals equal marks.
- Test duplicate import and promotion eligibility reads the same result.

**Acceptance:** assessment, marks, grades, report cards, portal display, and promotion data reconcile.
