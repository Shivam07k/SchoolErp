# M16 — Fees & Accounts

**Package ID:** M16.

**Priority:** Core. **Starting status:** planning.

**Detailed plan:** [Fees & Accounts module roadmap](../fees and accounts/README.md), including submodule plans, current audit gaps, policy decisions, workflow diagrams, and research references.

## Submodules

Fee Setup, Invoices & Collection, Dues & Follow-up, Refunds, Reconciliation, Accounts Core, Online Payments, Reports & Hardening.

## How it must work

Serve a parent at the counter in under a minute. Every rupee has a trail. No receipt or entry is edited or deleted; it is only reversed. Fee rules (heads, concessions, fines, installments) are configured, not coded. Fee events post to the accounts automatically. Collections are matched against the cashier, the gateway and the bank. Every common scenario is covered without making the module complex.

## Dependencies and links

M07 students/enrollment → student assignment, family, ledger  
M14 attendance → eligibility blocks (hall ticket, report card)  
M15 examinations → fee blocks (hall ticket, report card)  
M18 HR/payroll → payroll vouchers, vendor payments  
M26 communication → notifications (reminders, receipts, refunds)  
M30 reports/dashboard → analytics  
M32 import/export → data migration, Tally export

## Existing files and API baseline

- Frontend: (none yet — to be created in `src/pages/school/fee/`)
- Backend: (none yet — to be created in `server/src/routes/school_fee.js`)
- Schema: (none yet — migrations `sql/50-57_fee_*.sql`)
- Shared: `src/api.js`, `server/src/school/foundation.js`, student enrollment, timetable, attendance, examination modules

## QA plan

- Counter collection: full, partial, advance, siblings, multiple modes, concessions, concessions after payment
- Invoice: bulk generation, mid-year admission, structure change, pro-rata, one-time fees
- Ledger: balance = sum of entries, no edit/delete, only reversals, audit trail complete
- Receipt: atomic number, atomic allocation, cancellation by reversal, day close/lock
- Online: webhook status, settlement import, duplicate detection, pending/failed handling
- Reconciliation: cashier close, cheque clear/bounce, gateway settlement, bank import, exceptions
- Refund: calculation, approval chain, payout, credit note, deposit return
- Accounts: voucher balance, auto-post from fee/receipt/refund, day book, trial balance, period lock
- Reconciliation: cashier close, cheque clear/bounce, gateway settlement, bank import, exceptions
- Refund: calculation, approval chain, payout, credit note, deposit return
- Accounts: voucher balance, auto-post from fee/receipt/refund, day book, trial balance, period lock
- Reconciliation: cashier close, cheque clear/bounce, gateway settlement, bank import, exceptions
- Refund: calculation, approval chain, payout, credit note, deposit return
- Accounts: voucher balance, auto-post from fee/receipt/refund, day book, trial balance, period lock
- Reconciliation: cashier close, cheque clear/bounce, gateway settlement, bank import, exceptions

## Acceptance

A counter collection takes under a minute. Every rupee traceable to a ledger entry; no edit/delete, only reversals. Rules configured once, not hard-coded; any board pattern supported. Fee events auto-post to Accounts; books always agree. Collections reconciled against cashier, gateway, bank; only exceptions remain. All common scenarios covered without complexity.