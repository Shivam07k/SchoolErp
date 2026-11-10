# M17 — Fees & Accounting

**Package ID:** M17.

**Priority:** student fees are Core; full accounting depth is Conditional by school scope and jurisdiction. **Starting status:** partial/verify.

## Submodules

Fee heads/plans; invoices; scholarships/discounts; online/offline payments; receipts; refunds/adjustments; dues/reminders; accounts payable/receivable; general ledger/journals; budgets; bank reconciliation.

## How it must work

Invoice, payment, refund, and ledger posting are transactional. Balances derive from transactions; payment retry cannot double-post. Policy-driven dues feed promotion/exit no-dues checks.

## Dependencies and links

M07 student/family → fees/payment → ledger, M04 dashboard, M26/M31 reminders. Fees → M12 promotion/TC and optional M20–M23 service charges.

## Files

- Frontend: `src/components/SchoolPage.jsx`, `src/forms/frmSchoolFees/`.
- Backend: `server/src/routes/school.js`, related finance endpoints in `school_more.js`/`school_comprehensive.js`.
- Accounting scope and local tax/payment rules must be agreed before schema work.

## QA plan

- Full/partial payment, overpayment, concurrent payment, duplicate gateway callback, refund, and failed transaction rollback.
- Reconcile invoice balance to payments/refunds and ledger entries.
- Verify receipt print, campus/year scoping, role visibility, and no-dues blocking.
- Test payment retry/idempotency and audit.

**Acceptance:** every financial balance is explainable from transactions and no retry can duplicate a charge.
