# M02 — Settings and Organization

**Package ID:** M02.

**Priority:** Core. **Starting status:** partial/verify.

## Submodules

Institute profile/branding; campuses; academic years/terms; calendar/holidays; roles/permissions; users/access; document types; approval flows; shared options.

## How it must work

Initialize a tenant's school context. Campus/year selections must scope downstream data. Role changes take effect on the next authorized request/session refresh. Invalid dates, duplicate codes, and privilege escalation are rejected.

## Dependencies and links

Settings → all screens and reports. Campus/year → students, classes, attendance, fees, timetable, exams, payroll, and reports. Integrations and account lifecycle also link to M01 and M03.

## Files

- Frontend: `src/components/SchoolSettings.jsx`; `src/forms/frmSchoolSettings/`, `frmSchoolUsers/`, `frmSchoolApprovals/`, `frmSchoolIntegrations/`.
- Backend: `server/src/routes/schoolFoundation.js`, `server/src/school/foundation.js`; verify settings calls in `school.js`.
- Menu/router: `src/school/menu.js`, `src/app.jsx`, `src/components/SchoolPage.jsx`.

## QA plan

- Create/update/deactivate campus, year, and options; verify downstream campus/year filters.
- Reject invalid/overlapping years where policy forbids them and duplicate campus/year identifiers.
- View-only users cannot change settings or roles; removing a permission revokes API access.
- Confirm settings are tenant-scoped and mutation audit contains before/after state.
- Test load/empty/error states and deep links for every Settings child route.

**Acceptance:** a fresh isolated tenant can be configured and every downstream module sees the same active campus/year and permissions.
