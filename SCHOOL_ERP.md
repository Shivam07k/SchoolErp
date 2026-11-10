# School ERP - Complete Project Documentation

## Project Overview

**School ERP** is a comprehensive school management system built with:
- **Frontend**: React 19 + Vite 7 (ESM, client-side routing via hash)
- **Backend**: Node.js + Express (ESM) with PostgreSQL 18
- **Authentication**: JWT-based with role-based permissions
- **Architecture**: Monorepo with `/server` (API) and `/src` (React app)

---

## Folder Structure

```
SchoolErp/
â”œâ”€â”€ public/                    # Static assets served by Express
â”œâ”€â”€ src/                       # React frontend
â”‚   â”œâ”€â”€ api.js                 # API helpers (apiGet, apiPost, apiPut, apiDelete)
â”‚   â”œâ”€â”€ app.jsx                # Root app, hash routing, SchoolPage lazy load
â”‚   â”œâ”€â”€ components/            # Shared UI components
â”‚   â”‚   â”œâ”€â”€ SchoolPage.jsx     # Main route dispatcher (module/sub/rest)
â”‚   â”‚   â”œâ”€â”€ SchoolSidebar.jsx  # Navigation sidebar
â”‚   â”‚   â”œâ”€â”€ LoginPage.jsx      # Login form
â”‚   â”‚   â”œâ”€â”€ PrintButton.jsx    # Print utility
â”‚   â”‚   â””â”€â”€ ...               # Toast, ThemeSettings, LogsPanel, StudentProfile, etc.
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â””â”€â”€ school/           # School module pages
â”‚   â”‚       â”œâ”€â”€ admissions/   # Admission & CRM
â”‚   â”‚       â”œâ”€â”€ academics/    # Classes, subjects, years, allocations, rooms, homework
â”‚   â”‚       â”œâ”€â”€ attendance/   # Mark, Register, Corrections, Staff, Reports
â”‚   â”‚       â”œâ”€â”€ examinations/ # Exam dashboard, setup, marks, results, report cards, schedule
â”‚   â”‚       â”œâ”€â”€ fee/          # Fees & Accounts (6 main screens + sub-pages)
â”‚   â”‚       â”œâ”€â”€ students/     # Students, promotion, TC, documents, health, discipline
â”‚   â”‚       â””â”€â”€ timetable/    # Master, teacher, student, substitutions
â”‚   â”œâ”€â”€ school/
â”‚   â”‚   â””â”€â”€ menu.js           # Navigation definition (keys, paths, permissions)
â”‚   â”œâ”€â”€ toast.js              # Toast notifications
â”‚   â”œâ”€â”€ theme.js              # Theme utilities
â”‚   â”œâ”€â”€ utils.js              # Navigation helper (navigate)
â”‚   â””â”€â”€ main.jsx              # React entry point
â”œâ”€â”€ server/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ index.js          # Express app, middleware, route mounting
â”‚   â”‚   â”œâ”€â”€ config/
â”‚   â”‚   â”‚   â”œâ”€â”€ env.js        # Environment config
â”‚   â”‚   â”‚   â””â”€â”€ companies.js  # Multi-tenant company config
â”‚   â”‚   â”œâ”€â”€ db/
â”‚   â”‚   â”‚   â”œâ”€â”€ pool.js       # PostgreSQL pool per company
â”‚   â”‚   â”‚   â””â”€â”€ sp.js         # execQ helper (returns rows directly)
â”‚   â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.js       # JWT verification, sets req.school, req.user
â”‚   â”‚   â”‚   â””â”€â”€ error.js      # Global error handler
â”‚   â”‚   â”œâ”€â”€ logging/
â”‚   â”‚   â”‚   â”œâ”€â”€ als.js        # AsyncLocalStorage for request context
â”‚   â”‚   â”‚   â””â”€â”€ sql.js        # SQL logging
â”‚   â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.js       # Login, logout, refresh, password reset
â”‚   â”‚   â”‚   â”œâ”€â”€ menu.js       # Menu permissions, role definitions
â”‚   â”‚   â”‚   â”œâ”€â”€ dash.js       # Dashboard widgets
â”‚   â”‚   â”‚   â”œâ”€â”€ logs.js       # Audit logs
â”‚   â”‚   â”‚   â”œâ”€â”€ schema.js     # Dynamic form/table schemas
â”‚   â”‚   â”‚   â”œâ”€â”€ crud.js       # Generic CRUD for any table
â”‚   â”‚   â”‚   â”œâ”€â”€ security.js   # Roles, permissions, users
â”‚   â”‚   â”‚   â”œâ”€â”€ customfields.js # Custom field definitions
â”‚   â”‚   â”‚   â”œâ”€â”€ schoolFoundation.js # Core: companies, years, campuses, classes, sections, subjects
â”‚   â”‚   â”‚   â”œâ”€â”€ school.js     # Legacy: students, staff, attendance, fees (old), automation
â”‚   â”‚   â”‚   â”œâ”€â”€ school_comprehensive.js # Transport, library, hostel, inventory, HR, circulars, PTM, helpdesk, surveys, events, certificates, houses
â”‚   â”‚   â”‚   â”œâ”€â”€ school_exam.js # Examinations: terms, exams, papers, marks, results, report cards, schedule
â”‚   â”‚   â”‚   â”œâ”€â”€ school_fee.js # Fee Setup (master data): heads, categories, structures, installments, fines, concessions, assignments, families
â”‚   â”‚   â”‚   â”œâ”€â”€ school_fee_ops.js # Fee Operations: collection, dues, refunds, reconciliation, accounts
â”‚   â”‚   â”‚   â”œâ”€â”€ school_students_complete.js # DEAD CODE (not mounted)
â”‚   â”‚   â”‚   â”œâ”€â”€ school_admissions.js # Admissions inquiries/applications (mounted on schoolRouter)
â”‚   â”‚   â”‚   â”œâ”€â”€ school_uploads.js # File uploads (mounted on schoolRouter)
â”‚   â”‚   â”‚   â”œâ”€â”€ school_academics.js # Academic years, subjects, allocations, rooms, homework (mounted on schoolRouter)
â”‚   â”‚   â”‚   â””â”€â”€ school_more.js # Lesson plans, exams, timetable, substitutions, visitors, health, discipline, leaves, promotions, TC, stats (mounted on schoolRouter)
â”‚   â”‚   â”œâ”€â”€ school/
â”‚   â”‚   â”‚   â”œâ”€â”€ foundation.js # Permissions, roles, audit helpers, room/teacher utilities
â”‚   â”‚   â”‚   â”œâ”€â”€ rooms.js      # Room conflict detection
â”‚   â”‚   â”‚   â””â”€â”€ staff.js      # Teacher resolution
â”‚   â”‚   â””â”€â”€ uploads/
â”‚   â”‚       â”œâ”€â”€ middleware.js # Multer upload handling
â”‚   â”‚       â””â”€â”€ service.js    # File storage service
â”‚   â”œâ”€â”€ setup.mjs             # Legacy setup
â”‚   â”œâ”€â”€ _schoolsetup.mjs      # Current setup script
â”‚   â””â”€â”€ package.json
â”œâ”€â”€ sql/                       # Database migrations (numbered)
â”‚   â”œâ”€â”€ 19_school_core.sql    # Core tables (students, classes, fee_invoices, fee_payments)
â”‚   â”œâ”€â”€ 40_exam_setup.sql     # Exams, terms, papers, schedules
â”‚   â”œâ”€â”€ 41_grade_setup.sql    # Grade scales, bands, result rules
â”‚   â”œâ”€â”€ 42_marks_entry.sql    # Marks sheets, entries, corrections
â”‚   â”œâ”€â”€ 43_results.sql        # Result versions, subject results, student results
â”‚   â”œâ”€â”€ 44_report_cards.sql   # Report cards, templates
â”‚   â”œâ”€â”€ 45_exam_schedule.sql  # Halls, seating, invigilation, hall tickets
â”‚   â”œâ”€â”€ 50_fee_setup.sql      # Fee heads, categories, structures, installments, fines, concessions, assignments, families
â”‚   â”œâ”€â”€ 51_invoices_collection.sql # Invoices, receipts, cheques, online payments, cashier day, ledger
â”‚   â”œâ”€â”€ 52_dues_followup.sql  # Reminders, follow-ups, payment plans, block policies
â”‚   â”œâ”€â”€ 53_refunds.sql        # Refund rules, requests, approvals, credit notes, deposits
â”‚   â”œâ”€â”€ 54_reconciliation.sql # Bank statements, gateway settlements, match exceptions, cashier exceptions
â”‚   â”œâ”€â”€ 55_accounts_core.sql  # Chart of accounts, vouchers, vendors, audit log
â”‚   â”œâ”€â”€ 56_online_payments.sql # Gateway config, payment links, webhooks
â”‚   â””â”€â”€ 57_reports_hardening.sql # Indexes, materialized views, audit triggers, report views
â”œâ”€â”€ package.json              # Root: dev, build, start scripts
â”œâ”€â”€ vite.config.js            # Vite config
â”œâ”€â”€ SCHOOL_ERP.md             # This file
â””â”€â”€ README.md                 # Project readme
```

---

## Routing & Navigation Flow

### 1. Hash-Based Client Routing (`src/app.jsx`)

```javascript
function parseSchoolHash() {
  const hash = window.location.hash || '#/school/dashboard';
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] !== 'school') return { module: 'dashboard', sub: '', rest: [] };
  return { module: parts[1] || 'dashboard', sub: parts[2] || '', rest: parts.slice(3) };
}
```

| Hash | module | sub | rest |
|------|--------|-----|------|
| `#/school/dashboard` | `dashboard` | `` | `[]` |
| `#/school/fees` | `fees` | `` | `[]` |
| `#/school/fees/setup` | `fees` | `setup` | `[]` |
| `#/school/examinations/marks/sheet/123` | `examinations` | `marks` | `['sheet', '123']` |
| `#/school/fee/heads` | `fee` | `heads` | `[]` |

### 2. Menu Definition (`src/school/menu.js`)

```javascript
export const SCHOOL_MENU = [
  { group: 'Core', key: 'dashboard', path: '/school/dashboard', built: true },
  { 
    group: 'Core', key: 'admission', path: '/school/admission', built: true,
    children: [
      { key: 'leads', path: '/school/admission/leads', built: true },
      { key: 'applications', path: '/school/admission/applications', built: true },
    ]
  },
  {
    group: 'Finance', key: 'fees', label: 'Fees & Accounts', icon: 'bi-cash-coin', perm: 'fees.view', built: true,
    children: [
      { key: 'collect', label: 'Invoices & Collection', path: '/school/fees', built: true },
      { key: 'setup', label: 'Fee Setup', path: '/school/fees/setup', built: true },
      { key: 'dues', label: 'Dues & Follow-up', path: '/school/fees/dues', built: true },
      { key: 'refunds', label: 'Refunds', path: '/school/fees/refunds', built: true },
      { key: 'reconcile', label: 'Reconciliation', path: '/school/fees/reconcile', built: true },
      { key: 'accounts', label: 'Accounts', path: '/school/fees/accounts', built: true },
    ]
  },
  // ... more modules
];
```

### 3. Route Dispatcher (`src/components/SchoolPage.jsx`)

```javascript
// Receives: module, sub, rest, me, campusId, academicYearId, onNavigate
if (module === 'fee' || module === 'fees') {
  if (!sub || sub === 'collect') return <CollectionDashboard />;
  if (sub === 'setup') return <FeeSetupDashboard />;
  if (sub === 'heads') return <FeeHeads />;
  if (sub === 'dues' || sub === 'follow-up') return <DuesDashboard />;
  if (sub === 'refunds') return <RefundsDashboard />;
  if (sub === 'reconcile' || sub === 'reconciliation') return <ReconciliationDashboard />;
  if (sub === 'accounts') return <AccountsDashboard />;
  // ... sub-pages for heads, categories, structures, etc.
}

if (module === 'examinations') {
  if (!sub || sub === 'dashboard') return <ExamDashboard />;
  if (sub === 'setup') return <ExamSetup />;
  if (sub === 'marks') {
    if (rest[0] === 'sheet' && rest[1]) return <MarksEntry sheetId={rest[1]} />;
    return <MarksDashboard />;
  }
  if (sub === 'results') return <ResultsDashboard />;
  if (sub === 'report-cards') return <ReportCardsDashboard />;
  if (sub === 'schedule') return <ExamSchedule />;
  // ...
}
```

---

## Backend Architecture

### 1. Multi-Tenant Database Pool (`server/src/db/pool.js`)

- Each company = separate PostgreSQL database
- `contextMiddleware` reads JWT â†’ `req.school.company` â†’ picks correct pool
- `getPool()` returns pool for current request's company

### 2. Authentication Flow (`server/src/middleware/auth.js`)

```
Request â†’ verifyToken middleware
  â†’ Decodes JWT
  â†’ Sets req.user (userid, name, permissions, isSuper)
  â†’ Sets req.school (appId, permissions, isSuper)
  â†’ Attaches company-specific pool via ALS
```

### 3. Route Mounting (`server/src/index.js`)

```javascript
app.use('/api/auth', authRouter);           // Public
app.use('/api/crud', crudRouter);           // Generic CRUD
app.use('/api/schema', schemaRouter);       // Form schemas
app.use('/api', menuRouter);                // Menu + roles
app.use('/api', dashRouter);                // Dashboard
app.use('/api', logsRouter);                // Audit logs
app.use('/api/security', securityRouter);   // Users/roles/perms
app.use('/api/customfields', customFieldRouter);

app.use('/api/school', schoolFoundationRouter);  // Core setup
app.use('/api/school', schoolRouter);            // Legacy + admissions/uploads/academics/more
app.use('/api/school', schoolCompRouter);        // Transport, library, hostel, inventory, HR
app.use('/api/school', schoolExamRouter);        // Examinations
app.use('/api/school', schoolFeeRouter);         // Fee Setup (master data)
app.use('/api/school', schoolFeeOpsRouter);      // Fee Operations (new)
```

### 4. Permission System (`server/src/school/foundation.js`)

```javascript
// Module permissions: {module}.view, {module}.manage
// Granular: homework.create, homework.publish, timetable.teacher, etc.

// Role definitions:
SUPER_ADMIN    â†’ ALL permissions
OWNER          â†’ ALL except platform.*
PRINCIPAL      â†’ ALL except platform.*, settings.manage
ADMIN_OFFICER  â†’ admission, students, academics, timetable, attendance, exams, communication, frontoffice, events, certificates, homework + fees.view
ACCOUNTANT     â†’ fees.*, reports.* + dashboard, students.view
TEACHER        â†’ attendance, exams, lms, communication + homework.*, timetable.teacher
CLASS_TEACHER  â†’ TEACHER + students.*, fees.view
PARENT         â†’ dashboard, students, attendance, exams, fees, communication, lms, events, certificates, homework (view only)
STUDENT        â†’ dashboard, academics, timetable, attendance, exams, fees, communication, lms, events, library + homework.view, homework.submit
```

---

## API Endpoints Reference

### Core Modules

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| **Auth** | `/api/auth` | `POST /login`, `POST /logout`, `POST /refresh`, `POST /forgot-password` |
| **Menu** | `/api` | `GET /menu`, `GET /roles`, `POST /roles`, `PUT /roles/:id` |
| **Dashboard** | `/api` | `GET /dashboard/summary`, `GET /dashboard/widgets` |
| **Schema** | `/api/schema` | `GET /tables`, `GET /table/:name`, `POST /table` |
| **CRUD** | `/api/crud` | `POST /` (action: list, get, create, update, delete) |
| **Security** | `/api/security` | `GET /users`, `POST /users`, `PUT /users/:id`, `GET /permissions` |

### School Foundation (`schoolFoundationRouter`)

| Area | Endpoints |
|------|-----------|
| **Companies** | `GET /companies`, `POST /companies`, `PUT /companies/:id` |
| **Academic Years** | `GET /academic-years`, `POST /academic-years`, `PUT /:id`, `POST /:id/activate` |
| **Campuses** | `GET /campuses`, `POST /campuses`, `PUT /:id` |
| **Classes** | `GET /classes`, `POST /classes`, `PUT /:id`, `DELETE /:id` |
| **Sections** | `GET /sections`, `POST /sections`, `PUT /:id`, `DELETE /:id` |
| **Subjects** | `GET /subjects`, `POST /subjects`, `PUT /:id`, `DELETE /:id` |
| **Staff** | `GET /staff`, `POST /staff`, `PUT /:id`, `DELETE /:id` |

### Fee Setup (`schoolFeeRouter` - `/api/school/fee/*`)

| Resource | Endpoints |
|----------|-----------|
| **Fee Heads** | `GET /heads`, `POST /heads`, `PUT /heads/:id`, `DELETE /heads/:id` |
| **Categories** | `GET /categories`, `POST /categories`, `PUT /:id`, `DELETE /:id` |
| **Structures** | `GET /structures`, `POST /structures`, `PUT /:id`, `POST /:id/clone`, `GET /:id/lines`, `POST /:id/lines`, `PUT /lines/:id`, `DELETE /lines/:id` |
| **Installments** | `GET /installments`, `POST /installments`, `PUT /:id`, `DELETE /:id` |
| **Fine Rules** | `GET /fine-rules`, `POST /fine-rules`, `PUT /:id`, `DELETE /:id` |
| **Concessions** | `GET /concession-types`, `POST /concession-types`, `PUT /:id`, `DELETE /:id` |
| **Student Assignments** | `GET /student-assignments`, `POST /student-assignments`, `PUT /:id` |
| **Families** | `GET /families`, `POST /families`, `POST /:id/members`, `DELETE /:familyId/members/:studentId` |

### Fee Operations (`schoolFeeOpsRouter` - `/api/school/fee/*`)

| Feature | Endpoints |
|---------|-----------|
| **Collection** | `GET /collection`, `POST /invoices`, `POST /invoices/:id/cancel`, `POST /receipts` |
| **Setup Overview** | `GET /setup-overview` |
| **Dues & Follow-up** | `GET /dues`, `POST /follow-ups`, `POST /reminders`, `POST /reminder-rules` |
| **Refunds** | `GET /refunds`, `POST /refunds`, `POST /refunds/:id/approve`, `POST /refunds/:id/reject`, `POST /refunds/:id/pay` |
| **Reconciliation** | `GET /reconciliation`, `POST /cashier-days`, `POST /cashier-days/:id/close`, `POST /cheques/:id/status`, `POST /exceptions/:id/resolve` |
| **Accounts** | `GET /accounts`, `POST /accounts`, `POST /vouchers` |

### Examinations (`schoolExamRouter` - `/api/school/exam/*`)

| Area | Endpoints |
|------|-----------|
| **Terms** | `GET /terms`, `POST /terms`, `PUT /terms/:id` |
| **Exams** | `GET /exams`, `POST /exams`, `PUT /:id`, `GET /:id` |
| **Papers** | `GET /papers`, `POST /papers`, `PUT /:id`, `DELETE /:id`, `GET /:id/components`, `POST /:id/components` |
| **Grade Scales** | `GET /grade-scales`, `POST /grade-scales`, `GET /:id/bands`, `POST /:id/bands`, `PUT /grade-bands/:id` |
| **Result Rules** | `GET /result-rules`, `POST /result-rules`, `PUT /:id`, `POST /preview` |
| **Report Templates** | `GET /report-templates`, `POST /report-templates`, `PUT /:id` |
| **Marks Sheets** | `GET /marks-sheets/dashboard`, `GET /marks-sheets`, `POST /marks-sheets/ensure`, `GET /:id`, `POST /:id/entries`, `POST /:id/submit`, `POST /:id/verify`, `POST /:id/lock`, `POST /:id/reopen` |
| **Results** | `POST /result-versions`, `GET /result-versions`, `POST /:id/process`, `POST /:id/publish`, `GET /:id/subject-results` |
| **Report Cards** | `GET /report-cards`, `POST /report-cards/generate`, `POST /:id/publish`, `POST /:id/withhold`, `GET /:id/preview` |
| **Schedule** | `GET /schedule`, `POST /schedule`, `PUT /halls/:id`, `POST /seating/generate`, `POST /invigilation`, `GET /hall-tickets`, `POST /hall-tickets/generate` |
| **Reports** | `GET /reports/:type` (17 report types) |

### Legacy + Extended (mounted on `schoolRouter`)

| File | Endpoints Added to `schoolRouter` |
|------|-----------------------------------|
| `school_admissions.js` | `/admissions/inquiries*`, `/admissions/applications*` |
| `school_uploads.js` | `POST /uploads`, `GET /uploads/:appId/:year/:context/:fileName` |
| `school_academics.js` | `/academic-years*`, `/academics/teachers`, `/subjects*`, `/subject-allocations*`, `/rooms*`, `/homework*` |
| `school_more.js` | `/lesson-plans*`, `/exams/timetable`, `/exams/marks`, `/exams/report-card`, `/timetable*`, `/periods*`, `/substitutions*`, `/visitors*`, `/gate-passes*`, `/health`, `/discipline`, `/leaves*`, `/promotions*`, `/tc/request`, `/stats/overview` |

---

## Database Schema (Key Tables)

### Core
- `school_students` - Student master
- `school_classes` / `school_sections` - Class/section hierarchy
- `school_academic_years` - Academic year management
- `school_campuses` - Multi-campus support
- `school_subjects` - Subject catalog

### Fee & Accounts
- `school_fee_head` / `school_fee_category` - Fee classification
- `school_fee_structure` / `school_fee_structure_line` - Fee structures per year/class
- `school_installment` - Installment schedules
- `school_fine_rule` / `school_concession_type` - Penalties & discounts
- `school_student_fee_assignment` - Student â†’ structure mapping
- `school_family` / `school_family_member` - Sibling grouping
- `school_invoice` / `school_invoice_line` - Invoices with line items
- `school_receipt` / `school_receipt_allocation` - Payments with allocation
- `school_cheque` / `school_online_payment` - Payment instruments
- `school_cashier_day` - Daily cashier open/close
- `school_ledger_entry` - Immutable student ledger
- `school_reminder_rule` / `school_reminder_log` - Automated reminders
- `school_follow_up` - Manual collection follow-ups
- `school_payment_plan` / `school_payment_plan_installment` - Installment plans for defaulters
- `school_block_policy` / `school_student_block` - Auto-block defaulters
- `school_refund_rule` / `school_refund_request` / `school_refund_approval` - Refund workflow
- `school_credit_note` / `school_deposit` - Credit notes & security deposits
- `school_bank_statement_line` / `school_gateway_settlement` / `school_match_exception` - Reconciliation
- `school_account_group` / `school_account` - Chart of accounts
- `school_voucher_type` / `school_voucher` / `school_voucher_line` - Double-entry bookkeeping
- `school_vendor` / `school_vendor_bill` - Vendor management
- `school_audit_log` - Complete audit trail

### Examinations
- `school_term` - Academic terms
- `school_exam` - Exam definitions
- `school_exam_paper` / `school_paper_component` - Papers & components
- `school_grade_scale` / `school_grade_band` - Grading system
- `school_result_rule` - Result computation rules
- `school_exam_timetable` / `school_exam_slot` - Schedule
- `school_exam_hall` / `school_seat_allocation` - Halls & seating
- `school_invigilation` - Invigilation duties
- `school_hall_ticket` - Hall tickets
- `school_marks_sheet` - Marks entry sheets
- `school_mark_entry` - Individual marks
- `school_result_version` / `school_subject_result` / `school_student_result` - Results
- `school_report_template` / `school_report_card` - Report cards

### Attendance
- `school_attendance_register` - Daily register per section/date
- `school_attendance_entry` - Student entries
- `school_attendance_correction` - Correction workflow
- `school_staff_attendance` - Staff attendance

### Timetable
- `school_timetables` / `school_timetable_versions` - Timetable versions
- `school_periods` - Period definitions
- `school_substitutions` - Teacher substitutions

---

## Frontend Screens Map

### Fees & Accounts (`src/pages/school/fee/`)

| Screen | File | Route | Description |
|--------|------|-------|-------------|
| **Invoices & Collection** | `CollectionDashboard.jsx` | `/school/fees` | Invoice list, create invoice, collect payment, receipts |
| **Fee Setup** | `FeeSetupDashboard.jsx` | `/school/fees/setup` | Overview cards â†’ heads, categories, structures, installments, fines, concessions, assignments, families |
| **Fee Heads** | `FeeHeads.jsx` | `/school/fees/heads` | CRUD fee heads with tax, income account mapping |
| **Categories** | `FeeCategories.jsx` | `/school/fees/categories` | Student categories (New, Old, Staff Ward, etc.) |
| **Structures** | `PlaceholderComponents.jsx` | `/school/fees/structures` | Fee structures per year (placeholder) |
| **Installments** | `PlaceholderComponents.jsx` | `/school/fees/installments` | Installment schedules (placeholder) |
| **Fine Rules** | `PlaceholderComponents.jsx` | `/school/fees/fine-rules` | Late fine configuration (placeholder) |
| **Concessions** | `PlaceholderComponents.jsx` | `/school/fees/concession-types` | Concession rules (placeholder) |
| **Student Assignments** | `PlaceholderComponents.jsx` | `/school/fees/student-assignments` | Assign students to structures (placeholder) |
| **Families** | `PlaceholderComponents.jsx` | `/school/fees/families` | Sibling grouping (placeholder) |
| **Dues & Follow-up** | `DuesDashboard.jsx` | `/school/fees/dues` | Ageing buckets, defaulters, follow-ups, reminders, payment plans |
| **Refunds** | `RefundsDashboard.jsx` | `/school/fees/refunds` | Refund requests, approval chain, credit notes, deposits |
| **Reconciliation** | `ReconciliationDashboard.jsx` | `/school/fees/reconcile` | Cashier days, cheques, gateway, bank, exceptions |
| **Accounts** | `AccountsDashboard.jsx` | `/school/fees/accounts` | Chart of accounts, vouchers, trial balance |

### Examinations (`src/pages/school/examinations/`)

| Screen | File | Route | Description |
|--------|------|-------|-------------|
| **Dashboard** | `ExamDashboard.jsx` | `/school/examinations` | Overview |
| **Setup** | `ExamSetup.jsx` | `/school/examinations/setup` | Terms, exams, papers, grade scales, result rules |
| **Marks Dashboard** | `MarksDashboard.jsx` | `/school/examinations/marks` | Marks sheets list, create, submit, verify, lock |
| **Marks Entry** | `MarksEntry.jsx` | `/school/examinations/marks/sheet/:id` | Grid entry with validation |
| **Marks Tools** | `MarksTools.jsx` | `/school/examinations/marks/import\|corrections\|moderation` | Import, corrections, moderation |
| **Results** | `ResultsDashboard.jsx` | `/school/examinations/results` | Process, publish, filters, subject drill-down |
| **Report Cards** | `ReportCardsDashboard.jsx` | `/school/examinations/report-cards` | Generate, publish, preview, withhold |
| **Templates** | `ReportCardTemplates.jsx` | `/school/examinations/report-cards/templates` | Template designer |
| **Schedule** | `ExamSchedule.jsx` | `/school/examinations/schedule` | Date sheet, halls, seating |
| **Schedule Tools** | `ScheduleTools.jsx` | `/school/examinations/schedule/date-sheet\|seating\|invigilation\|hall-tickets` | Tools for schedule |
| **Reports** | `Reports.jsx` | `/school/examinations/reports` | 17 report types |

### Attendance (`src/pages/school/attendance/`)

| Screen | File | Route |
|--------|------|-------|
| **Mark Attendance** | `MarkAttendance.jsx` | `/school/attendance/mark` |
| **Register** | `Register.jsx` | `/school/attendance/register` |
| **Corrections** | `Corrections.jsx` | `/school/attendance/corrections` |
| **Staff Attendance** | `StaffAttendance.jsx` | `/school/attendance/staff` |
| **Reports** | `Reports.jsx` | `/school/attendance/reports` |

### Timetable (`src/pages/school/timetable/`)

| Screen | File | Route |
|--------|------|-------|
| **Master** | `TimetableMaster.jsx` | `/school/timetable/master` |
| **Teacher** | `TeacherTimetable.jsx` | `/school/timetable/teacher` |
| **Student** | `StudentTimetable.jsx` | `/school/timetable/student` |
| **Substitutions** | `Substitutions.jsx` | `/school/timetable/substitutions` |

### Academics (`src/pages/school/academics/`)

| Screen | File | Route |
|--------|------|-------|
| **Classes & Sections** | `ClassesSections.jsx` | `/school/academics/classes` |
| **Subjects** | `Subjects.jsx` | `/school/academics/subjects` |
| **Academic Years** | `AcademicYears.jsx` | `/school/academics/years` |
| **Subject Allocation** | `SubjectAllocation.jsx` | `/school/academics/allocation` |
| **Rooms** | `Rooms.jsx` | `/school/academics/rooms` |
| **Homework** | `Homework.jsx` | `/school/academics/homework` |

### Admissions (`src/pages/school/admissions/`)

| Screen | File | Route |
|--------|------|-------|
| **Leads** | `Leads.jsx` | `/school/admission/leads` |
| **Applications** | `Applications.jsx` | `/school/admission/applications` |

### Students (`src/pages/school/students/`)

| Screen | File | Route |
|--------|------|-------|
| **Students List** | `Students.jsx` | `/school/students` |
| **Promotion** | `Promotion.jsx` | `/school/students/promotion` |
| **Transfer/Exit** | `TransferExit.jsx` | `/school/students/tc` |
| **Documents** | `Documents.jsx` | `/school/students/documents` |
| **Health** | `Health.jsx` | `/school/students/health` |
| **Discipline** | `Discipline.jsx` | `/school/students/discipline` |

---

## Development Workflow

### 1. Start Development Servers

```bash
# Terminal 1: API + Frontend (concurrently)
npm run dev

# Or separately:
# Terminal 1: API
cd server && npm run dev
# Terminal 2: Frontend
npm run dev
```

- API: http://localhost:3100
- Frontend: http://localhost:5173 (or 5174 if 5173 busy)

### 2. Login Credentials

```
User ID: admin
Password: <local-admin-password>
Company: school_erp
```

### 3. Database Setup

```bash
cd server
npm run setup:school    # Runs _schoolsetup.mjs - applies all SQL migrations
```

### 4. Build for Production

```bash
npm run build      # Vite build â†’ dist/
npm start          # Production server (serves dist/ + API)
```

---

## Key Implementation Patterns

### 1. API Helpers (`src/api.js`)

```javascript
export async function apiGet(url) {
  const res = await fetch(`${API_BASE}${url}`, { 
    headers: { Authorization: `Bearer ${getToken()}` } 
  });
  const data = await res.json();
  if (data.error) console.warn('API warning:', url, data.error);
  return data;  // Caller must check data.ok
}

export async function apiPost(url, data) {
  const res = await fetch(`${API_BASE}${url}`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, 
    body: JSON.stringify(data) 
  });
  return res.json();
}
```

### 2. Page Shell (`src/pages/school/fee/shared.jsx`)

```javascript
export const PageShell = ({ title, icon, subtitle, actions, children }) => (
  <div className="page-content animate-fade">
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <div className="card-title mb-0"><i className={`bi ${icon} me-2`}></i>{title}</div>
          {subtitle && <div className="text-muted small mt-1">{subtitle}</div>}
        </div>
        <div className="d-flex gap-2 flex-wrap">{actions}</div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  </div>
);
```

### 3. Backend Route Helper (`server/src/routes/school_fee_ops.js`)

```javascript
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const guard = (req, res, perm) => {
  if (!req.school || !req.user) return res.status(401).json({ error: 'Unauthorized' });
  const perms = req.school.permissions || [];
  const alt = perm === 'fee.setup' ? ['fees.manage', 'fees.view', 'fee.manage'] : 
              perm === 'fee.view' ? ['fees.view', 'fees.manage'] : [];
  if (req.school.isSuper || perms.includes('*') || perms.includes(perm) || alt.some(p => perms.includes(p))) return true;
  res.status(403).json({ error: 'Forbidden' });
  return false;
};
```

### 4. Database Helper (`server/src/db/sp.js`)

```javascript
export async function execQ(pool, text, values = []) {
  const res = await pool.query(text, values);
  return res.rows;  // Returns rows array directly
}
```

---

## Permission Matrix

| Feature | ACCOUNTANT | ADMIN_OFFICER | PRINCIPAL | TEACHER | CLASS_TEACHER | PARENT | STUDENT |
|---------|------------|---------------|-----------|---------|---------------|--------|---------|
| Fee Setup (heads, structures) | âœ… manage | âœ… view | âœ… manage | âŒ | âŒ | âŒ | âŒ |
| Invoices & Collection | âœ… manage | âœ… view | âœ… manage | âŒ | âŒ | âœ… view | âœ… view |
| Dues & Follow-up | âœ… manage | âœ… view | âœ… manage | âŒ | âœ… view | âŒ | âŒ |
| Refunds | âœ… manage | âœ… view | âœ… manage | âŒ | âŒ | âŒ | âŒ |
| Reconciliation | âœ… manage | âœ… view | âœ… manage | âŒ | âŒ | âŒ | âŒ |
| Accounts | âœ… manage | âœ… view | âœ… manage | âŒ | âŒ | âŒ | âŒ |
| Examinations Setup | âŒ | âœ… manage | âœ… manage | âŒ | âŒ | âŒ | âŒ |
| Marks Entry | âŒ | âœ… manage | âœ… manage | âœ… manage | âœ… manage | âŒ | âŒ |
| Results | âŒ | âœ… manage | âœ… manage | âœ… view | âœ… view | âœ… view | âœ… view |
| Report Cards | âŒ | âœ… manage | âœ… manage | âŒ | âœ… view | âœ… view | âœ… view |
| Attendance (mark) | âŒ | âœ… manage | âœ… manage | âœ… manage | âœ… manage | âŒ | âŒ |
| Attendance (view) | âœ… view | âœ… view | âœ… view | âœ… view | âœ… view | âœ… view | âœ… view |
| Timetable | âœ… view | âœ… manage | âœ… manage | âœ… teacher | âœ… teacher | âœ… view | âœ… view |
| Admissions | âŒ | âœ… manage | âœ… manage | âŒ | âŒ | âŒ | âŒ |

---

## Cleanup Checklist

### Safe to Delete
- [ ] `server/src/routes/school_lf.js` (124 KB - unused)
- [ ] `server/src/routes/schoolFoundation.js.append.txt` (3 KB - trash)
- [ ] `server/src/routes/schoolFoundation.js.append2.txt` (6 KB - trash)
- [ ] `server/src/routes/school_students_complete.js` (65 KB - dead code)
- [ ] Line 29 in `server/src/index.js`: `import './routes/school_students_complete.js';`
- [ ] `server/src/schools/` (empty folder)
- [ ] `src/schools/` (empty folder)
- [ ] Temp scripts: `_apply_m32.mjs`, `_tt_check.mjs`, `_tt_seedinfo.mjs`, `_tt_alloc.mjs`, `_tt_cols.mjs`, `_tt_subjects.mjs`

### Review for Consolidation
- [ ] `school_admissions.js` routes â†’ merge into `schoolFoundation.js` or `school_comprehensive.js`
- [ ] `school_uploads.js` â†’ merge into `schoolFoundation.js`
- [ ] `school_academics.js` overlaps with `schoolFoundation.js`
- [ ] `school_more.js` overlaps with `school_exam.js`, `school_comprehensive.js`

---

## Known Issues / Tech Debt

1. **Duplicate exam routes**: `school_more.js` has `/exams/*` that overlap with `school_exam.js`
2. **Side-effect imports**: 5 files imported only for side-effects on `schoolRouter`
3. **Legacy fee endpoints**: `school.js` lines 3140-3267 duplicate `school_fee_ops.js`
4. **Missing audit triggers**: `audit_fee_accounts_changes()` function not applied (57_reports_hardening.sql)
5. **No automated tests**: No test suite configured
6. **Large bundle**: `SchoolPage` chunk > 500 KB (code-split needed)
7. **Placeholder components**: Many fee sub-pages still use generic placeholders

---

## Environment Variables

```bash
# Server (.env)
NODE_ENV=development
PORT=3100
DB_HOST=localhost
DB_PORT=5432
DB_USER=xerp
DB_PASSWORD=<local-db-password>
DB_NAME=school_erp
JWT_SECRET=your-secret
MASTER_PASSWORD=master-password
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=5

# Frontend (Vite uses import.meta.env)
VITE_API_BASE=/api
```

---

## PostgreSQL Connection

```bash
# Direct psql access
PGPASSWORD=<local-db-password> psql -h localhost -U xerp -d school_erp

# Common queries
\dt school_*           # List all school tables
SELECT * FROM school_fee_head;
SELECT * FROM school_invoice LIMIT 10;
SELECT * FROM school_exam;
```

---

## License & Credits

Internal School ERP Project - Proprietary

---

*Generated: 2026-11-02 | Last Updated: 2026-11-02*