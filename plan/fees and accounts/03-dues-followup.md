# Step 3 — Dues & Follow-up

**Deliverable:** Dashboard, ageing, defaulters, reminders, follow-up, payment plans, block policies.  
**Exit:** Overdue parents are reminded automatically.

## Database

### Migration
- `sql/52_dues_followup.sql`

### Tables

```sql
-- Reminder Rules (when/how to remind)
CREATE TABLE school_reminder_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  trigger_type      TEXT NOT NULL CHECK (trigger_type IN ('before_due', 'after_due', 'custom')),
  days              INT NOT NULL, -- e.g., -7 (7 days before), 3 (3 days after)
  channel           TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'app', 'letter')),
  template          TEXT, -- with placeholders {{student_name}}, {{amount}}, {{due_date}}
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Reminder Log
CREATE TABLE school_reminder_log (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  rule_id           INT REFERENCES school_reminder_rule(id),
  student_id        INT REFERENCES school_students(id),
  channel           TEXT NOT NULL,
  sent_at           TIMESTAMPTZ DEFAULT now(),
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  error_message     TEXT,
  external_id       TEXT, -- gateway message id
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reminder_log_student ON school_reminder_log(student_id, sent_at);

-- Follow-ups (manual or scheduled)
CREATE TABLE school_follow_up (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  by_user           TEXT NOT NULL,
  mode              TEXT CHECK (mode IN ('call', 'meeting', 'letter', 'email', 'whatsapp', 'visit')),
  note              TEXT,
  promise_date      DATE,
  promise_amount    NUMERIC(12,2),
  outcome           TEXT CHECK (outcome IN ('promised', 'partial_paid', 'no_response', 'disputed', 'escalated')),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_follow_up_student_date ON school_follow_up(student_id, date);

-- Payment Plans
CREATE TABLE school_payment_plan (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  total_amount      NUMERIC(12,2) NOT NULL,
  installments      INT NOT NULL,
  amount_per_installment NUMERIC(12,2) NOT NULL,
  start_date        DATE NOT NULL,
  frequency         TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Payment Plan Installments
CREATE TABLE school_payment_plan_installment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  plan_id           INT REFERENCES school_payment_plan(id) ON DELETE CASCADE,
  installment_no    INT NOT NULL,
  due_date          DATE NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Block Policies (what blocks defaulters)
CREATE TABLE school_block_policy (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  trigger_type      TEXT NOT NULL CHECK (trigger_type IN ('days_overdue', 'amount_overdue', 'installments_overdue')),
  trigger_value     NUMERIC(12,2) NOT NULL,
  block_type        TEXT NOT NULL CHECK (block_type IN ('hall_ticket', 'report_card', 'transfer_certificate', 'results', 'all')),
  auto_lift         BOOLEAN DEFAULT true, -- lift on payment
  message           TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Student Blocks (active blocks)
CREATE TABLE school_student_block (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  policy_id         INT REFERENCES school_block_policy(id),
  blocked_at        TIMESTAMPTZ DEFAULT now(),
  lifted_at         TIMESTAMPTZ,
  lifted_by         TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_student_block_policy ON school_student_block(app_id, student_id, policy_id) WHERE lifted_at IS NULL;
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/fee/dues/dashboard` | Dashboard stats (total due, ageing buckets, defaulters) |
| GET | `/school/fee/dues/ageing` | Ageing report (0-30, 31-60, 61-90, 90+) |
| GET | `/school/fee/dues/defaulters` | Defaulter list (filter: class, days, amount) |
| GET | `/school/fee/reminders/rules` | List reminder rules |
| POST | `/school/fee/reminders/rules` | Create reminder rule |
| PUT | `/school/fee/reminders/rules/:id` | Update reminder rule |
| GET | `/school/fee/reminders/log` | Reminder log (filter: student, channel, status) |
| POST | `/school/fee/reminders/bulk-send` | Trigger bulk reminders |
| GET | `/school/fee/follow-ups` | List follow-ups (filter: student, date, by) |
| POST | `/school/fee/follow-ups` | Log follow-up |
| GET | `/school/fee/payment-plans` | List payment plans |
| POST | `/school/fee/payment-plans` | Create payment plan |
| PUT | `/school/fee/payment-plans/:id` | Update plan |
| GET | `/school/fee/block-policies` | List block policies |
| POST | `/school/fee/block-policies` | Create block policy |
| PUT | `/school/fee/block-policies/:id` | Update policy |
| GET | `/school/fee/blocks` | Active blocks (filter: student, policy) |
| POST | `/school/fee/blocks/:id/lift` | Lift block manually |
| GET | `/school/fee/family/:familyId/dues` | Family dues view |
| POST | `/school/fee/collections/ageing-report` | Ageing report (CSV/PDF) |
| POST | `/school/fee/collections/defaulters-report` | Defaulters report |

## Frontend (src/pages/school/fee/)

| Route | Component |
|-------|-----------|
| `/school/fee/dues` | `DuesDashboard.jsx` |
| `/school/fee/dues/ageing` | `AgeingReport.jsx` |
| `/school/fee/dues/defaulters` | `DefaultersList.jsx` |
| `/school/fee/dues/reminders` | `Reminders.jsx` |
| `/school/fee/dues/follow-ups` | `FollowUps.jsx` |
| `/school/fee/dues/payment-plans` | `PaymentPlans.jsx` |
| `/school/fee/dues/block-policies` | `BlockPolicies.jsx` |

### DuesDashboard.jsx — Key Features
- Cards: Total Due, Ageing Buckets (0-30, 31-60, 61-90, 90+), Defaulters Count
- Charts: Collection trend, ageing distribution
- Quick actions: Bulk reminders, export defaulters, family view

### AgeingReport.jsx
- Tabular: Student, Class, Total Due, 0-30, 31-60, 61-90, 90+, Last Payment
- Filters: Class, Section, Category, Date Range
- Export: CSV, PDF

### DefaultersList.jsx
- Defaulters by class/amount/days
- Bulk actions: Send reminders, apply blocks, export
- Block toggle per student (hall ticket, report card, TC)

### Reminders.jsx
- Rule builder: trigger (days before/after due), channel, template
- Bulk send: select rule, filter students, preview, send
- Log: sent/failed/delivered/read with timestamps

### FollowUps.jsx
- Log follow-up: student, mode, note, promise date/amount
- View history per student
- Escalation list (unresolved > X days)

### PaymentPlans.jsx
- Create plan: total, installments, frequency, start date
- Track installments (paid/overdue)
- Approval workflow

### BlockPolicies.jsx
- Configure: trigger (days/amount/installments), block type, auto-lift
- View active blocks per student
- Manual lift with reason

## Automation
- **Scheduler**: Runs daily, checks reminder rules, queues notifications
- **Block Engine**: Runs daily, applies/lifts blocks per policy
- **Promise Alerts**: Next day follow-up on promised payments

## Acceptance
- Dashboard loads in < 2s for 2,400 students
- Ageing buckets sum = total due
- Reminder sent: logs show sent/delivered, parent receives SMS/WhatsApp/email
- Block auto-applies on trigger, auto-lifts on payment
- Follow-up with promise date → next day alert if not paid
- Payment plan: installments tracked, status updates on payment
- Family dues: combined view, single reminder for family