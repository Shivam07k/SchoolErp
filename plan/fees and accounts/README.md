# Fees and Accounts Module Plan

**Package:** M16 — Fees & Accounts  
**Priority:** Core  
**Status:** Planning → Execution  

This folder turns the supplied Fees & Accounts design document into an implementation roadmap grounded in the current ERP.

## Plan documents

- [Setup: Fee Heads, Categories, Structures, Installments, Rules](01-fee-setup.md)
- [Invoices & Collection: Generation, Counter, Receipts, Ledger](02-invoices-collection.md)
- [Dues & Follow-up: Dashboard, Ageing, Reminders, Follow-up](03-dues-followup.md)
- [Refunds: Requests, Rules, Approvals, Payouts, Credit Notes](04-refunds.md)
- [Reconciliation: Cashier Day-end, Cheques, Gateway, Bank](05-reconciliation.md)
- [Accounts Core: Chart of Accounts, Auto-posting, Vouchers, Reports](06-accounts-core.md)
- [Online Payments: Gateway, Parent Portal, Webhooks, Settlement](07-online-payments.md)
- [Reports, Roles, Notifications, Hardening](08-reports-hardening.md)
- [Current gaps and decisions](REMAINING.md)

## Goals and boundaries

- Serve a parent at the counter in under a minute.
- Every rupee has a trail. No receipt or entry is edited or deleted; it is only reversed.
- Fee rules (heads, concessions, fines, installments) are configured, not coded.
- Fee events post to the accounts automatically.
- Collections are matched against the cashier, the gateway and the bank.
- Every common scenario is covered without making the module complex.
- **Not in the first release:** budgets, fixed assets and depreciation, purchase orders, multi-branch consolidation.

## Core tables (from design §6)

| Area | Tables |
|------|--------|
| Fee setup | `school_fee_head`, `school_fee_category`, `school_fee_structure`, `school_fee_structure_line`, `school_installment`, `school_fine_rule`, `school_concession_type`, `school_student_fee_assignment`, `school_family` |
| Invoices & Collection | `school_invoice`, `school_invoice_line`, `school_receipt`, `school_receipt_allocation`, `school_cheque`, `school_online_payment`, `school_cashier_day` |
| Ledger | `school_ledger_entry` |
| Dues & Refunds | `school_reminder_rule`, `school_reminder_log`, `school_follow_up`, `school_payment_plan`, `school_refund_request`, `school_credit_note`, `school_deposit` |
| Reconciliation | `school_bank_statement_line`, `school_gateway_settlement`, `school_match_exception` |
| Accounts | `school_account`, `school_account_group`, `school_voucher`, `school_voucher_line`, `school_financial_year`, `school_period`, `school_vendor`, `school_vendor_bill`, `school_audit_log` |

## Build order (from design §12)

| Step | Deliverable | Exit criteria |
|------|-------------|---------------|
| 1 | Fee Setup: Heads, categories, structures, installments, fine/concession rules, student assignment, opening balances | A sample student shows the correct fees |
| 2 | Invoices & Collection: Invoice generation, counter collection, receipts, ledger, family view, cancellation by reversal, cashier day close | A counter collection takes under a minute |
| 3 | Dues & Follow-up: Dashboard, ageing, defaulters, reminders, follow-up, payment plans, block policies | Overdue parents are reminded automatically |
| 4 | Accounts Core: Chart of accounts, auto-posting, vouchers, day book, cash/bank books, ledger, trial balance, period lock | Every receipt posts and the trial balance tallies |
| 5 | Online Payments: Gateway, parent portal, webhooks, status check, settlement import | Online payments create exactly one receipt |
| 6 | Reconciliation: Cheque tracking, gateway and bank matching, exceptions | Only real exceptions are left to review |
| 7 | Refunds: Requests, rules, approvals, payouts, credit notes, deposit return | No refund without approval and an audit entry |
| 8 | Reports & Hardening: All reports, income/expenditure, balance sheet, year-end close, Tally export, roles, audit | The auditor can trace any figure to its entries |
| 9 | Later (optional): Budgets, fixed assets, purchase orders, cost centres, multi-branch consolidation, bank feeds | Added only when needed |

## Dependencies and links

- M07 students/enrollment → student assignment, family, ledger
- M14 attendance → eligibility blocks (hall ticket, report card)
- M15 examinations → fee blocks (hall ticket, report card)
- M18 HR/payroll → payroll vouchers, vendor payments
- M26 communication → notifications (reminders, receipts, refunds)
- M30 reports/dashboard → analytics
- M32 import/export → data migration, Tally export

## QA plan

- Counter collection: full, partial, advance, siblings, multiple modes, concessions, concessions after payment
- Invoice: bulk generation, mid-year admission, structure change, pro-rata, one-time fees
- Ledger: balance = sum of entries, no edit/delete, only reversals, audit trail complete
- Receipt: atomic number, atomic allocation, cancellation by reversal, day close/lock
- Online: webhook status, settlement import, duplicate detection, pending/failed handling
- Reconciliation: cashier close, cheque clear/bounce, gateway settlement, bank import, exceptions
- Refund: calculation, approval chain, payout, credit note, deposit return
- Accounts: voucher balance, auto-post from fee/receipt/refund, day book, trial balance, period lock
- Reconciliation: cashier close, cheque clear/bounce, gateway settlement, bank import, exceptions only

## Acceptance criteria

- A counter collection takes under a minute.
- Every rupee traceable to a ledger entry; no edit/delete, only reversals.
- Fee rules configured once, not hard-coded; any board pattern supported.
- Fee events auto-post to Accounts; books always agree.
- Collections reconciled against cashier, gateway, bank; only exceptions remain.
- All common scenarios covered without complexity.