# Step 2 — Invoices & Collection

**Deliverable:** Invoice generation, counter collection, receipts, ledger, family view, cancellation by reversal, cashier day close.  
**Exit:** A counter collection takes under a minute.

## Database

### Migration
- `sql/51_invoices_collection.sql`

### Tables

```sql
-- Invoices
CREATE TABLE school_invoice (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  installment_id    INT REFERENCES school_installment(id),
  number            TEXT NOT NULL, -- e.g., INV-2026-000001
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE NOT NULL,
  status            TEXT DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'partly_paid', 'paid', 'cancelled', 'written_off')),
  total_amount      NUMERIC(12,2) NOT NULL,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  concession_amount NUMERIC(12,2) DEFAULT 0,
  fine_amount       NUMERIC(12,2) DEFAULT 0,
  balance           NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - paid_amount - concession_amount + fine_amount) STORED,
  cancelled_by      TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancelled_reason  TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_invoice_number ON school_invoice(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_student_due ON school_invoice(student_id, due_date, status);

-- Invoice Lines
CREATE TABLE school_invoice_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  invoice_id        INT REFERENCES school_invoice(id) ON DELETE CASCADE,
  head_id           INT REFERENCES school_fee_head(id),
  amount            NUMERIC(12,2) NOT NULL,
  concession_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_invoice_line_invoice ON school_invoice_line(invoice_id);

-- Receipts
CREATE TABLE school_receipt (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id),
  family_id         INT REFERENCES school_family(id),
  number            TEXT NOT NULL, -- e.g., RCP-2026-000001
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  mode              TEXT NOT NULL CHECK (mode IN ('cash', 'cheque', 'dd', 'upi', 'card', 'bank_transfer', 'online', 'challan', 'pdc')),
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'cleared', 'bounced', 'cancelled')),
  reference         TEXT, -- cheque no, UPI ref, gateway order id, etc.
  cashier_id        TEXT,
  cashier_day_id    INT REFERENCES school_cashier_day(id),
  cheque_id         INT REFERENCES school_cheque(id),
  online_payment_id INT REFERENCES school_online_payment(id),
  cancelled_by      TEXT,
  cancelled_at      TIMESTAMPTZ,
  cancelled_reason  TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_receipt_number ON school_receipt(app_id, number) WHERE deleted_at IS NULL;
CREATE INDEX idx_receipt_student_date ON school_receipt(student_id, date, status);
CREATE INDEX idx_receipt_cashier_day ON school_receipt(cashier_day_id);

-- Receipt Allocation (which invoice line gets paid)
CREATE TABLE school_receipt_allocation (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT REFERENCES school_receipt(id) ON DELETE CASCADE,
  invoice_line_id   INT REFERENCES school_invoice_line(id),
  amount            NUMERIC(12,2) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_receipt_alloc_receipt ON school_receipt_allocation(receipt_id);
CREATE INDEX idx_receipt_alloc_line ON school_receipt_allocation(invoice_line_id);

-- Cheques
CREATE TABLE school_cheque (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT REFERENCES school_receipt(id) ON DELETE SET NULL,
  number            TEXT NOT NULL,
  bank_name         TEXT,
  branch            TEXT,
  cheque_date       DATE NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deposited', 'cleared', 'bounced', 'cancelled')),
  deposit_date      DATE,
  clearance_date    DATE,
  bounce_charge     NUMERIC(12,2) DEFAULT 0,
  bounce_reason     TEXT,
  deposited_by      TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_cheque_status_date ON school_cheque(status, cheque_date);

-- Online Payments
CREATE TABLE school_online_payment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  receipt_id        INT REFERENCES school_receipt(id) ON DELETE SET NULL,
  gateway           TEXT NOT NULL, -- e.g., 'razorpay', 'paytm', 'phonepe'
  gateway_order_id  TEXT NOT NULL,
  gateway_payment_id TEXT,
  gateway_signature TEXT,
  amount            NUMERIC(12,2) NOT NULL,
  gateway_fee       NUMERIC(12,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  student_id        INT REFERENCES school_students(id),
  gateway_response  JSONB,
  webhook_received  BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_online_gateway_order ON school_online_payment(app_id, gateway, gateway_order_id) WHERE deleted_at IS NULL;

-- Cashier Day
CREATE TABLE school_cashier_day (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  cashier_id        TEXT NOT NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_cash      NUMERIC(12,2) DEFAULT 0,
  closing_cash      NUMERIC(12,2),
  expected_cash     NUMERIC(12,2),
  difference        NUMERIC(12,2) GENERATED ALWAYS AS (closing_cash - expected_cash) STORED,
  status            TEXT DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by         TEXT,
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_cashier_day ON school_cashier_day(app_id, cashier_id, date) WHERE deleted_at IS NULL;

-- Ledger Entries (immutable, only reversals allowed)
CREATE TABLE school_ledger_entry (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('charge', 'payment', 'concession', 'fine', 'refund', 'adjustment', 'write_off', 'reversal')),
  head_id           INT REFERENCES school_fee_head(id),
  debit             NUMERIC(12,2) DEFAULT 0,
  credit            NUMERIC(12,2) DEFAULT 0,
  balance           NUMERIC(12,2) NOT NULL, -- running balance after this entry
  source_type       TEXT NOT NULL, -- 'invoice', 'receipt', 'concession', 'fine', 'refund', 'adjustment', 'write_off', 'manual'
  source_id         INT, -- invoice_id, receipt_id, etc.
  reversal_of       INT REFERENCES school_ledger_entry(id), -- if this is a reversal
  reason            TEXT, -- required for reversals, concessions, adjustments
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_ledger_student_date ON school_ledger_entry(student_id, date);
CREATE INDEX idx_ledger_source ON school_ledger_entry(source_type, source_id);
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/fee/invoices` | List invoices (filter: student, installment, status) |
| POST | `/school/fee/invoices/generate` | Bulk generate by class/installment |
| GET | `/school/fee/invoices/:id` | Invoice detail with lines |
| POST | `/school/fee/invoices/:id/cancel` | Cancel by reversal |
| GET | `/school/fee/receipts` | List receipts (filter: student, date, mode, status) |
| POST | `/school/fee/receipts` | Create receipt (counter) |
| GET | `/school/fee/receipts/:id` | Receipt detail with allocations |
| POST | `/school/fee/receipts/:id/cancel` | Cancel receipt (reversal) |
| GET | `/school/fee/receipts/:id/print` | Print receipt (thermal/A4) |
| POST | `/school/fee/receipts/bulk-cancel` | Bulk cancel with reason |
| GET | `/school/fee/cheques` | List cheques (filter: status, date) |
| POST | `/school/fee/cheques` | Record cheque |
| PUT | `/school/fee/cheques/:id/clear` | Mark cleared |
| PUT | `/school/fee/cheques/:id/bounce` | Mark bounced |
| GET | `/school/fee/online-payments` | List online payments |
| POST | `/school/fee/online-payments/webhook` | Gateway webhook |
| POST | `/school/fee/online-payments/status-check` | Manual status check |
| GET | `/school/fee/cashier-days` | List cashier days |
| POST | `/school/fee/cashier-days/open` | Open day |
| PUT | `/school/fee/cashier-days/:id/close` | Close day (count cash) |
| GET | `/school/fee/ledger/:studentId` | Student ledger (all entries) |
| GET | `/school/fee/ledger/:studentId/balance` | Current balance |
| POST | `/school/fee/generate-invoices` | Bulk generate by class/installment |
| GET | `/school/fee/family/:familyId/dues` | Family dues view |
| POST | `/school/fee/collections/report` | Collection report (daily, head-wise, etc.) |

## Frontend (src/pages/school/fee/)

| Route | Component |
|-------|-----------|
| `/school/fee` | `CollectionDashboard.jsx` |
| `/school/fee/collect` | `CounterCollection.jsx` |
| `/school/fee/receipts` | `ReceiptsList.jsx` |
| `/school/fee/invoices` | `InvoicesList.jsx` |
| `/school/fee/cheques` | `Cheques.jsx` |
| `/school/fee/online-payments` | `OnlinePayments.jsx` |
| `/school/fee/cashier-day` | `CashierDay.jsx` |

### CounterCollection.jsx — Key Features
- Search by name, admission no, scan QR/barcode
- Shows student + family dues in one screen
- Installment/head selection with checkboxes
- Mode selection: cash, cheque, UPI, card, online
- Default allocation (oldest due first) + override
- Concession dropdown (approved only)
- Print receipt (thermal/A4), send to parent
- Auto-save draft, keyboard shortcuts

## Invoice Generation
- By class + installment (scheduled or manual)
- Pro-rata for mid-year admissions
- Uses structure version at generation time (never changes)
- Creates ledger charge entries + invoice lines in one transaction

## Receipt Flow (single transaction)
1. Validate student + dues
2. Allocate amount by rule (oldest due first, then by head priority)
3. Create receipt + allocations + ledger entries (payment + concessions + fines)
4. Post voucher to Accounts
5. Issue receipt number (atomic sequence)
6. Print + notify parent

## Cancellation by Reversal
- Receipt cancelled → reversal ledger entries (credit receivable, debit cash)
- Voucher reversed
- Original receipt status = 'cancelled'
- New receipt issued if re-collected

## Cashier Day Close
- Open day → collect → close (count cash)
- Compare expected (sum of cash receipts) vs counted
- Difference recorded with note
- Day locked after close

## Acceptance
- Counter: 40-student class, 5 installments, 3 heads → collection < 60 sec
- Receipt number atomic (no duplicates under load)
- Cancellation creates reversal entries, not deletion
- Day close: expected vs actual, difference noted, day locked
- Family: siblings' dues shown together, split on receipt
- All ledger entries immutable; cancellation = reversal entry