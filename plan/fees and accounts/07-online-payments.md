# Step 7 — Online Payments

**Deliverable:** Gateway, parent portal, webhooks, status check, settlement import.  
**Exit:** Online payments create exactly one receipt.

## Database

### Migration
- `sql/56_online_payments.sql` (tables already in Step 2)

### Additional Tables

```sql
-- Gateway Configuration
CREATE TABLE school_gateway_config (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL, -- 'razorpay', 'paytm', 'phonepe', 'cashfree'
  display_name      TEXT NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  is_test_mode      BOOLEAN DEFAULT true,
  api_key           TEXT,
  api_secret        TEXT, -- encrypted
  webhook_secret    TEXT, -- encrypted
  supported_modes   TEXT[] DEFAULT '{}', -- ['upi', 'card', 'netbanking', 'wallet']
  charges_borne_by  TEXT DEFAULT 'school' CHECK (charges_borne_by IN ('school', 'parent', 'split')),
  fixed_charge      NUMERIC(12,2) DEFAULT 0,
  percent_charge    NUMERIC(5,2) DEFAULT 0,
  min_charge        NUMERIC(12,2),
  max_charge        NUMERIC(12,2),
  success_url       TEXT,
  failure_url       TEXT,
  webhook_url       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Payment Links (for parent portal/email/SMS)
CREATE TABLE school_payment_link (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id),
  gateway_id        INT REFERENCES school_gateway_config(id),
  invoice_id        INT REFERENCES school_invoice(id),
  amount            NUMERIC(12,2) NOT NULL,
  gateway_charge    NUMERIC(12,2) DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL,
  link_token        TEXT NOT NULL, -- UUID for URL
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'expired', 'cancelled')),
  expires_at        TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  paid_receipt_id   INT REFERENCES school_receipt(id),
  sent_via          TEXT, -- 'email', 'sms', 'whatsapp', 'portal'
  sent_at           TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_payment_link_token ON school_payment_link(app_id, link_token) WHERE deleted_at IS NULL;
CREATE INDEX idx_payment_link_student ON school_payment_link(student_id, status);

-- Gateway Webhook Log
CREATE TABLE school_gateway_webhook_log (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  gateway_id        INT REFERENCES school_gateway_config(id),
  event_type        TEXT, -- 'payment.captured', 'payment.failed', 'refund.processed', 'settlement.created'
  gateway_event_id  TEXT,
  payload           JSONB,
  processed         BOOLEAN DEFAULT false,
  processed_at      TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_webhook_gateway_event ON school_gateway_webhook_log(gateway_id, gateway_event_id);
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/fee/gateways` | List gateway configs |
| POST | `/school/fee/gateways` | Create gateway config |
| PUT | `/school/fee/gateways/:id` | Update gateway config |
| GET | `/school/fee/payment-links` | List payment links |
| POST | `/school/fee/payment-links` | Create payment link |
| GET | `/school/fee/payment-links/:token` | Public payment page |
| POST | `/school/fee/payment-links/:token/pay` | Process payment (gateway redirect) |
| POST | `/school/fee/gateways/:id/webhook` | Gateway webhook |
| GET | `/school/fee/gateways/:id/settlements` | Settlements for gateway |
| POST | `/school/fee/gateways/:id/settlement/import` | Import settlement file |
| GET | `/school/fee/online-payments/pending` | Pending online payments |
| POST | `/school/fee/online-payments/status-check` | Check pending statuses |
| GET | `/school/fee/gateways/:id/config` | Gateway config (public for payment page) |

## Frontend (src/pages/school/fee/)

| Route | Component |
|-------|-----------|
| `/school/fee/gateways` | `GatewaysConfig.jsx` |
| `/school/fee/payment-links` | `PaymentLinks.jsx` |
| `/school/fee/online-payments` | `OnlinePaymentsDashboard.jsx` |

### GatewaysConfig.jsx
- Add gateway: name, credentials (encrypted), charges borne by
- Test mode toggle
- Webhook URL display (for gateway dashboard)

### PaymentLinks.jsx
- Create link: student + invoice(s) + gateway
- Bulk: send to class/section/family
- Send: email/SMS/WhatsApp with link
- Track: sent/clicked/paid/expired
- Parent view: dues, click link → gateway payment page

### OnlinePaymentsDashboard.jsx
- Pending: awaiting webhook
- Status check job (manual + scheduled)
- Failed: retry, notify parent
- Settlement import: auto-match

## Payment Flow

### Parent Portal
1. Parent logs in → sees dues
2. Clicks "Pay Now" → creates payment link
2. Redirects to gateway payment page
3. Gateway processes → redirects to success/failure URL
4. Webhook received → creates receipt

### Webhook Processing (atomic)
```javascript
async function handleWebhook(gateway, payload) {
  // 1. Verify signature
  // 2. Parse event: payment.captured / failed / refunded
  // 3. Find payment_link by gateway_order_id
  // 4. If captured:
  //    - Create receipt (atomic: receipt + allocations + ledger + voucher)
  //    - Mark link as paid
  //    - Notify parent
  // 5. If failed: mark link failed, notify parent
  // 6. Log webhook
}
```

### Duplicate Prevention
- Unique constraint on `gateway_order_id`
- Idempotent webhook processing (check `processed` flag)
- If duplicate: mark as advance credit or refund

### Status Check Job
- Runs every 5 min
- Finds pending online payments > 10 min
- Calls gateway status API
- Updates: success → create receipt, failed → notify parent

### Settlement Import
- Daily: download settlement report from gateway
- Import → auto-match lines to receipts
- Fee line → Gateway Charges account
- Refund lines → match refund receipts
- Exceptions → reconciliation

## Parent Portal Payment Page
- URL: `/pay/:token`
- Shows: student name, invoice details, amount, gateway charge
- Payment modes: UPI, Card, Netbanking, Wallet
- Success: receipt PDF download + email
- Failure: retry button, contact info

## Acceptance
- Gateway config: 3 gateways (Razorpay, Paytm, PhonePe) in test mode
- Payment link: created, sent via email/SMS, parent pays
- Webhook: verified signature, creates exactly one receipt
- Duplicate webhook: ignored (idempotent)
- Settlement import: 500 lines, 99% matched, fee posted to charges
- Status check: pending > 10 min → checks gateway, updates
- Parent portal: dues visible, payment link works, receipt downloaded
- No double receipts under load