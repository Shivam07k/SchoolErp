# M12 — Promotion, Transfer & Exit

**Package ID:** M12.

**Priority:** Core. **Starting status:** workflows implemented in part; end-to-end status must be proven.

## Submodules

Promotion run/preview; eligibility rules; promoted/detained decisions; next-year enrollment; exit request; departmental/fee clearance; transfer certificate; close/re-admit.

## How it must work

Preview lists the exact eligible population. Execute is transactional and idempotent. TC issuance is blocked by required clearances; issue closes active enrollment and preserves prior history.

## Dependencies and links

M14 attendance/M15 exams/M17 fees → promotion eligibility. M07 student + M17 balances + department clearances → TC/document/certificate → M29 alumni eligibility.

## Files

- Frontend: `src/pages/school/students/Promotion.jsx`, `TransferExit.jsx`.
- Backend: `server/src/routes/school_students_complete.js`; TC certificate integration in `school_comprehensive.js`.
- Data: promotion and exit/clearance migrations under `sql/`.

## QA plan

- Eligibility boundaries and mixed promoted/detained groups.
- Double execution/retry must not create duplicate enrollments or TCs.
- Block TC with outstanding balances or pending required clearances; allow after completion.
- Concurrent TC issue maintains unique numbering; verify close/re-admission state and preserved history.

**Acceptance:** promotion and exit paths are repeatable, history-safe, and consistent with fees, attendance, and certificates.
