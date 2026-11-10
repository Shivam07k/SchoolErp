# Library Module – BUILD_PLAN.md

**Module ID:** M22  
**Version:** 1.0  
**Date:** 4 November 2026  
**Status:** Plan

## Overview

Complete tenant-scoped school library circulation system covering cataloguing, copy management, member lifecycle, issue/return/renewal, reservations, fines, acquisition and reporting. Guarantees per-copy availability consistency under concurrent access, auditable state transitions for lost/damaged/waived items, and integration with Fees, Admissions, Notifications and Student/Staff identity.

**In Scope Phase 1:** Catalog, Members, Circulation, Fines & Penalties, Acquisition, Reports, Policies.
**Out of Scope Phase 1:** RFID gate automation, E-library / digital lending, Inter-library loan, OPAC public portal.

## Overall Design Summary

**Backend:** Express router `server/src/routes/school_library.js` mounted before `schoolCompRouter`.
**Frontend:** React pages `src/pages/school/library/*.jsx` under Library menu.
**Forms engine:** CRUD for catalog and members; custom UI for Issue/Return desk.
**Database:** PostgreSQL tenant-scoped tables `library_*`. Migrations `sql/80_library_core.sql`, `sql/81_library_ops.sql`. RLS enforced.
**Permissions:** `library.view`, `library.manage`, `library.issue`, `library.members`, `library.fines`, `library.reports`, `library.audit`.
**Integration:** Fees via `fee_invoices`/`ledger_entries`; Notifications via Automation Rule 5; Admissions/Student identity via `students`/`staff`; Front Office TC block.

## Dependencies

- **M07** Student Enrollment / Identity → member sync
- **M18** Staff / HR → staff library members
- **M17** Fees Accounting → fine posting, TC block
- **M08** Portals Self-Service → student/staff view
- **M26** Communication → overdue & reservation notifications
- **M30** Reports Analytics → library KPIs

## Infrastructure

**Migration files**
- `sql/80_library_core.sql` – member categories, members, categories, authors, publishers, books, copies, racks
- `sql/81_library_ops.sql` – issues, reservations, fines, acquisitions

**Backend router**
- `server/src/routes/school_library.js`
- Mounted in `server/src/index.js` before `schoolCompRouter`

**Frontend routes**
- Base: `/school/library`
- `src/pages/school/library/BooksList.jsx` → `/school/library/books`
- `src/pages/school/library/CopiesRegister.jsx` → `/school/library/copies`
- `src/pages/school/library/Members.jsx` → `/school/library/members`
- `src/pages/school/library/IssueReturnDesk.jsx` → `/school/library/issue-return`
- `src/pages/school/library/Reservations.jsx` → `/school/library/reservations`
- `src/pages/school/library/Fines.jsx` → `/school/library/fines`
- `src/pages/school/library/Acquisition.jsx` → `/school/library/acquisition`
- `src/pages/school/library/Reports.jsx` → `/school/library/reports`

**Menu:** Library > Books, Copies, Members, Issue/Return, Reservations, Fines, Acquisition, Reports

## Permissions Table

| Permission | Purpose |
|---|---|
| `library.view` | Read all library screens |
| `library.manage` | Full setup and operations – superset |
| `library.issue` | Issue / return / renew |
| `library.members` | Member categories and cards |
| `library.fines` | Fine rules, collection, waivers |
| `library.reports` | Reports and exports |
| `library.audit` | Audit and retention |

## Hard Rules - Always Blocked

- Issuing a copy already issued
- Issuing above member limit
- Issuing reference-only copy
- Issuing to inactive member
- Fine waiver without reason/approver
- Editing closed loan
- Approving own waiver
- Deleting copy with loan history
- Transfer certificate with pending book/fine

**Warn only:** member with overdue book requesting another; high demand title; copy in poor condition issued; member near fine cap; rack not verified long time

---

## Step 1 – Books

**Goal:** Catalog register loaded and labels printable.

### Database tables
- `library_categories`
- `library_authors`
- `library_publishers`
- `library_books`
- `library_copies`
- `library_racks`
- `library_acquisitions`

### Backend API endpoints
- `GET /library/categories`
- `POST /library/categories`
- `GET /library/authors`
- `POST /library/authors`
- `GET /library/publishers`
- `POST /library/publishers`
- `GET /library/books?search=&category_id=`
- `POST /library/books`
- `PUT /library/books/:id`
- `GET /library/books/:id/copies`
- `POST /library/copies`
- `PUT /library/copies/:id`
- `POST /library/acquisitions`
- `POST /library/copies/:id/barcode-print`

### Frontend screens
- Books List / Add / Edit
- Copies Register with barcode print
- Acquisition Entry

### Permission requirements
- `library.view` read
- `library.manage` create/update

### Hard rules
- Copy status must be one of available/issued/reserved/lost/damaged/reference
- Book deletion blocked if copies exist
- Copy deletion blocked with loan history

### Done When
Whole register loaded and labels print successfully; books searchable by title/ISBN/author; copies linked to rack and book.

## Step 2 – Members

**Goal:** Every active student/staff has library category/card.

### Database tables
- `library_member_categories`
- `library_members`

### Backend API endpoints
- `GET /library/member-categories`
- `POST /library/member-categories`
- `PUT /library/member-categories/:id`
- `GET /library/members?search=&status=`
- `POST /library/members/sync` – auto sync from students/staff
- `PUT /library/members/:id/status`
- `POST /library/members/:id/card-issue`

### Frontend screens
- Member Categories setup
- Members List / Search by student/staff
- Card Issue / Renew

### Permission requirements
- `library.members` manage
- `library.view` read

### Hard rules
- Member status inactive blocks new issues
- Max books, loan days, renewal limit enforced per category
- Card expiry enforced on issue

### Done When
Every active student/staff has a library member record with category/card; sync job runs on enrollment/deactivation.

## Step 3 – Issue/Return

**Goal:** Book issued in under 10 seconds with consistency.

### Database tables
- `library_issues`
- `library_copies`
- `library_members`
- `library_reservations`

### Backend API endpoints
- `POST /library/issues` – issue copy
- `GET /library/issues?member_id=&status=`
- `GET /library/issues/active`
- `POST /library/issues/:id/return` – return & fine calc
- `POST /library/issues/:id/renew` – renewal
- `GET /library/copies/:id/availability`

### Frontend screens
- Issue/Return Desk: scan barcode + member code
- Issue Slip print
- Active Loans per member

### Permission requirements
- `library.issue`

### Hard rules
- Row lock `FOR UPDATE` on copy during issue
- Block if copy issued, reference-only, member inactive, limit exceeded, reservation exists for renewal
- Due date = issue_date + category loan_days + book category rules
- Renewal blocked if overdue beyond grace or reservation exists

### Done When
A book is issued in <10s; concurrent issue of final copy allows only one success; return updates status and triggers reservation check.

## Step 4 – Fines

**Goal:** Overdue return produces correct fine automatically with auditable waiver.

### Database tables
- `library_fines`
- `library_issues`

### Backend API endpoints
- `GET /library/fines?member_id=&status=`
- `GET /library/fines/overdue`
- `POST /library/fines/:id/waive`
- `GET /library/fines/report`
- `POST /library/fines/post-to-fees` – idempotent

### Frontend screens
- Fines list & overdue dashboard
- Waiver workflow with approver reason
- Fine collection report

### Permission requirements
- `library.fines` for waiver & rules
- `library.view` read

### Hard rules
- Fine waiver requires reason + approver, cannot approve own waiver
- Auto-post to fees ledger on return, idempotent
- Max fine cap per member category enforced
- Grace days applied before fine

### Done When
Overdue return produces correct fine automatically; waiver logged with audit; fees ledger reconciliation matches.

## Step 5 – Reports

**Goal:** Circulation and overdue reports match register.

### Database tables
All library tables

### Backend API endpoints
- `GET /library/reports/circulation-summary`
- `GET /library/reports/overdue-books`
- `GET /library/reports/fine-collection`
- `GET /library/reports/book-availability`
- `GET /library/reports/popular-titles`
- `GET /library/reports/member-activity`
- `GET /library/reports/inventory-reconciliation`

### Frontend screens
- Reports dashboard with filters export CSV/PDF
- Book availability by category/rack

### Permission requirements
- `library.reports`

### Hard rules
- Reports must reconcile copies vs issues vs fines
- Transfer certificate blocked with pending book/fine

### Done When
Circulation and overdue reports match register; KPIs render <5s; exports correct.

## Step 6 – Later Optional

- RFID gate automation
- E-library / digital lending
- Inter-library loan
- OPAC public portal
- Advanced analytics & AI recommendations

---

*Deliverables: migrations, router, frontend pages, menu entry, permissions, audit logs. All tables tenant-scoped with RLS, auditable, integrated with Fees and Notifications.*
