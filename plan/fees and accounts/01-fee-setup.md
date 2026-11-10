# Step 1 — Fee Setup

**Deliverable:** Heads, categories, structures, installments, fine/concession rules, student assignment, opening balances.  
**Exit:** A sample student shows the correct fees.

## Database

### Migration
- `sql/50_fee_setup.sql` — core tables

### Tables

```sql
-- Fee Heads
CREATE TABLE school_fee_head (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  type              TEXT NOT NULL, -- tuition, transport, hostel, exam, admission, deposit, other
  is_taxable        BOOLEAN DEFAULT false,
  tax_rate          NUMERIC(5,2) DEFAULT 0,
  income_account_id INT REFERENCES school_account(id),
  is_refundable     BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Fee Categories (e.g., new, old, staff ward, free seat)
CREATE TABLE school_fee_category (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  description       TEXT,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Fee Structure (per academic year, versioned)
CREATE TABLE school_fee_structure (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  academic_year_id  INT REFERENCES school_academic_years(id),
  name              TEXT NOT NULL,
  version           INT DEFAULT 1,
  effective_from    DATE DEFAULT CURRENT_DATE,
  is_active         BOOLEAN DEFAULT true,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_fee_structure_year_name ON school_fee_structure(app_id, academic_year_id, name) WHERE deleted_at IS NULL;

-- Fee Structure Lines (class x head x category)
CREATE TABLE school_fee_structure_line (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  structure_id      INT REFERENCES school_fee_structure(id) ON DELETE CASCADE,
  class_id          INT REFERENCES school_classes(id),
  category_id       INT REFERENCES school_fee_category(id),
  head_id           INT REFERENCES school_fee_head(id),
  amount            NUMERIC(12,2) NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_structure_line ON school_fee_structure_line(app_id, structure_id, class_id, category_id, head_id) WHERE deleted_at IS NULL;

-- Installments (per structure)
CREATE TABLE school_installment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  structure_id      INT REFERENCES school_fee_structure(id) ON DELETE CASCADE,
  name              TEXT NOT NULL, -- e.g., "Term 1", "Q1", "Monthly 1"
  due_date          DATE NOT NULL,
  share_percent     NUMERIC(5,2) NOT NULL, -- share of each head's amount
  grace_days        INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_installment_structure_name ON school_installment(app_id, structure_id, name) WHERE deleted_at IS NULL;

-- Fine Rules
CREATE TABLE school_fine_rule (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  scope             TEXT NOT NULL, -- 'all', 'head', 'installment'
  head_id           INT REFERENCES school_fee_head(id), -- if scope='head'
  installment_id    INT REFERENCES school_installment(id), -- if scope='installment'
  grace_days        INT DEFAULT 0,
  type              TEXT NOT NULL CHECK (type IN ('flat', 'per_day', 'percent')),
  flat_amount       NUMERIC(12,2),
  per_day_amount    NUMERIC(12,2),
  percent_rate      NUMERIC(5,2),
  cap_amount        NUMERIC(12,2),
  waiver_allowed    BOOLEAN DEFAULT true,
  waiver_roles      TEXT[], -- roles that can waive
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Concession Types
CREATE TABLE school_concession_type (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  name              TEXT NOT NULL,
  rule_type         TEXT NOT NULL CHECK (rule_type IN ('percent', 'amount')),
  rule_value        NUMERIC(12,2) NOT NULL,
  head_scope        TEXT NOT NULL, -- 'all' or head_id
  head_id           INT REFERENCES school_fee_head(id),
  approval_required BOOLEAN DEFAULT true,
  approval_roles    TEXT[], -- roles that can approve
  max_amount        NUMERIC(12,2), -- cap per student or total
  validity_from     DATE,
  validity_to       DATE,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Student Fee Assignment (which structure/category applies)
CREATE TABLE school_student_fee_assignment (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  structure_id      INT REFERENCES school_fee_structure(id),
  category_id       INT REFERENCES school_fee_category(id),
  effective_from    DATE NOT NULL,
  effective_to      DATE,
  transport_stop_id INT, -- for transport head
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_student_fee_assignment ON school_student_fee_assignment(app_id, student_id, effective_from) WHERE deleted_at IS NULL;

-- Family (siblings grouped under one guardian)
CREATE TABLE school_family (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  guardian_name     TEXT,
  guardian_phone    TEXT,
  guardian_email    TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

-- Family Members (link students to family)
CREATE TABLE school_family_member (
  id                SERIAL PRIMARY KEY,
  app_id            TEXT NOT NULL DEFAULT 'default',
  family_id         INT REFERENCES school_family(id) ON DELETE CASCADE,
  student_id        INT REFERENCES school_students(id) ON DELETE CASCADE,
  is_primary        BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_family_member_student ON school_family_member(app_id, student_id) WHERE deleted_at IS NULL;
```

## Backend API (server/src/routes/school_fee.js)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/school/fee/heads` | List fee heads |
| POST | `/school/fee/heads` | Create fee head |
| PUT | `/school/fee/heads/:id` | Update fee head |
| GET | `/school/fee/categories` | List fee categories |
| POST | `/school/fee/categories` | Create category |
| PUT | `/school/fee/categories/:id` | Update category |
| GET | `/school/fee/structures` | List structures (filter: year, active) |
| POST | `/school/fee/structures` | Create structure |
| PUT | `/school/fee/structures/:id` | Update structure |
| POST | `/school/fee/structures/:id/clone` | Clone structure (copy lines) |
| GET | `/school/fee/structures/:id/lines` | List lines |
| POST | `/school/fee/structures/:id/lines` | Create line |
| PUT | `/school/fee/structures/lines/:id` | Update line |
| DELETE | `/school/fee/structures/lines/:id` | Delete line |
| GET | `/school/fee/installments` | List installments (filter: structure) |
| POST | `/school/fee/installments` | Create installment |
| PUT | `/school/fee/installments/:id` | Update installment |
| GET | `/school/fee/fine-rules` | List fine rules |
| POST | `/school/fee/fine-rules` | Create fine rule |
| PUT | `/school/fee/fine-rules/:id` | Update fine rule |
| GET | `/school/fee/concession-types` | List concession types |
| POST | `/school/fee/concession-types` | Create concession type |
| PUT | `/school/fee/concession-types/:id` | Update concession type |
| GET | `/school/fee/student-assignments` | List assignments (filter: student, class) |
| POST | `/school/fee/student-assignments` | Bulk assign (by class/category or Excel) |
| PUT | `/school/fee/student-assignments/:id` | Update assignment |
| GET | `/school/fee/families` | List families |
| POST | `/school/fee/families` | Create family |
| POST | `/school/fee/families/:id/members` | Add member |
| DELETE | `/school/fee/families/:id/members/:studentId` | Remove member |

## Frontend (src/pages/school/fee/)

| Route | Component |
|-------|-----------|
| `/school/fee` | `FeeSetupDashboard.jsx` |
| `/school/fee/heads` | `FeeHeads.jsx` |
| `/school/fee/categories` | `FeeCategories.jsx` |
| `/school/fee/structures` | `FeeStructures.jsx` |
| `/school/fee/installments` | `Installments.jsx` |
| `/school/fee/fine-rules` | `FineRules.jsx` |
| `/school/fee/concession-types` | `ConcessionTypes.jsx` |
| `/school/fee/student-assignments` | `StudentAssignments.jsx` |
| `/school/fee/families` | `Families.jsx` |

## Excel Import Format (Structure)
Sheet 1 (Structure): `name, academic_year_id, version, effective_from`
Sheet 2 (Lines): `structure_name, class_name, category_name, head_name, amount`
Sheet 3 (Installments): `structure_name, name, due_date, share_percent, grace_days`

## Acceptance
- Create heads (Tuition, Transport, Hostel, Exam, Admission, Deposit) with income accounts
- Create categories (New, Old, Staff Ward, Free Seat)
- Create structure for 2026-27 with all heads × classes × categories
- Installments: Term 1 (40%), Term 2 (30%), Term 3 (30%) with due dates
- Fine rules: flat ₹50/day after 5 grace days, cap ₹500
- Concession: sibling 10% on tuition, staff 25% on tuition
- Bulk assign Class 1-A to "New" category, Class 1-B to "Old"
- Preview sample student (ADM001) shows correct fee breakdown