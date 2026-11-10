# M32 — Import & Export

**Package ID:** M32.

**Priority:** Core data operations. **Starting status:** unverified/incomplete.

## Submodules

Schema/template download; upload; column mapping; validation preview; dry run; commit/rollback; export.

## How it must work

Preview identifies row errors before commit. Import is atomic or explicitly row-transactional. Duplicates follow documented policy. Export honors tenant, role, campus/year, and sensitive-data scope.

## Dependencies and links

External data ↔ explicitly supported M06/M07/M14/M17 entities; import result → audit and M30 reports.

## Files

- Form candidate: `src/forms/frmSchoolImport/`; dedicated route screen must be verified.
- Backend/import API coverage is unverified; proposed module API should be registered in `server/src/index.js`.
- Reuse authenticated upload and file validation services; do not create an unprotected upload path.

## QA plan

- Malformed/oversized file, invalid encoding/date, duplicate rows, missing references, cross-tenant IDs.
- Dry-run does not mutate data; commit and rollback behavior is verified.
- Repeated upload follows idempotency/duplicate policy.
- Export PII/role filtering; reconcile imported/exported row counts and error report.

**Acceptance:** users can preview, commit, explain errors, safely retry, and export only authorized data.
