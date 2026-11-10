# Step 4 — Refunds

**Deliverable:** Requests, rules, approvals, payouts, credit notes, deposit return.  
**Exit:** No refund without approval and an audit entry.

## Database

### Migration
- `sql/53_refunds.sql`

### Tables

```sql
-- Refund Rules (policy per head/category)
CREATE TABLE school_refund_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  head_id           INT REFERENCES school_fee_head(id),
  category_id       INT REFERENCES school_fee_category(id),
  reason_type       TEXT NOT NULL CHECK (reason_type IN ('withdrawal', 'excess', 'cancelled_admission', 'deposit_return', 'transport_change', 'concession_late')),
  refundable_percent NUMERIC(5,2) DEFAULT 100, -- % of amount paid
  non_refundable_heads TEXT[], -- heads that are never refunded
  notice_days       INT, -- for withdrawal
  deduction_rules   JSONB, -- e.g., {"before_class_start": 100, "within_15_days": 80, "after_15_days": 50}
  max_deduction     NUMERIC(12,2),
  requires_approval BOOLEAN DEFAULT true,
  approval_roles    TEXT[],
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Refund Requests
CREATE TABLE school_refund_request (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id),
  reason_type       TEXT NOT NULL,
  reason_text       TEXT,
  requested_amount  NUMERIC(12,2),
  calculated_amount NUMERIC(12,2),
  deductions        NUMERIC(12,2) DEFAULT 0,
  net_amount        NUMERIC(12,2),
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'cancelled')),
  requested_by      TEXT,
  requested_at      TIMESTAMPTZ DEFAULT now(),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  approval_notes    TEXT,
  rejected_by       TEXT,
  rejected_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  paid_by           TEXT,
  paid_at           TIMESTAMPTZ,
  payout_mode       TEXT CHECK (payout_mode IN ('cheque', 'bank_transfer', 'upi', 'cash', 'original_online', 'credit_note')),
  payout_reference  TEXT,
  cheque_id         INT REFERENCES school_cheque(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_refund_student_status ON school_refund_request(student_id, status);

-- Refund Approval Chain (if multi-level)
CREATE TABLE school_refund_approval (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  request_id        INT REFERENCES school_refund_request(id) ON DELETE CASCADE,
  level             INT NOT NULL, -- 1, 2, 3...
  role              TEXT NOT NULL,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Credit Notes (applied to future dues)
CREATE TABLE school_credit_note (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  amount            NUMERIC(12,2) NOT NULL,
  used_amount       NUMERIC(12,2) DEFAULT 0,
  reason            TEXT NOT NULL,
  source_type       TEXT, -- 'refund', 'excess', 'concession_late', 'adjustment'
  source_id         INT, -- refund_request_id, etc.
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  expiry_date       DATE,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_credit_note_student ON school_credit_note(student_id, status);

-- Deposits (security, caution money)
CREATE TABLE school_deposit (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  head_id           INT REFERENCES school_fee_head(id), -- must be deposit head
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT DEFAULT 'held' CHECK (status IN ('held', 'returned', 'forfeited', 'adjusted')),
  received_receipt_id INT REFERENCES school_receipt(id),
  return_receipt_id INT REFERENCES school_receipt(id),
  return_date       DATE,
  forfeited_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_deposit_student ON school_deposit(student_id, status);
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/fee/refund-rules` | List refund rules |
| POST | `/school/fee/refund-rules` | Create refund rule |
| PUT | `/school/fee/refund-rules/:id` | Update refund rule |
| GET | `/school/fee/refund-requests` | List refund requests (filter: student, status) |
| POST | `/school/fee/refund-requests` | Create refund request |
| GET | `/school/fee/refund-requests/:id` | Request detail with calculation |
| PUT | `/school/fee/refund-requests/:id/approve` | Approve (with level) |
| PUT | `/school/fee/refund-requests/:id/reject` | Reject with reason |
| POST | `/school/fee/refund-requests/:id/pay` | Record payout |
| GET | `/school/fee/credit-notes` | List credit notes |
| POST | `/school/fee/credit-notes` | Create credit note |
| PUT | `/school/fee/credit-notes/:id/use` | Apply to invoice |
| GET | `/school/fee/deposits` | List deposits |
| POST | `/school/fee/deposits` | Record deposit received |
| PUT | `/school/fee/deposits/:id/return` | Record return |
| PUT | `/school/fee/deposits/:id/forfeit` | Forfeit deposit |

## Frontend (src/pages/school/fee/)

| Route | Component |
|-------|-----------|
| `/school/fee/refunds` | `RefundsDashboard.jsx` |
| `/school/fee/refunds/requests` | `RefundRequests.jsx` |
| `/school/fee/refunds/rules` | `RefundRules.jsx` |
| `/school/fee/refunds/credit-notes` | `CreditNotes.jsx` |
| `/school/fee/refunds/deposits` | `Deposits.jsx` |

### RefundRequests.jsx — Key Features
- Create request: student, reason, auto-calculates amount by rules
- Shows: paid amount, non-refundable heads, deductions, net amount
- Approval chain: levels with roles, approve/reject with notes
- Payout: mode (cheque/bank/UPI/cash/online), reference, print refund receipt
- Audit trail: every action logged with user, time, notes

### RefundRules.jsx
- Per head/category/reason type
- % refundable, notice days, deduction schedule (before class: 100%, week 1: 80%, etc.)
- Non-refundable heads list
- Approval limits by role

### CreditNotes.jsx
- List: student, amount, used, balance, expiry
- Create: manual or from refund/excess
- Apply: pick invoice, auto-allocate

### Deposits.jsx
- Record deposit received (linked to deposit head)
- Return: when conditions met (TC issued, hostel vacated)
- Forfeit: with reason, approval
- Report: deposits held, returned, pending

## Refund Calculation Engine
```javascript
function calculateRefund(request) {
  // 1. Sum all payments for refundable heads
  // 2. Subtract non-refundable heads (admission, etc.)
  // 3. Apply deduction rules based on reason + timing
  // 3. Cap at max_deduction
  // 4. Net = max(0, paid - non_refundable - deductions)
}
```

## Approval Chain
- Level 1: Fee clerk (up to ₹5,000)
- Level 2: Accounts head (up to ₹25,000)
- Level 3: Principal (above ₹25,000)
- Each level: approve/reject with notes, timestamped

## Credit Note Flow
- Created from: refund, excess payment, late concession
- Status: active → used (fully) → exhausted
- Auto-applied to next invoice or manually allocated

## Deposit Return
- Triggered by: TC issued, hostel vacated, transport cancelled
- Conditions verified (no dues, TC issued)
- Return mode: original or cheque/bank
- Forfeit: if conditions not met (damage, dues)

## Acceptance
- Refund request: auto-calculates by rules, shows breakdown
- Approval: multi-level, each level logged
- Payout: creates refund receipt, reverses ledger entries
- Credit note: applied to next invoice automatically
- Deposit: received → held → returned/forfeited, full audit
- Audit trail: every action (request, approve, pay) logged