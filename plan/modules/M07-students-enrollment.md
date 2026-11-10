# M07 — Students & Enrollment

**Package ID:** M07.

**Priority:** Core. **Starting status:** partial/most developed.

## Submodules

Student master; search/filter; profile; guardians/family; siblings; enrollment history; status/archive; authorized pickup; profile documents; audit.

## How it must work

Create/read/update/archive while preserving historical years. Admission numbers are unique per tenant. Current enrollment matches current class/section/roll; prior-year enrollment remains unchanged. Profile views show authorized linked records.

## Dependencies and links

M06 admissions → student; student ↔ family, M05 academics, M14 attendance, M17 fees, M13 timetable, M15 exams, M16 LMS, M08 portals, M09 support, M20 transport, M21 hostel, M22 library.

## Files

- Frontend: `src/components/SchoolPage.jsx`, `src/components/StudentProfile.jsx`; `src/forms/frmSchoolStudents/`, `frmSchoolGuardians/`.
- Backend: student/guardian/document routes in `server/src/routes/school.js`; enrollment/promotion/exit in `school_students_complete.js`.
- Shared: `src/api.js`, `server/src/school/foundation.js`.

## QA plan

- Create/read/update/archive; duplicate admission number; filtering/search and profile refresh.
- Change class/section and verify current enrollment only; preserve previous-year enrollment.
- Guardian link/edit/unlink, sibling scope, and pickup authorization.
- Archived students leave active lists but remain in allowed historical reports.
- Test profile print, role restrictions, cross-tenant ID tampering, and mutation audit.

**Acceptance:** student master and all dependent modules agree on one current identity and preserve historical links.
