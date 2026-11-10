# M06 — Admission & CRM

**Package ID:** M06.

**Priority:** Core. **Starting status:** partial/verify.

## Submodules

Inquiry/lead capture; follow-up/assignment; application and document checklist; review; waitlist/reject; approval; registration/admission fee; re-enrollment.

## How it must work

Inquiry → application → submit → review → approve creates one student, family/guardian link, enrollment, and audit record atomically. Rejection/waitlist require valid states/reasons. Application files are protected. Retries must not duplicate records.

## Dependencies and links

Inquiry/source → applicant/family → M05 class/year → M07 student/enrollment → M11 documents, M17 fees, M26 communication.

## Files

- Frontend: `src/school/students/Admissions.jsx`; `src/forms/frmSchoolAdmission/`.
- Backend: `server/src/routes/school_admissions.js`, `school_students_complete.js`, `school_uploads.js`.
- Shared: `src/components/SchoolPage.jsx`, `src/school/menu.js`, `src/api.js`.

## QA plan

- Full inquiry, application draft/edit/submit, approve/reject/waitlist, and re-enrollment path.
- Duplicate approval/retry creates exactly one student and enrollment.
- Test required/missing/rejected documents, lost reason, invalid state transitions, and permission boundaries.
- Force transaction failure and verify no partial student/family/enrollment.
- Confirm one canonical inquiry/application schema is used by UI, APIs, and reports.

**Acceptance:** a synthetic applicant can be admitted exactly once and all generated records link to the same tenant, family, campus, year, and class.
