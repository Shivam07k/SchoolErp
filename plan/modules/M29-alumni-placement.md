# M29 — Alumni & Placement

**Package ID:** M29.

**Priority:** Later/Conditional. **Starting status:** route completeness unverified.

## Submodules

Graduate transition; directory; consent/preferences; alumni events; mentoring/jobs/placement; donations.

## How it must work

Only eligible graduates transition. Alumni manage permitted profile fields. Donations/jobs respect consent, moderation, and financial controls. Alumni accounts cannot access active-student records.

## Dependencies and links

M12 graduation/exit → alumni identity → M27 events, M26 communication, placement, M17 donations/accounting, M30 reports.

## Files

- Form candidate: `src/forms/frmSchoolAlumni/`.
- Backend candidate: `server/src/routes/school_comprehensive.js`; verify dedicated routes.
- Proposed UI/API files if absent: `src/pages/school/alumni/`, `server/src/routes/school_alumni.js`.

## QA plan

- Non-graduate blocked; repeated transition creates no duplicate alumni record.
- Consent withdrawal removes profile from directory and messages.
- Job posting moderation and donation reconciliation.
- Alumni cannot read active-student details by direct API.

**Acceptance:** graduate transition is idempotent, consent-aware, and isolated from active student access.
