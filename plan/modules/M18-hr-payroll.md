# M18 — HR & Payroll

**Package ID:** M18.

**Priority:** workforce records are Core; payroll rules depend on local law. **Starting status:** partial/verify.

## Submodules

Staff master; contracts/roles; leave; attendance; payroll components; pay runs; advances/deductions; payslips/reports.

## How it must work

Staff roles govern teaching, approvals, and portal access. Payroll uses approved inputs, posts once, and is visible only to authorized users.

## Dependencies and links

Staff → M05 teaching assignments, M13 timetable, M14 staff attendance, M16 LMS, M02 approvals. Leave/attendance → payroll → M17 ledger.

## Files

- Form candidates: `src/forms/frmSchoolHR/`, `frmSchoolUsers/`.
- Backend candidates: `server/src/routes/school_comprehensive.js`, `school_more.js`, `schoolFoundation.js`.
- Verify HR/leave route permissions against the server permission catalogue.

## QA plan

- Salary fields hidden from unprivileged roles; terminated staff lose access.
- Leave balance and payroll calculation boundaries; approved versus pending inputs.
- Duplicate pay-run prevention, correction/reversal, and payslip-to-ledger reconciliation.
- Test leave permission key and direct API authorization.

**Acceptance:** staff lifecycle and payroll are permission-safe, reproducible, and financially reconciled.
