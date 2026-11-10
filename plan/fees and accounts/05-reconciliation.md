# Step 5 — Reconciliation

**Deliverable:** Cheque tracking, gateway and bank matching, exceptions.  
**Exit:** Only real exceptions are left to review.

## Database

### Migration
- `sql/54_reconciliation.sql`

### Tables

```sql
-- Bank Statement Lines
CREATE TABLE school_bank_statement_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  bank_account_id   INT REFERENCES school_account(id), -- cash/bank account
  import_batch_id   TEXT, -- UUID per import
  date              DATE NOT NULL,
  narration         TEXT,
  reference         TEXT, -- cheque no, UPI ref, etc.
  debit             NUMERIC(12,2) DEFAULT 0,
  credit            NUMERIC(12,2) DEFAULT 0,
  balance           NUMERIC(12,2),
  import_hash       TEXT, -- hash of row for deduplication
  matched_flag      BOOLEAN DEFAULT false,
  matched_receipt_id INT REFERENCES school_receipt(id),
  matched_settlement_id INT REFERENCES school_gateway_settlement(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_bank_stmt_account_date ON school_bank_statement_line(bank_account_id, date);
CREATE INDEX idx_bank_stmt_ref ON school_bank_statement_line(reference);

-- Gateway Settlements
CREATE TABLE school_gateway_settlement (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  gateway           TEXT NOT NULL,
  settlement_id     TEXT NOT NULL, -- from gateway
  settlement_date   DATE NOT NULL,
  gross_amount      NUMERIC(12,2) NOT NULL,
  gateway_fee       NUMERIC(12,2) DEFAULT 0,
  tax_on_fee        NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2) NOT NULL,
  currency          TEXT DEFAULT 'INR',
  status            TEXT DEFAULT 'imported' CHECK (status IN ('imported', 'matched', 'exceptions')),
  import_batch_id   TEXT,
  imported_at       TIMESTAMPTZ DEFAULT now(),
  matched_at        TIMESTAMPTZ,
  matched_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_gateway_settlement ON school_gateway_settlement(app_id, gateway, settlement_id) WHERE deleted_at IS NULL;

-- Gateway Settlement Lines (individual payments in settlement)
CREATE TABLE school_gateway_settlement_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  settlement_id     INT REFERENCES school_gateway_settlement(id) ON DELETE CASCADE,
  gateway_payment_id TEXT NOT NULL,
  gateway_order_id  TEXT,
  amount            NUMERIC(12,2) NOT NULL,
  fee               NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2),
  status            TEXT, -- 'captured', 'refunded', 'chargeback'
  matched_receipt_id INT REFERENCES school_receipt(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_gateway_settlement_line_payment ON school_gateway_settlement_line(gateway_payment_id);

-- Match Exceptions (unmatched lines)
CREATE TABLE school_match_exception (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  exception_type    TEXT NOT NULL CHECK (exception_type IN (
    'bank_no_receipt', 'receipt_no_bank', 'amount_mismatch',
    'gateway_no_receipt', 'receipt_no_gateway', 'settlement_mismatch',
    'duplicate_bank', 'duplicate_gateway', 'amount_mismatch_gateway'
  )),
  source_type       TEXT NOT NULL, -- 'bank', 'gateway', 'receipt'
  source_id         INT, -- bank_statement_line_id, gateway_settlement_line_id, receipt_id
  matched_source_id INT, -- the other side if partial
  amount_diff       NUMERIC(12,2),
  status            TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_by       TEXT,
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_match_exception_type_status ON school_match_exception(exception_type, status);

-- Cashier Day Exceptions (difference from expected)
CREATE TABLE school_cashier_day_exception (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  cashier_day_id    INT REFERENCES school_cashier_day(id),
  exception_type    TEXT NOT NULL CHECK (exception_type IN ('cash_short', 'cash_over', 'missing_receipt', 'extra_receipt')),
  amount            NUMERIC(12,2) NOT NULL,
  note              TEXT,
  resolved_by       TEXT,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/fee/reconciliation/cashier-day/:id` | Cashier day with exceptions |
| POST | `/school/fee/reconciliation/cashier-day/:id/resolve` | Resolve cash exception |
| GET | `/school/fee/reconciliation/cheques` | Cheques (filter: status, date) |
| PUT | `/school/fee/cheques/:id/match` | Match cheque to bank line |
| GET | `/school/fee/gateway-settlements` | List settlements |
| POST | `/school/fee/gateway-settlements/import` | Import settlement file |
| PUT | `/school/fee/gateway-settlements/:id/match` | Auto-match settlement lines |
| GET | `/school/fee/bank-statements` | Imported bank statements |
| POST | `/school/fee/bank-statements/import` | Import bank statement (CSV/OFX) |
| PUT | `/school/fee/bank-statements/:batchId/match` | Auto-match bank lines |
| GET | `/school/fee/exceptions` | All exceptions (filter: type, status) |
| PUT | `/school/fee/exceptions/:id/resolve` | Resolve exception |
| GET | `/school/fee/reconciliation/summary` | Summary: matched/unmatched counts |
| POST | `/school/fee/reconciliation/auto-match` | Run auto-match for all streams |

## Frontend (src/pages/school/fee/)

| Route | Component |
|-------|-----------|
| `/school/fee/reconciliation` | `ReconciliationDashboard.jsx` |
| `/school/fee/reconciliation/cashier` | `CashierReconciliation.jsx` |
| `/school/fee/reconciliation/cheques` | `ChequeReconciliation.jsx` |
| `/school/fee/reconciliation/gateway` | `GatewayReconciliation.jsx` |
| `/school/fee/reconciliation/bank` | `BankReconciliation.jsx` |
| `/school/fee/reconciliation/exceptions` | `ExceptionsList.jsx` |

### ReconciliationDashboard.jsx
- Cards: Cashier days (open/closed), Cheques (pending/cleared/bounced), Gateway (matched/exceptions), Bank (imported/matched/exceptions)
- Quick actions: Import settlement, import bank, run auto-match

### CashierReconciliation.jsx
- List cashier days: date, cashier, expected, counted, difference, status
- Open day: shows receipts, expected cash
- Close day: enter counted cash, shows difference
- Exception: cash short/over, missing/extra receipt
- Resolve: enter note, approver signs off

### ChequeReconciliation.jsx
- Grid: cheque no, date, amount, student, status (pending/deposited/cleared/bounced)
- Actions: mark deposited, mark cleared, mark bounced
- Bounce: auto-reverses receipt, adds bounce charge, notifies parent
- Match: link cheque to bank statement line

### GatewayReconciliation.jsx
- Import settlement file (CSV/Excel)
- Auto-match: by gateway_payment_id + amount + date
- Grid: settlement lines, matched receipt, unmatched
- Fee + refund breakdown per settlement
- Exception list: amount mismatch, missing receipt

### BankReconciliation.jsx
- Import: CSV/OFX from bank
- Auto-match: by reference (cheque no, UPI ref) + amount + date (±1 day)
- Grid: bank line, matched receipt/settlement, unmatched
- Manual match: drag bank line to receipt
- Create missing receipt from bank line (advance/unknown)

### ExceptionsList.jsx
- Unified view: all exception types
- Filters: type, status (open/resolved), date
- Actions: resolve (link manually), ignore, create missing receipt
- Bulk resolve: select multiple, same resolution

## Auto-Match Logic

### Cashier Day
- Expected = sum of cash receipts in day
- Counted = entered by cashier
- Difference = exception (cash_short/cash_over)

### Cheques
- Pending → Deposited (manual)
- Cleared: match bank line by cheque no + amount
- Bounced: bank line shows return → auto-bounce

### Gateway
- Settlement file → parse lines
- Match by gateway_payment_id (exact) + amount ±0.01
- Fee line → post to Gateway Charges account
- Refund lines → match refund receipts

### Bank Statement
- Import → deduplicate by hash
- Match priority:
  1. Cheque no exact + amount exact
  2. UPI ref exact + amount exact
  3. Reference contains receipt no + amount ±0.01
  4. Amount exact + date ±1 day
- Unmatched → exceptions

### Exception Resolution
- Manual match: pick bank line + receipt
- Create missing: advance receipt / unknown
- Ignore: with reason (e.g., bank charges)
- Partial match: split amount

## Acceptance
- Cashier day: 50 receipts, close in < 30 sec
- Cheque bounce: auto-reverses, adds charge, notifies parent
- Gateway: 500 payments, 99% auto-matched, < 5 exceptions
- Bank: 2000 lines, 95% auto-matched, < 20 exceptions
- Exception list: only real issues, bulk resolve
- All streams: matched count + exception count = total