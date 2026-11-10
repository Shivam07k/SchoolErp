# M30 — Reports & Analytics

**Package ID:** M30.

**Priority:** Core. **Starting status:** incomplete/placeholder screens exist.

## Submodules

Operational reports; academic/student reports; attendance/fees/finance; exports; dashboards; custom report definitions.

## How it must work

Every report documents source, calculation, filters, and permission. Totals reconcile to source records. Export uses the same role/campus/year scope as on-screen results.

## Dependencies and links

Read-only governed views over M04–M29. Reports must never become a second source of truth and must redact M09/M10 protected data.

## Files

- Form candidate: `src/forms/frmSchoolReports/`; current report UI requires dedicated-screen verification.
- Backend sources: `server/src/routes/school.js`, `school_more.js`, `school_comprehensive.js`, foundation routes.
- Shared: `src/api.js`, `src/formRegistry.js`, `src/components/FormPage.jsx`.

## QA plan

- Reconcile independent fixtures for each report's totals.
- Test campus/year/date/role filters, pagination, empty and large datasets.
- Verify CSV/print matches screen and excludes restricted fields.
- Cross-tenant IDs and crafted filters must not widen scope.

**Acceptance:** every report has a named source, reproducible calculation, access policy, and passing reconciliation test.
