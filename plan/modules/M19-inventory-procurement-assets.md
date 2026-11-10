# M19 — Inventory, Procurement & Assets

**Package ID:** M19.

**Priority:** Conditional by school operations. **Starting status:** partial/verify.

## Submodules

Catalog/categories; vendors; purchase requests/orders; receiving; stock ledger; issue/return; fixed assets; depreciation/maintenance.

## How it must work

Every quantity change has a source transaction. Purchase and issue changes are atomic; stock cannot go negative unless a documented policy explicitly permits it.

## Dependencies and links

Departments/canteen/facilities → requisition/purchase → M23 food service/M24 facilities/assets → M17 finance and M30 reports.

## Files

- Form candidate: `src/forms/frmSchoolInventory/`.
- Backend candidate: `server/src/routes/school_comprehensive.js`.
- Verify each inventory menu child has an actual screen and endpoint.

## QA plan

- Concurrent issue of final unit; reject or serialize safely.
- Test rejected receipt, duplicate order, returns, adjustments, and asset retirement.
- Reconcile stock ledger, valuation, purchase order, and finance costs.
- Verify audit and tenant ownership for vendor/item IDs.

**Acceptance:** inventory quantities and asset values can be reconstructed from audited transactions.
