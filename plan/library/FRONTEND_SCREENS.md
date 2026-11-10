# Library — Frontend Screens

**Stack:** React + Bootstrap 5, using `PageShell`, `Loading`, `Empty`, `Badge`,
`downloadCsv`, `fmtDate` from `src/pages/school/fee/shared.jsx` and the
`apiGet/apiPost/apiPut/apiDelete` helpers.

All screens live in `src/pages/school/library/` and are dispatched from
`src/components/SchoolPage.jsx` when `module === 'library'`.

---

## Routes

| Route | Component | Menu label |
|---|---|---|
| `/school/library/books` | `Books.jsx` | Books & Catalog |
| `/school/library/counter` | `Counter.jsx` | Issue / Return Counter |
| `/school/library/members` | `Members.jsx` | Members |
| `/school/library/fines` | `Fines.jsx` | Fines |
| `/school/library/reports` | `Reports.jsx` | Reports |

`src/pages/school/library/shared.jsx` exports the shared library helpers:
`canLibraryView`, `canLibraryManage`, `canLibraryIssue`, `canLibraryMembers`,
`canLibraryFines`, `canLibraryReports`, `TAB_BUTTON`, status tone maps,
`today`, `money`, `Placeholder`.

---

## 1. Books & Catalog (`Books.jsx`)

File: `src/pages/school/library/Books.jsx`

Tabs: **Titles**, **Copies**, **Racks**, **Acquisition**.

- KPI strip: titles, copies, available, issued, reserved, lost/damaged.
- Titles table with search by title/ISBN/author/publisher/category.
  Columns: title, author, ISBN, category, publisher, edition, rack, copies total/available.
- Add/Edit Title form: title, subtitle, ISBN, authors multi-select, publisher, category, subject, edition, year, language, pages, price, rack, accession, status.
- Copies sub-table per title: copy code, barcode, status, condition, rack, added date.
- Add title + copies wizard: create title then generate N copies with sequential copy codes and barcodes.
- Bulk import: CSV template for titles + copies, preview, validation, import.
- Barcode printing: select copies, print labels in A4 / sticker sheet.
- Racks manager: rack code, location, shelf, capacity, verification date.
- Copy status quick actions: mark lost/damaged/reference, transfer rack, condition update.
- Acquisition log linked to title.

Permission: `library.view`; writes require `library.manage`.

UI components: `PageShell`, `DataTable`, `FormModal`, `BulkImportModal`, `BarcodePrintDialog`, `RackPicker`.

---

## 2. Issue / Return Counter (`Counter.jsx`)

File: `src/pages/school/library/Counter.jsx`

Tabs: **Scan Desk**, **Member Loans**, **Renew**, **History**.

- Scan Desk:
  - Scan box for member code and book barcode / copy code.
  - Real-time validation: member active, category limits, card expiry, copy available, reference-only check, reservation block.
  - Quick issue confirm with due date preview and slip print.
  - Return scan: compute overdue days, fine preview, accept return, update copy status, auto-check reservation queue.
- Member Loans drawer: current active loans, due dates, renewability indicator, reservation hold flag.
- Renew action: policy check, no reservation, within renewal limit, not overdue beyond grace, extends due date.
- History log for counter operator with issue/return timestamps.

Permission: `library.view`; writes require `library.issue`.

UI components: `ScanInput`, `MemberCard`, `BookCard`, `ConfirmModal`, `SlipPrint`.

---

## 3. Members (`Members.jsx`)

File: `src/pages/school/library/Members.jsx`

Tabs: **Members**, **Categories**, **Cards**, **History**.

- Members list sourced from students/staff sync.
  Filters: member type, category, status, search by name/code/roll.
  Columns: member code, name, type, category, status, card expiry, active loans, pending fines.
- Member detail drawer: profile, category limits, loan history, fine history, reservations.
- Categories setup: name, max books, loan days, renewal limit, fine per day, grace days, max fine cap, is active.
- Card issue/renew/print: generate member code, card issue date, expiry, print library card PDF.
- History: member status changes, card renewals, sync events.

Permission: `library.view`; writes require `library.members` or `library.manage`.

UI components: `SyncStatusBadge`, `CategoryForm`, `CardPrintDialog`.

---

## 4. Fines (`Fines.jsx`)

File: `src/pages/school/library/Fines.jsx`

Tabs: **Pending**, **Collection**, **Waivers**, **Rules**.

- Pending fines dashboard: member, issue, days overdue, fine amount, accrued, status.
- Collect fine workflow: select fines, payment mode, collect, post to Fees ledger idempotently, link fee invoice.
- Post to ledger batch: reconcile pending fines, generate ledger entries.
- Waiver workflow: request waiver with reason, approver selection, cannot approve own waiver, audit log.
- Fine rules: per-member category defaults, global grace days, max cap, fine per day override.
- Collection report with CSV export.

Permission: `library.view`; writes require `library.fines`; waiver approval requires `library.fines` + approver role.

UI components: `FineTable`, `WaiverModal`, `LedgerPostDialog`.

---

## 5. Reports (`Reports.jsx`)

File: `src/pages/school/library/Reports.jsx`

Report cards with date range, member/category filters and CSV/PDF export:

- Circulation summary: issues, returns, renewals per day/week/month.
- Overdue books: member, title, days overdue, fine accrued.
- Most read / Popular titles: top titles and authors by issues.
- Member activity: loans per member category, active members.
- Stock register: title, copies total, available, issued, reserved, lost/damaged, last verified.
- Rack verification report: rack code, titles, copies, discrepancy flag.
- Fine collection & waiver summary.
- Inventory reconciliation: copies vs issues vs fines variance.

Permission: `library.reports`; audit details require `library.audit`.

UI components: `ReportCard`, `DateRangePicker`, `KPIGrid`, `ExportButtons`.

---

*All screens are tenant-scoped, permission-gated, and audit-logged. Forms reuse the ERP FormEngine where applicable; Issue/Return Counter uses custom scan UI for sub-10s transactions.*
