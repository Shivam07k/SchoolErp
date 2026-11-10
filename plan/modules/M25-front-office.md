# M25 — Front Office

**Package ID:** M25.

**Priority:** Core. **Starting status:** partial/verify.

## Submodules

Enquiry; visitor check-in/out; appointments; call log; complaints/helpdesk; gate pass; reception dashboard.

## How it must work

Visitors are checked in/out with an authorized host. Complaints have owner, status, due date, and closure. Student lookup and gate-pass actions honor tenant and relationship scope.

## Dependencies and links

M06 admissions, M07 student/family, M10 safety, M27 events, M26 communication.

## Files

- Form candidate: `src/forms/frmSchoolFrontOffice/`.
- Backend candidates: `server/src/routes/school_comprehensive.js`, `school_more.js`, `school_admissions.js`.
- Verify each child route has a dedicated workflow.

## QA plan

- Duplicate/open visitor, invalid student/host, lost badge, early check-out.
- Complaint escalation and closure audit.
- Gate pass checks pickup permission; unauthorized guardian is denied.
- Verify privacy, campus scope, and visitor report.

**Acceptance:** reception, visitor, complaint, and pickup records reconcile with student and safety records.
