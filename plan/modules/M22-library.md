# M22 — Library

**Package ID:** M22.

**Priority:** Conditional service; common capability. **Starting status:** partial/verify.

## Submodules

Catalog/copies; members; issue/return/renewal; reservations; fines; acquisition; reports.

## How it must work

Copy availability, due date, renewal limit, and fine calculation remain consistent across concurrent requests. Lost/damaged and waived items use auditable state transitions.

## Dependencies and links

M07 student/M18 staff identity → circulation → M17 fees, M08 portals, M26 notices, M30 reports.

## Files

- Form candidate: `src/forms/frmSchoolLibrary/`.
- Backend candidate: `server/src/routes/school_comprehensive.js`.
- Confirm per-copy versus title-level stock semantics in schema.

## QA plan

- Concurrently issue the final copy; only one request succeeds.
- Test overdue date/time boundaries, renewal limit, reservation queue, lost/damaged copy.
- Fine waiver requires permission and audit; archive/exit behavior is explicit.
- Reconcile catalog copies, circulation, and fines reports.

**Acceptance:** circulation never oversubscribes copies and all fee/report outputs reconcile.
