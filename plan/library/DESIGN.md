# Library Module – Design Document

**Version:** 1.0  
**Date:** 4 November 2026  
**Module ID:** M22  
**Package ID:** M22  
**Status:** Design – Plan

---

## 1. Purpose

Provide a complete, tenant-scoped school library circulation system that covers cataloguing, copy management, member lifecycle, issue/return/renewal, reservations, fines, acquisition and reporting. The module must guarantee copy availability consistency under concurrent access, auditable state transitions for lost/damaged/waived items, and tight integration with Fees, Admissions, Notifications and Student/Staff identity.

## 2. Scope

**In scope**
- Catalog: categories, authors, publishers, subjects, books, copies with rack mapping
- Members: student/staff categories, cards, eligibility rules
- Circulation: issue, return, renewal, hold/reservation queue
- Fines & penalties: overdue calculation, posting to fees ledger, waivers with audit
- Acquisition: purchase requests, suppliers, GRN, accessioning
- Reports & analytics: circulation, overdue, fines, popular titles, member activity
- Policies: limits, due days, renewal caps, reference-only restrictions

**Out of scope – Phase 1**
- RFID gate automation
- E-library / digital lending
- Inter-library loan
- OPAC public portal

## 3. Submodules

1. **Catalog/Copies** – `library_categories`, `library_authors`, `library_publishers`, `library_books`, `library_copies`, `library_racks`
2. **Members** – `library_member_categories`, `library_members`
3. **Issue/Return/Renewal** – `library_issues`
4. **Reservations** – `library_reservations`
5. **Fines** – `library_fines`, fine rules, ledger posting
6. **Acquisition** – `library_acquisitions`, suppliers, accessioning
7. **Reports** – circulation, overdue, fines, inventory

## 4. Requirements

### Functional
- Per-copy availability tracking; title-level view aggregates copies.
- Issue blocked if copy already issued, member inactive, reference-only, member limit exceeded.
- Due date computed from member category + book category rules.
- Renewal allowed within policy, blocked if reservation exists or overdue.
- Return updates copy status, closes loan, calculates fine automatically.
- Reservation queue FIFO; auto-issue on return if eligible.
- Lost/damaged workflow with replacement cost and fine.
- Fine waiver requires permission and approver reason, audited.
- Transfer certificate / exit blocked with pending book/fine.

### Non-functional
- Tenant-scoped, RLS enforced on all tables.
- Concurrent issue of last copy: only one succeeds.
- Idempotent fine posting, no duplicate entries.
- Audit trail for all state changes.
- <10s issue/return transaction.
- Full RBAC per action.

## 5. Recommended Solution

Reuse existing ERP engine:
- **Backend:** Express router `server/src/routes/school_library.js` mounted before `schoolCompRouter`.
- **Frontend:** React pages `src/pages/school/library/*.jsx` under Library menu.
- **Forms engine:** for CRUD of catalog and members; custom UI for Issue/Return desk.
- **Database:** PostgreSQL with tables prefixed `school_library_*` / `library_*`. Migrations: `sql/80_library_core.sql`, `sql/81_library_ops.sql`.
- **Permissions:** `library.view`, `library.manage`, `library.issue`, `library.members`, `library.fines`, `library.reports`, `library.audit`.
- **Integration:** Fees via `fee_invoices`/`ledger_entries`; Notifications via Automation Rule 5; Admissions/Student identity via `students`/`staff`.

## 6. Core Design

### 6.1 Issue/Return Flow

**Issue**
1. Validate member active, category exists, limit not exceeded, no blocked exit.
2. Validate copy exists, status = available, not reference-only.
3. Lock copy row `FOR UPDATE`, check status again.
4. Create `library_issues` with `issue_date`, `due_date`, `status='issued'`.
5. Update `library_copies.status='issued'`.
6. Emit notification event; log audit.

**Return**
1. Fetch active issue, lock.
2. Compute overdue days = `CURRENT_DATE - due_date`.
3. Update issue `return_date`, `status='returned'`.
4. Update copy status = available.
5. If overdue >0, compute fine per rules, create `library_fines` and post to fees ledger.
6. Check reservation queue; if exists, notify next member.
7. Audit log.

**Renewal**
- Checks: no reservation, not overdue beyond grace, renewal count < max.
- Extend `due_date`, increment `renewal_count`, audit.

### 6.2 Mechanisms
- **Availability lock:** `SELECT ... FOR UPDATE` on copies during issue.
- **Fine engine:** tenant config `fine_per_day`, `grace_days`, `max_fine_cap`.
- **Reservation auto-issue:** daily job or trigger on return.
- **Member sync:** on student/staff enrollment/activation/deactivation, sync `library_members` status.

## 7. Data Model – A6

Tables per `sql/80_library_core.sql` and `sql/81_library_ops.sql`:

### `library_member_categories`
- `id`, `tenant_id`, `name`, `max_books`, `loan_days`, `renewal_limit`, `fine_per_day`, `is_active`

### `library_members`
- `id`, `tenant_id`, `member_code`, `member_type` ENUM('student','staff'), `person_id`, `category_id`, `status` ENUM('active','inactive','blocked'), `card_issue_date`, `card_expiry_date`, `created_at`

### `library_categories`
- `id`, `tenant_id`, `name`, `description`

### `library_authors`
- `id`, `tenant_id`, `name`

### `library_publishers`
- `id`, `tenant_id`, `name`

### `library_books`
- `id`, `tenant_id`, `isbn`, `title`, `subtitle`, `author_ids` JSON[], `publisher_id`, `category_id`, `subject`, `edition`, `publication_year`, `language`, `pages`, `price`, `rack_id`, `acc_no`, `status`

### `library_copies`
- `id`, `tenant_id`, `book_id`, `copy_code`, `barcode`, `acquisition_id`, `status` ENUM('available','issued','reserved','lost','damaged','reference'), `condition`, `rack_id`, `added_at`

### `library_racks`
- `id`, `tenant_id`, `rack_code`, `location`, `shelf`

### `library_issues`
- `id`, `tenant_id`, `issue_no`, `member_id`, `copy_id`, `book_id`, `issue_date`, `due_date`, `return_date`, `renewal_count`, `status` ENUM('issued','returned','lost','damaged'), `issued_by`, `returned_by`, `created_at`

### `library_reservations`
- `id`, `tenant_id`, `member_id`, `book_id`, `copy_id NULL`, `reserved_at`, `status` ENUM('active','fulfilled','cancelled'), `priority`

### `library_fines`
- `id`, `tenant_id`, `issue_id`, `member_id`, `fine_amount`, `fine_days`, `waived_amount`, `waived_by`, `waive_reason`, `posted_to_fees`, `fee_invoice_id`, `created_at`

### `library_acquisitions`
- `id`, `tenant_id`, `book_id`, `supplier_id`, `po_no`, `qty`, `unit_cost`, `received_date`, `acc_no`, `status`

Indexes on `(tenant_id, ...)` for all hot queries. RLS policies keyed on `tenant_id`.

## 8. Rules & Policies – A7

**Always blocked**
- Issuing a copy already issued
- Issuing above member limit
- Issuing reference-only copy
- Issuing to inactive member
- Fine waiver without reason/approver
- Editing closed loan
- Approving own waiver
- Deleting copy with loan history
- Transfer certificate with pending book/fine

**Warn only**
- Member with overdue book requesting another
- High demand title
- Copy in poor condition issued
- Member near fine cap
- Rack not verified long time

**Fine policy**
- Grace days per category, then `fine_per_day`
- Max fine cap per member category
- Auto-post to fees ledger on return
- Waiver requires `library.fines` + approval workflow

## 9. Screens – A8

**Menu:** Library > Books, Copies, Members, Issue/Return, Reservations, Fines, Acquisition, Reports

- **Books List/Add/Edit:** title, ISBN, author, publisher, category, rack, accession
- **Copies Register:** barcode print, status, condition
- **Members:** category setup, card issue, search by student/staff
- **Issue/Return Desk:** scan barcode + member code, quick issue, return, renew, real-time validation
- **Reservations:** queue view, hold, notify
- **Fines:** overdue list, fine calculation, waiver workflow, collection report
- **Acquisition:** PO, receipt, accessioning
- **Reports:** circulation summary, overdue, fines, popular books, member activity

## 10. Workflows – A9

- **Issue Workflow:** Scan → Validate → Confirm → Print slip
- **Return Workflow:** Scan → Compute fine → Accept → Update status → Reservation check
- **Renewal Workflow:** Validate policy → Extend due → Notify
- **Reservation Workflow:** Request → Queue → Fulfill on return → Notify
- **Lost/Damaged Workflow:** Report → Assess cost → Create fine/fee → Mark copy status
- **Waiver Workflow:** Request → Approve → Update fine → Audit
- **Acquisition Workflow:** Requisition → PO → Receipt → Accession → Copy creation

## 11. Integration Points – A9.5

- **Fees:** Post overdue fines to `fee_invoices`/`ledger_entries`; block TC if pending.
- **Admissions/Students:** On enrollment, auto-create library member per category; on exit, close allocations.
- **Staff:** Sync from `staff` table.
- **Notifications:** Automation Rule 5 – Library Overdue reminders via WhatsApp/Email/Push; reservation available alerts.
- **Front Office:** Certificate requests blocked with pending items.
- **Reports:** Library KPIs in central Reports & Analytics.
- **Audit:** All actions logged to `audit_logs`.

## 12. Roles, Alerts & Reports – A10

**Permissions**
- `library.view` – read screens
- `library.manage` – full setup
- `library.issue` – issue/return/renew
- `library.members` – member categories/cards
- `library.fines` – fine rules, waivers
- `library.reports` – export
- `library.audit` – audit & retention

**Alerts**
- Overdue due date crossed → daily job + notification
- Reservation fulfilled
- Fine cap reached
- Copy lost/damaged reported
- Member limit exceeded attempt

**Reports**
- Circulation summary
- Overdue books
- Fine collection & waiver
- Book availability by category/rack
- Most borrowed titles
- Member activity

## 13. Scenario Coverage – A11

- Concurrent issue of final copy: only one succeeds via row lock.
- Overdue date/time boundaries, renewal limit enforcement.
- Reservation queue FIFO and auto-issue.
- Lost/damaged copy state transition with audit.
- Fine waiver requires permission + audit, archive/exit explicit.
- Reconcile catalog copies, circulation, fines reports.
- Transfer certificate blocked with pending book/fine.
- Member deactivation blocks new issues.

## 14. Build Plan – A12

1. **Books** – register loaded, labels print
2. **Members** – every active student/staff has category/card
3. **Issue/Return** – book issued in <10s
4. **Fines** – overdue return produces correct fine automatically
5. **Reports** – circulation and overdue reports match register
6. **Later optional** – RFID gates, e-library, inter-library loan

Deliverables: migrations, router, frontend pages, menu entry, permissions.

## 15. Open Decisions – A13

- Per-copy vs title-level stock semantics final confirmation
- Barcode format and printer integration
- Fine calculation: per day vs flat rate, grace handling
- Reference-only copy handling in search
- E-library DRM integration scope
- Inter-library loan policy
- RFID gate integration timeline
- Public OPAC read-only access

---

*Design aligns with M22 library module and ERP master architecture. All tables tenant-scoped with RLS, auditable, and integrated with Fees and Notifications.*
