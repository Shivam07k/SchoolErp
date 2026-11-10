# Step 8 — Reports, Roles, Notifications, Hardening

**Deliverable:** All reports, income/expenditure, balance sheet, year-end close, Tally export, roles, audit.  
**Exit:** The auditor can trace any figure to its entries.

## Reports

### Fee Collection Reports
| Report | Description | Filters |
|--------|-------------|---------|
| Daily Collection | Cash/cheque/online by mode, cashier, head | Date, Cashier |
| Head-wise Collection | Per fee head, class, category | Date, Class, Head |
| Class-wise Collection | Per class, section, head | Date, Class |
| Cashier-wise Collection | Per cashier, mode, head | Date, Cashier |
| Mode-wise Collection | Cash, Cheque, Online, etc. | Date, Mode |
| Fine & Concession Report | Fines levied/waived, concessions granted | Date, Type |
| Cheque & DD Report | Deposited, cleared, bounced, pending | Date, Status |
| Gateway Settlement | Gross, fee, net, matched/unmatched | Date, Gateway |
| Cancelled Receipts | Cancelled receipts with reasons | Date, Cashier |
| Waivers & Concessions | Approved concessions/waivers | Date, Approver |

### Dues & Follow-up Reports
| Report | Description | Filters |
|--------|-------------|---------|
| Ageing Report | 0-30, 31-60, 61-90, 90+ buckets | Class, Section, Date |
| Defaulters List | Students overdue > X days/amount | Class, Days, Amount |
| Family Dues | Combined dues per family | Family, Status |
| Reminder Log | Sent/failed/delivered/read | Date, Channel |
| Follow-up Log | Calls, promises, outcomes | Date, By, Student |
| Payment Plans | Active/completed/defaulted | Status, Date |

### Refund & Deposit Reports
| Report | Description | Filters |
|--------|-------------|---------|
| Refund Requests | Pending/approved/rejected/paid | Status, Reason |
| Refund Payouts | Paid refunds with mode/ref | Date, Mode |
| Credit Notes | Active/used/expired | Status, Student |
| Deposits | Received/returned/forfeited | Status, Head |

### Reconciliation Reports
| Report | Description | Filters |
|--------|-------------|---------|
| Cashier Day Close | Expected vs actual, exceptions | Date, Cashier |
| Cheque Status | Deposited/Cleared/Bounced | Date, Bank |
| Gateway Settlement | Gross, fee, net, matched | Date, Gateway |
| Bank Reconciliation | Matched/Unmatched/Exceptions | Date, Account |
| Exception List | All exceptions by type | Type, Status |

### Accounts Reports
| Report | Description | Filters |
|--------|-------------|---------|
| Day Book | All vouchers by date | Date, Type |
| Cash Book | Cash receipts/payments | Date |
| Bank Book | Bank receipts/payments | Date, Account |
| Account Ledger | All entries for one account | Date, Account |
| Trial Balance | Debits = Credits | Date/Period |
| Income & Expenditure | Income vs Expenses | Period |
| Balance Sheet | Assets = Liabilities + Equity | Date |
| Vendor Payables | Bills pending/paid | Vendor, Date |
| Tally Export | Day book / ledger export | Date Range |

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/fee/reports/daily-collection` | Daily collection |
| GET | `/school/fee/reports/head-wise` | Head-wise |
| GET | `/school/fee/reports/class-wise` | Class-wise |
| GET | `/school/fee/reports/cashier-wise` | Cashier-wise |
| GET | `/school/fee/reports/mode-wise` | Mode-wise |
| GET | `/school/fee/reports/fine-concession` | Fine & concession |
| GET | `/school/fee/reports/cheques` | Cheque report |
| GET | `/school/fee/reports/gateway-settlement` | Gateway settlement |
| GET | `/school/fee/reports/cancelled-receipts` | Cancelled receipts |
| GET | `/school/fee/reports/ageing` | Ageing report |
| GET | `/school/fee/reports/defaulters` | Defaulters |
| GET | `/school/fee/reports/family-dues` | Family dues |
| GET | `/school/fee/reports/reminder-log` | Reminder log |
| GET | `/school/fee/reports/follow-up-log` | Follow-up log |
| GET | `/school/fee/reports/payment-plans` | Payment plans |
| GET | `/school/fee/reports/refunds` | Refund requests |
| GET | `/school/fee/reports/credit-notes` | Credit notes |
| GET | `/school/fee/reports/deposits` | Deposits |
| GET | `/school/fee/reports/cashier-close` | Cashier close |
| GET | `/school/fee/reports/cheques` | Cheque status |
| GET | `/school/fee/reports/gateway-settlement` | Gateway settlement |
| GET | `/school/fee/reports/bank-reconciliation` | Bank reconciliation |
| GET | `/school/fee/reports/exceptions` | Exceptions list |
| GET | `/school/accounts/reports/day-book` | Day book |
| GET | `/school/accounts/reports/cash-book` | Cash book |
| GET | `/school/accounts/reports/bank-book` | Bank book |
| GET | `/school/accounts/reports/ledger/:accountId` | Account ledger |
| GET | `/school/accounts/reports/trial-balance` | Trial balance |
| GET | `/school/accounts/reports/income-expenditure` | Income & Expenditure |
| GET | `/school/accounts/reports/balance-sheet` | Balance sheet |
| GET | `/school/accounts/reports/vendor-payables` | Vendor payables |
| GET | `/school/accounts/reports/tally-export` | Tally export |
| POST | `/school/accounts/periods/:id/close` | Close period |
| POST | `/school/accounts/financial-years/:id/close` | Close year |

## Frontend (src/pages/school/fee/reports/ and src/pages/school/accounts/reports/)

| Route | Component |
|-------|-----------|
| `/school/fee/reports` | `FeeReportsDashboard.jsx` |
| `/school/fee/reports/collection` | `CollectionReports.jsx` |
| `/school/fee/reports/dues` | `DuesReports.jsx` |
| `/school/fee/reports/refunds` | `RefundReports.jsx` |
| `/school/fee/reports/reconciliation` | `ReconciliationReports.jsx` |
| `/school/accounts/reports` | `AccountsReportsDashboard.jsx` |
| `/school/accounts/reports/day-book` | `DayBookReport.jsx` |
| `/school/accounts/reports/trial-balance` | `TrialBalanceReport.jsx` |
| `/school/accounts/reports/income-expenditure` | `IncomeExpenditureReport.jsx` |
| `/school/accounts/reports/balance-sheet` | `BalanceSheetReport.jsx` |
| `/school/accounts/reports/tally-export` | `TallyExport.jsx` |

### Report Components Features
- Filters sidebar (date, class, head, mode, cashier, etc.)
- Preview table with pagination
- Export: CSV, PDF, Excel
- Print-friendly layout
- Drill-down: click row → detail view

## Notifications

### Event → Notification Mapping
| Event | Recipient | Channel | Template |
|-------|-----------|---------|----------|
| Invoice generated | Parent | SMS/Email/App | FEE_INVOICE_GENERATED |
| Payment due (before due) | Parent | SMS/WhatsApp/Email | FEE_DUE_REMINDER |
| Payment overdue | Parent | SMS/WhatsApp/Email | FEE_OVERDUE_NOTICE |
| Payment received | Parent | SMS/Email/App | FEE_RECEIPT_GENERATED |
| Payment failed | Parent | SMS/Email | FEE_PAYMENT_FAILED |
| Cheque bounced | Parent | SMS/Email | CHEQUE_BOUNCED |
| Refund requested | Parent/Accounts | Email/App | REFUND_REQUESTED |
| Refund approved | Parent | SMS/Email | REFUND_APPROVED |
| Refund paid | Parent | SMS/Email | REFUND_PAID |
| Credit note issued | Parent | Email/App | CREDIT_NOTE_ISSUED |
| Deposit returned | Parent | SMS/Email | DEPOSIT_RETURNED |
| Defaulter block applied | Parent | SMS/Email | DEFAULTER_BLOCK_APPLIED |
| Payment plan created | Parent | SMS/Email | PAYMENT_PLAN_CREATED |
| Promise date reminder | Staff | App/Email | PROMISE_DATE_REMINDER |
| Cashier day not closed | Cashier/Accounts | Email/App | CASHIER_DAY_OPEN |
| Reconciliation exception | Accountant | Email/App | RECONCILIATION_EXCEPTION |
| Gateway settlement mismatch | Accountant | Email/App | GATEWAY_SETTLEMENT_MISMATCH |
| Bank statement exception | Accountant | Email/App | BANK_EXCEPTION |

### Notification Engine
- Queue: `school_notification_queue` (idempotent, retries)
- Channels: SMS (Twilio), WhatsApp (Gupshup), Email (SendGrid), App (FCM)
- Templates: Handlebars with placeholders
- Retry: exponential backoff, max 3
- Dedupe: idempotency key (event_type + student_id + date)

## Roles & Permissions

| Role | Permissions |
|------|-------------|
| Super Admin | All setup, policies, period close, user management |
| Principal | Approve concessions/refunds/waivers above limits, view all reports |
| Accounts Head | Approve vouchers/refunds, reconcile, close periods, all accounts reports |
| Accountant | Vouchers, expenses, vendor payments, accounts reports |
| Fee Clerk / Cashier | Collect, cancel own receipt, close own day, collection reports |
| Fee Coordinator | Generate invoices, manage dues, reminders, refunds, fee reports |
| Auditor | Read-only all reports, exports, audit log |
| Parent | View dues, pay online, download receipts/statements |

### Permission Keys
```
fee.setup, fee.collect, fee.cancel, fee.invoice.generate,
fee.refund.approve, fee.refund.pay, fee.concession.approve,
fee.reminders.send, fee.block.manage, fee.followup.log,
fee.reconciliation.view, fee.reconciliation.resolve,
fee.reports.view, fee.reports.export,
accounts.chart.view, accounts.chart.manage,
accounts.voucher.create, accounts.voucher.post, accounts.voucher.cancel,
accounts.period.close, accounts.year.close,
accounts.reports.view, accounts.tally.export,
vendor.bill.create, vendor.bill.approve, vendor.bill.pay
```

## Hardening

### Data Integrity
- All money tables: `deleted_at` (soft delete), no hard delete
- Receipt/invoice numbers: atomic sequence per series/year
- Voucher balance check: `sum(debit) = sum(credit)` enforced at DB + app
- Ledger: immutable, only reversals allowed
- Period lock: no vouchers in closed period
- Year close: carries forward balances, locks all periods

### Security
- API: JWT + permission check on every endpoint
- Gateway secrets: encrypted at rest (AES-256)
- Webhook signatures verified
- SQL injection: parameterized queries only
- Rate limiting: login, webhook, API
- Audit log: every money change (insert/update/delete/reverse/approve)

### Reliability
- Webhook idempotency: `gateway_event_id` unique
- Payment idempotency: `gateway_order_id` unique
- Receipt number: atomic sequence
- Webhook retries: exponential backoff, max 3
- Status check job: resolves pending online payments
- Bank statement deduplication: `import_hash`

### Audit & Compliance
- `school_audit_log`: every money change (table, record, action, old, new, user, time, reason)
- No hard delete on money tables
- Period/year close: audit trail preserved
- Tally export: includes voucher numbers, dates, accounts

### Performance
- Indexes on: student_id+date, invoice_id, receipt_id, date+status, account_id+date
- Pagination: default 50, max 200
- Materialized views: trial balance, ageing (refreshed hourly)
- Partitioning: ledger entries by year (optional)

### Backup & Recovery
- Daily DB backup
- Point-in-time recovery (WAL)
- Migration rollback scripts
- Opening balance migration script

## Acceptance
- All reports: preview + CSV/PDF/Excel export
- Tally export: imports cleanly, voucher numbers match
- Period close: no new vouchers, reopen needs permission
- Year close: carries balances, locks all periods
- Audit log: every money change traceable
- Performance: reports < 3s, collections < 1s
- Auditor can trace any figure to ledger entry