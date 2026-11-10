# M23 — Canteen / Food Service

**Package ID:** M23.

**Priority:** Conditional by school. **Starting status:** dedicated API/workflow unverified.

## Submodules

Menus/dietary data; orders/POS; meal accounts/wallets; limits/subsidies; sales/refunds; stock; nutrition/allergen controls.

## How it must work

Order charge, wallet balance, and stock movement commit together. Allergen/dietary restrictions are available only to authorized staff. Refund reverses the original posting.

## Dependencies and links

M07 student/family → wallet/order → M19 inventory, M17 ledger, M09 dietary support, M30 reporting.

## Files

- Form candidate: `src/forms/frmSchoolCanteen/`.
- Dedicated frontend/backend must be verified; backend candidate is `server/src/routes/school_comprehensive.js`.
- Proposed module files if missing: `src/pages/school/canteen/` and `server/src/routes/school_canteen.js`.

## QA plan

- Duplicate order/payment callback; insufficient funds and daily limits.
- Allergen warning and restricted dietary information.
- Reject unavailable stock; test refund rollback across wallet/stock/ledger.
- Reconcile meal sales, stock, family balance, and reports.

**Acceptance:** a canteen transaction is atomic, duplicate-safe, and safe for dietary restrictions.
