# Step 6 — Accounts Core

**Deliverable:** Chart of accounts, auto-posting, vouchers, day book, cash/bank books, ledger, trial balance, period lock.  
**Exit:** Every receipt posts and the trial balance tallies.

## Database

### Migration
- `sql/55_accounts_core.sql`

### Tables

```sql
-- Account Groups
CREATE TABLE school_account_group (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL, -- e.g., Assets, Liabilities, Income, Expenses
  parent_id         INT REFERENCES school_account_group(id),
  type              TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  is_cash_or_bank   BOOLEAN DEFAULT false,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Chart of Accounts
CREATE TABLE school_account (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  code              TEXT NOT NULL, -- e.g., 1100, 2100, 4100
  name              TEXT NOT NULL,
  group_id          INT REFERENCES school_account_group(id),
  type              TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  is_cash_or_bank   BOOLEAN DEFAULT false,
  is_control        BOOLEAN DEFAULT false, -- e.g., Fees Receivable control account
  opening_balance   NUMERIC(15,2) DEFAULT 0, -- at financial year start
  current_balance   NUMERIC(15,2) DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_account_code ON school_account(app_id, code) WHERE deleted_at IS NULL;
CREATE INDEX idx_account_group ON school_account(group_id);

-- Financial Year
CREATE TABLE school_financial_year (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL, -- e.g., "2026-27"
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  is_closed         BOOLEAN DEFAULT false,
  closed_at         TIMESTAMPTZ,
  closed_by         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_financial_year ON school_financial_year(app_id, name) WHERE deleted_at IS NULL;

-- Periods (months within financial year)
CREATE TABLE school_period (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  financial_year_id INT REFERENCES school_financial_year(id),
  name              TEXT NOT NULL, -- "April 2026", "May 2026"
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  is_closed         BOOLEAN DEFAULT false,
  closed_at         TIMESTAMPTZ,
  closed_by         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_period_year_name ON school_period(financial_year_id, name) WHERE deleted_at IS NULL;

-- Voucher Types
CREATE TABLE school_voucher_type (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL, -- Receipt, Payment, Contra, Journal
  code              TEXT NOT NULL, -- RCP, PAY, CONT, JNL
  numbering_series  TEXT NOT NULL, -- e.g., "RCP-{{year}}-{{seq}}"
  prefix            TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Vouchers (balanced double-entry)
CREATE TABLE school_voucher (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  type_id           INT REFERENCES school_voucher_type(id),
  number            TEXT NOT NULL, -- auto-generated from series
  date              DATE NOT NULL,
  period_id         INT REFERENCES school_period(id),
  source_type       TEXT NOT NULL, -- 'fee_receipt', 'fee_refund', 'payroll', 'manual', 'cheque_bounce', 'bank_charge'
  source_id         INT, -- receipt_id, refund_id, etc.
  narration         TEXT,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
  total_debit       NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit      NUMERIC(15,2) NOT NULL DEFAULT 0,
  posted_by         TEXT,
  posted_at         TIMESTAMPTZ,
  cancelled_by      TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_voucher_number ON school_voucher(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_voucher_date_period ON school_voucher(date, period_id);
CREATE INDEX idx_voucher_source ON school_voucher(source_type, source_id);

-- Voucher Lines
CREATE TABLE school_voucher_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  voucher_id        INT REFERENCES school_voucher(id) ON DELETE CASCADE,
  account_id        INT REFERENCES school_account(id),
  debit             NUMERIC(15,2) DEFAULT 0,
  credit            NUMERIC(15,2) DEFAULT 0,
  narration         TEXT,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_voucher_line_voucher ON school_voucher_line(voucher_id);
CREATE INDEX idx_voucher_line_account ON school_voucher_line(account_id);

-- Vendor Bills (payables)
CREATE TABLE school_vendor (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  gstin             TEXT,
  pan               TEXT,
  contact_person    TEXT,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  account_id        INT REFERENCES school_account(id), -- payable account
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE school_vendor_bill (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  vendor_id         INT REFERENCES school_vendor(id),
  bill_number       TEXT NOT NULL,
  bill_date         DATE NOT NULL,
  due_date          DATE,
  amount            NUMERIC(12,2) NOT NULL,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  paid_at           TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_vendor_bill_vendor ON school_vendor_bill(vendor_id, status);

-- Audit Log (for all money tables)
CREATE TABLE school_audit_log (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  table_name        TEXT NOT NULL,
  record_id         INT NOT NULL,
  action            TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'reverse', 'approve', 'reject', 'cancel', 'match', 'unmatch')),
  old_values        JSONB,
  new_values        JSONB,
  user_id           TEXT,
  user_ip           TEXT,
  user_agent        TEXT,
  reason            TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_table_record ON school_audit_log(table_name, record_id);
CREATE INDEX idx_audit_user_time ON school_audit_log(user_id, created_at);
```

## Auto-Posting Rules (Fee Events → Vouchers)

| Event | Debit | Credit |
|-------|-------|--------|
| Invoice issued | Fees Receivable (control) | Fee Income (per head) |
| Cash receipt | Cash | Fees Receivable |
| Cheque receipt | Cheques in Hand | Fees Receivable |
| Cheque cleared | Bank | Cheques in Hand |
| Cheque bounced | Fees Receivable (+ bounce charge) | Cheques in Hand |
| Online payment received | Gateway Clearing | Fees Receivable |
| Gateway settlement | Bank + Gateway Charges | Gateway Clearing |
| Concession approved | Concession Expense | Fees Receivable |
| Late fine added | Fees Receivable | Fine Income |
| Refund paid | Fee Income / Deposit Liability | Cash / Bank |
| Security deposit received | Cash / Bank | Security Deposit Liability |
| Security deposit returned | Security Deposit Liability | Cash / Bank |
| Bounced cheque | Fees Receivable (+ bounce charge) | Cheques in Hand |
| Gateway settlement received | Bank + Gateway Charges | Gateway Clearing |
| Bank charges | Bank Charges Expense | Bank |

## Auto-Posting Engine

```javascript
async function postFeeEventToAccounts(event) {
  // 1. Determine voucher type (Receipt/Payment/Contra/Journal)
  // 2. Build lines from event data (using mapping table)
  // 3. Validate: sum(debit) === sum(credit)
  // 4. Create voucher + lines in single transaction
  // 5. Update account balances
  // 6. Link voucher to source (receipt_id, refund_id, etc.)
}
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/accounts/chart` | Chart of accounts (hierarchy) |
| POST | `/school/accounts/chart` | Create account |
| PUT | `/school/accounts/chart/:id` | Update account |
| GET | `/school/accounts/groups` | Account groups |
| POST | `/school/accounts/groups` | Create group |
| GET | `/school/accounts/voucher-types` | Voucher types |
| POST | `/school/accounts/voucher-types` | Create type |
| GET | `/school/accounts/vouchers` | List vouchers (filter: date, type, period, status) |
| POST | `/school/accounts/vouchers` | Create manual voucher |
| GET | `/school/accounts/vouchers/:id` | Voucher detail |
| POST | `/school/accounts/vouchers/:id/post` | Post voucher |
| PUT | `/school/accounts/vouchers/:id/cancel` | Cancel (reversal) |
| GET | `/school/accounts/financial-years` | List financial years |
| POST | `/school/accounts/financial-years` | Create financial year |
| POST | `/school/accounts/financial-years/:id/close` | Close year |
| GET | `/school/accounts/periods` | Periods (filter: year) |
| POST | `/school/accounts/periods` | Create period |
| PUT | `/school/accounts/periods/:id/close` | Close period (lock) |
| GET | `/school/accounts/day-book` | Day book (date range) |
| GET | `/school/accounts/cash-book` | Cash book |
| GET | `/school/accounts/bank-book` | Bank book |
| GET | `/school/accounts/ledger/:accountId` | Account ledger |
| GET | `/school/accounts/trial-balance` | Trial balance (date/period) |
| GET | `/school/accounts/income-expenditure` | Income & Expenditure |
| GET | `/school/accounts/balance-sheet` | Balance sheet |
| POST | `/school/accounts/vouchers/auto-post` | Trigger auto-post for pending events |
| GET | `/school/accounts/tally-export` | Export for Tally (XML/CSV) |
| GET | `/school/accounts/vendors` | Vendors |
| POST | `/school/accounts/vendors` | Create vendor |
| GET | `/school/accounts/vendor-bills` | Vendor bills |
| POST | `/school/accounts/vendor-bills` | Create bill |
| PUT | `/school/accounts/vendor-bills/:id/approve` | Approve bill |
| POST | `/school/accounts/vendor-bills/:id/pay` | Pay bill |

## Frontend (src/pages/school/accounts/)

| Route | Component |
|-------|-----------|
| `/school/accounts` | `AccountsDashboard.jsx` |
| `/school/accounts/chart` | `ChartOfAccounts.jsx` |
| `/school/accounts/vouchers` | `VouchersList.jsx` |
| `/school/accounts/vouchers/new` | `VoucherForm.jsx` |
| `/school/accounts/day-book` | `DayBook.jsx` |
| `/school/accounts/cash-book` | `CashBook.jsx` |
| `/school/accounts/bank-book` | `BankBook.jsx` |
| `/school/accounts/ledger/:id` | `AccountLedger.jsx` |
| `/school/accounts/trial-balance` | `TrialBalance.jsx` |
| `/school/accounts/income-expenditure` | `IncomeExpenditure.jsx` |
| `/school/accounts/balance-sheet` | `BalanceSheet.jsx` |
| `/school/accounts/financial-years` | `FinancialYears.jsx` |
| `/school/accounts/periods` | `Periods.jsx` |
| `/school/accounts/vendors` | `Vendors.jsx` |
| `/school/accounts/vendor-bills` | `VendorBills.jsx` |

### VoucherForm.jsx — Key Features
- Type: Receipt, Payment, Contra, Journal
- Lines: account (search), debit/credit, narration
- Auto-balance check (debit = credit)
- Source link: fee receipt, payroll, manual
- Save draft → Post (locks) → Cancel (reversal)

### TrialBalance.jsx
- As of date / period
- Columns: Account, Code, Opening, Debit, Credit, Closing
- Group by group, expand/collapse
- Export: CSV, PDF, Tally format

### BalanceSheet.jsx
- As of date
- Assets (Fixed, Current, Cash/Bank)
- Liabilities (Capital, Loans, Current)
- Equity
- Check: Assets = Liabilities + Equity

### IncomeExpenditure.jsx
- Period: month/quarter/year
- Income (Fee Income, Other Income)
- Expenses (Salary, Admin, Maintenance, etc.)
- Surplus/Deficit
- Drill down to voucher level

### Tally Export
- Day Book export (XML/CSV)
- Ledger export
- Stock export (later)
- Voucher type mapping

## Period Lock
- Close period: no new vouchers, no edits
- Reopen: requires permission + audit
- Year-end close: carry forward balances, lock all periods

## Acceptance
- Voucher: must balance (debit = credit) to save
- Auto-post: every fee event creates voucher in same transaction
- Trial balance: debits = credits always
- Balance sheet: Assets = Liabilities + Equity
- Period lock: no new vouchers in closed period
- Tally export: imports cleanly into Tally
- Audit log: every money change traced