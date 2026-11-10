# MASTER PROMPT — SchoolErp (Multi-Tenant School & College ERP)

> Base project: `C:\Users\hp\Desktop\SchoolErp` (copy of the working `pg-xerp` engine).
> Paste this whole document as the instruction to the AI coding agent.

---

## 0. Context — Start From The Existing Engine (do NOT rebuild it)

Act as a senior full-stack product architect, backend engineer, frontend designer, database architect, DevOps engineer, and EdTech product manager.

You are extending the working codebase at `C:\Users\hp\Desktop\SchoolErp`. It is already a running ERP engine:

- **Frontend:** React 19 + Vite, single-page app (`src/app.jsx`, `src/components/*`, `src/forms/*`).
- **Backend:** Node.js + Express + `pg` (`server/src/*`), JWT auth, rate limiting.
- **Database:** PostgreSQL, schema built from ordered SQL files in `sql/`.
- **Existing engine features to REUSE, not replace:**
  - **Multi-tenant scoping already exists as "company"** via `appId` (`companies` table, `/api/auth/companies`, `X-App-Id`, per-company forms, menus, dashboards, users).
  - Config-driven **forms engine** (`src/forms/*`, form config + list/add/edit/print pages, stored procedures).
  - **Menu builder** (custom nested sidebar menus, per-company).
  - **Dashboard builder** (boards, sections, links, KPI widgets, per-company + per-user assignment).
  - **RBAC / security** (`sql/11_security.sql`), audit/login logs.
  - **Themes**, font scaling, layout, sidebar, customization panel.
  - **Custom fields**, import/export primitives.

**Terminology mapping for this product:** "Company" → **Institution** (a school, college, campus, or coaching centre). "Company group" → **Education Group** (owns many institutions). Do not break the `appId` plumbing; rename it in the UI and data where it is user-facing, and keep the underlying tenant isolation.

Your job is to turn this engine into a production-grade **multi-school / multi-college ERP**. Do **not** rewrite the engine. Build the school domain (students, academics, fees, exams, attendance, transport, etc.) on top of it, module by module.

---

## 1. Product Vision

An all-in-one education ERP covering the full lifecycle:

```
Enquiry → Admission → Enrollment → Academics → Fees → Exams → Results → Promotion → Alumni
```

Replace spreadsheets, registers, and standalone apps with one connected system. Every module shares one data model; a change in one module updates related modules automatically (e.g. admission approval creates student + class + fee plan + parent account + welcome message; absence triggers parent alerts; fee payment updates ledger + receipt + WhatsApp confirmation; marks update report cards + result notifications).

---

## 2. Technology & Architecture

Stay on the current stack unless there is a hard reason to change:

- **Frontend:** React + Vite, responsive, themeable, role-based dashboards. Reuse the existing design system (`public/css/app.css`), dashboard hero, sidebar sections, forms engine.
- **Backend:** Express + `pg`, modular routers per domain. REST API under `/api`.
- **Database:** PostgreSQL. **Row-level tenancy** with a `tenant_id`/`app_id` on every table and enforced in every query. Prefer PostgreSQL Row-Level Security (RLS) plus server-side scope checks.
- **Cache/Queue (add when needed):** Redis + BullMQ for reminders, bulk imports, notifications, report generation.
- **Files:** S3-compatible storage (S3 / R2 / B2) for documents, receipts, report cards.
- **Real-time:** WebSocket/SSE for live dashboards, chat, notifications, bus tracking.
- **Search:** Postgres full-text first; Meilisearch/Elasticsearch only if scale demands.
- **Auth:** JWT + refresh, optional 2FA, device/session history, impersonation with audit.
- **Security:** TLS, AES-256 at rest, field-level encryption for sensitive fields, bcrypt/Argon2, rate limiting, CSRF/XSS/SQLi protection, audit logs.

**Multi-tenant strategy:** one database, shared schema, `tenant_id` on every row, RLS + application-level scope enforcement. Provide an optional path to per-tenant schema/database for large institutions.

---

## 3. Tenant Model

Hierarchy: **Platform → Education Group → Institutions (schools/colleges/campuses) → Units (classes/departments).**

Each **Institution (tenant)** must have:
- Unique `tenant_id` / `appId`, optional subdomain + custom domain (SSL).
- Own branding (logo, colours, theme), email sender identity.
- Own users, students, staff, classes, fees, exams, settings, reports.
- Own subscription plan, feature toggles, usage limits.
- Own notification templates, API keys, webhooks.
- Own backup/restore, audit logs.

**Super Admin (platform)** can create/suspend/delete tenants, manage plans and feature flags, view platform analytics, manage global templates/languages, handle support, and impersonate with permission + audit.

**Tenant types:** single school, single college, school group (multi-branch), university (departments/colleges), coaching institute, franchise.

---

## 4. Roles & Permissions

Granular RBAC: module → page → action → field → data-scope → approval → export.

**Core roles:** Super Admin, Platform Support, Institution Owner, Director/Trustee, Principal/Dean, Vice Principal, Admin Officer, Admission Counselor, Accountant, Fee Collector, HR Manager, Payroll Officer, Teacher, Class Teacher, Subject Teacher, Exam Coordinator, Librarian, Hostel Warden, Transport Manager, Driver, Attendant, Canteen Manager, Inventory Manager, Front Office, Parent/Guardian, Student, Alumni, Placement Officer, Auditor, Custom Roles.

Support: module permissions, page permissions, button/action permissions, field-level permissions, data scope (own/class/department/all), approval rights, export/download rights, IP restrictions, session timeout, 2FA, login/device history, audited impersonation.

---

## 5. Core Modules (school-adapted)

Reuse the forms engine for CRUD screens; add specialised UIs where needed.

1. **Student Information System** — 360° profile: admission/enrollment/roll numbers, class/section/batch/stream/department, session history, guardians + siblings, contacts, documents, previous school, health, SEN, discipline, achievements, scholarships/concessions, transport/hostel/library/canteen links, fee ledger, attendance & exam summaries, report cards, certificates, alumni, recycle bin, exit/TC workflow.
2. **Admission CRM** — enquiries (web/QR/WhatsApp/phone/walk-in/campaigns), source tracking, counselor assignment, follow-ups, applications, documents, interviews/entrance tests, merit list, seat allocation, offer letter, confirmation, payment, enrollment, analytics/funnel.
3. **Academics** — academic years, classes/grades, sections, departments, courses, semesters, batches, subjects/electives, credit/CBCS/NEP structures, teacher-subject-class mapping, drag-and-drop timetable, substitutions, workload, lesson plans, syllabus tracker, homework, materials, assessments (formative/summative), grading schemes, marksheets, report cards, holistic progress card, re-evaluation, promotion rules with undo, detention/reappear.
4. **Attendance** — manual, QR, biometric, RFID/NFC, optional face/geofenced self-attendance; teacher/staff; subject/daily/period-wise; transport boarding; hostel; late tracking; leave management; corrections with approval; percentage alerts; parent absence notifications; analytics.
5. **Fees & Finance** — fee heads/groups, class/section/student-specific fees, installments, due dates, late fines, reminder automation, discounts/scholarships/sibling/staff concessions, transport/hostel/mess/exam fees, library fines, canteen wallet, refunds, partial/advance payments, plans, bulk invoices, receipts, payment links, UPI QR + Razorpay/Stripe/PayPal, offline payments (cash/cheque/DD), reconciliation, ledger, income/expense, budgeting, vouchers, Tally/Zoho export, defaulter/collection reports.
6. **Examinations & Results** — exam types/schedules/timetable, hall tickets, exam fees, seating, invigilators, internal/external/practical/viva marks, eligibility, gradebook, marks entry + approval workflow, marksheets, report cards, transcripts, result publication, supplementary/reappear, online CBT (question bank, blueprint, randomization, negative marking, timer, MCQ auto-eval, OMR), analytics, weak-topic analysis.
7. **HR & Payroll** — staff profiles, departments, designations, documents, contracts, joining/exit, staff attendance, leave + approval, shifts, duties, workload, appraisals, training, payroll structures, allowances/deductions, PF/ESI/TDS/PT, loans/advances, payslips, revisions, F&F settlement, HR reports.
8. **Transport** — vehicles, drivers, attendants, routes/stops, student allocation, pickup/drop points, transport fees, GPS tracking, driver app, playback, ETA, delay alerts, geofencing, speed/deviation alerts, boarding alerts (NFC/QR), duty logs, fuel, maintenance, insurance/document expiry, reports.
9. **Hostel** — hostels/blocks/floors/rooms/beds, room types, hostel & mess fees, mess menu/attendance, hostel attendance, gate pass, visitor logs, leave, complaints, room changes, inventory, warden dashboard, parent notifications.
10. **Library** — books/eBooks/journals, barcode/ISBN, categories/authors/publishers, rack mapping, issue/return, renewals, reservations, due reminders, fines, lost/damaged, recommendations, reading history, reports.
11. **Inventory & Assets** — categories, items, purchase orders, suppliers, GRN, stock in/out/transfer, low-stock alerts, asset registry/assignment/maintenance, depreciation, QR/barcode tags, condemnation, reports.
12. **Canteen / Cashless Campus** — menu, pricing, wallet top-up/deduction, QR ordering, order/recharge history, daily sales, inventory link, parent spending limits, refunds, reports.
13. **Front Office** — visitors, gate pass, appointments, call logs, postal/courier, complaints, feedback, enquiries, certificate requests, TC workflow, ID card requests.
14. **Communication Center** — see §6 (channels, events, templates, delivery).
15. **LMS** — courses/categories/chapters/lessons, video/PDF, assignments, quizzes, live/recorded classes, forums, doubts, progress, certificates, learning paths, gamification, SCORM/xAPI (optional), plagiarism check, analytics, paid courses/coupons.
16. **AI Assistant (grounded)** — tenant-scoped RAG only; report summaries, defaulter/attendance-risk detection, timetable/lesson/paper generation, circular drafting, parent FAQ, insights. Never cross tenants; respect RBAC; audit every interaction.
17. **Reports & Analytics** — admissions, enrolment, attendance, fee collection/defaulters, exam/subject/teacher performance, staff attendance, payroll, transport, hostel, library, inventory, canteen, income/expense, alumni, parent engagement, communication delivery, multi-campus comparison, custom report builder, PDF/Excel/CSV, scheduled emails, drill-down dashboards.

---

## 6. Communication Center & Notification Engine

**Channels:** WhatsApp Business Cloud API, SMS, Email (SMTP/transactional), Telegram Bot API, in-app, web push (FCM), in-app chat, announcements/circulars/events/emergency alerts.

**Template variables:** `{student_name}`, `{parent_name}`, `{class}`, `{section}`, `{fee_amount}`, `{due_date}`, `{payment_link}`, `{school_name}`, `{receipt_no}`, `{bus_route}`, `{eta}`, `{exam_name}`, `{result_link}`, `{book_title}`, `{fine_amount}` and more. Multi-language, approved WhatsApp templates, HTML email templates, scheduled/recurring sends.

**Delivery rules:** idempotency + dedupe, retry with backoff, **channel fallback chain: WhatsApp → SMS → Email → Push**, opt-in/opt-out, quiet hours, delivery-status tracking, full communication logs, per-attempt audit.

Expected automated events: enquiry received, admission approved/rejected, welcome + credentials, absent, low attendance, homework assigned, exam scheduled, admit card, result published, invoice generated, fee due/overdue, payment received, receipt, bus delayed, boarded/de-boarded, gate pass approved, visitor arrival, library due, payroll slip, PTM, event, holiday, emergency.

---

## 7. Automation Rules Engine (canonical spec)

**Tables:** `automation_rules`, `automation_runs`, `notification_templates`, `notification_logs`, `notification_optouts`.

**Rule schema fields:** `id`, `tenant_id`, `name`, `trigger_event`, `conditions` (JSONB), `delay_seconds`, `recurrence` (`every_seconds`, `max_attempts`, `until_condition`), `channels[]`, `template_id`, `audience`, `escalation`, `retry_policy`, `enabled`, `created_by`, `created_at`.

**Every rule supports:** trigger condition, conditions/filters, delay/schedule, recurrence, channel selection, template variables, approval steps (optional), retry rules, audit log, enable/disable toggle.

### Rule 1 — Fee Overdue
```
IF fee due_date + 1 day AND payment_status != 'paid'
THEN send WhatsApp + Email + Push
REPEAT every 3 days until paid OR max 5 reminders
```
- Trigger: `daily job` scanning `fee_invoices` where `due_date + 1 <= today`, `status != 'paid'`, `tenant_id = current`.
- Per invoice, count prior reminders in `automation_runs`; only send if no send in the last 3 days and `reminder_count < 5`.
- Stop immediately when `payment_status = 'paid'`.
- Include `{fee_amount}`, `{due_date}`, `{payment_link}`; log each attempt; escalate to accountant after reminder 3 (optional).

### Rule 2 — Student Absent
```
IF attendance_status = 'absent'
THEN send parent WhatsApp/push within 15 minutes
IF absence_count > allowed_limit
THEN notify class teacher and principal
```
- Trigger: on attendance save where `status = 'absent'`.
- Enqueue with a 15-minute delay (dedupe so a double-mark doesn't double-send).
- Count absences for the student in the current period; if `absence_count > allowed_limit` (per tenant config), notify class teacher + principal through their channels.

### Rule 3 — Bus Delay
```
IF GPS bus is more than 10 minutes late at a stop
THEN notify parents on that route via WhatsApp/push
```
- Trigger: GPS ping evaluated against route ETA.
- When `actual_arrival - scheduled_arrival > 10 min` (or ETA slips by > 10 min), send to all parents assigned to that route/stop; include `{bus_route}`, `{eta}`; throttle repeated alerts per stop per run.

### Rule 4 — Exam Result Published
```
IF result_status = 'published'
THEN send result summary + PDF link to parent email/WhatsApp
```
- Trigger: result status transition `→ published`.
- Generate/link the report-card PDF, then send summary + `{result_link}` to the parent via Email and WhatsApp; log delivery.

### Rule 5 — Library Overdue
```
IF return_date < today
THEN send reminder and add fine to student account
```
- Trigger: daily job over `library_issues` where `return_date < today` and `status != 'returned'`.
- Send reminder, compute fine by tenant rule, post a fine line to the student fee/ledger account, mark fine applied to avoid duplicates, log everything.

Every automation must be **tenant-scoped, idempotent, auditable, retryable, and toggleable**.

---

## 8. Data Model (ER outline — add to `sql/`)

Prefix school tables with `school_` and include `tenant_id` (or reuse `app_id`) on every table. Key entities:

- **Tenancy/Identity:** `tenants`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_tenants`, `sessions`, `audit_logs`.
- **Academic core:** `academic_years`, `classes`, `sections`, `departments`, `courses`, `semesters`, `batches`, `subjects`, `class_subjects`, `teacher_subjects`, `timetable_slots`, `lesson_plans`, `homework`, `homework_submissions`.
- **Students:** `students`, `student_sessions` (enrollment history), `guardians`, `student_guardians`, `student_documents`, `student_health`, `student_discipline`, `student_achievements`, `student_exit`.
- **Admissions:** `enquiries`, `enquiry_followups`, `applications`, `application_documents`, `interviews`, `merit_lists`, `seat_allocations`, `offers`.
- **Attendance:** `attendance_students`, `attendance_staff`, `attendance_corrections`, `leave_requests`, `attendance_rules`.
- **Fees:** `fee_heads`, `fee_groups`, `fee_plans`, `fee_plan_items`, `fee_invoices`, `fee_invoice_items`, `payments`, `receipts`, `discounts`, `concessions`, `refunds`, `ledger_entries`, `expenses`, `budgets`.
- **Exams:** `exams`, `exam_schedules`, `exam_subjects`, `marks`, `marks_approvals`, `grade_schemes`, `results`, `report_cards`, `re_evaluations`, `question_bank`, `online_exams`.
- **HR/Payroll:** `staff`, `staff_documents`, `staff_attendance`, `shifts`, `duties`, `appraisals`, `payroll_structures`, `salary_components`, `payslips`, `loans`.
- **Transport:** `vehicles`, `drivers`, `attendants`, `routes`, `route_stops`, `student_transport`, `vehicle_gps_pings`, `transport_incidents`, `maintenance`, `fuel_logs`.
- **Hostel:** `hostels`, `blocks`, `rooms`, `beds`, `hostel_allocations`, `mess_menu`, `mess_attendance`, `gate_passes`, `visitor_logs`, `hostel_complaints`.
- **Library:** `library_books`, `library_copies`, `library_members`, `library_issues`, `library_fines`, `library_reservations`.
- **Inventory:** `inventory_items`, `purchase_orders`, `grn`, `stock_movements`, `assets`, `asset_assignments`, `asset_maintenance`.
- **Canteen:** `canteen_items`, `canteen_orders`, `canteen_wallets`, `wallet_transactions`.
- **Front office:** `visitors`, `appointments`, `call_logs`, `complaints`, `certificate_requests`, `tc_requests`.
- **Communication/Automation:** `notification_templates`, `notification_logs`, `notification_optouts`, `automation_rules`, `automation_runs`, `webhooks`.
- **LMS:** `lms_courses`, `lms_lessons`, `lms_enrollments`, `lms_assignments`, `lms_quizzes`, `lms_progress`, `lms_certificates`.
- **AI:** `ai_interactions`, `ai_feedback`.

Add indexes on `(tenant_id, …)` for every hot query; enforce RLS policies keyed on the active tenant.

---

## 9. API Structure (REST, `/api`)

- **Tenant resolution:** `appId` header/subdomain → tenant context on every request.
- **Auth:** `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/companies` (→ institutions), `/auth/2fa`.
- **Modules (per domain):** `/students`, `/admissions`, `/academics`, `/attendance`, `/fees`, `/invoices`, `/payments`, `/exams`, `/marks`, `/results`, `/staff`, `/payroll`, `/transport`, `/routes`, `/hostel`, `/library`, `/inventory`, `/canteen`, `/front-office`, `/lms`, `/reports`, `/automation/rules`, `/notifications`.
- **Automation:** `/automation/rules` (CRUD + enable), `/automation/runs` (audit), `/automation/test`.
- **Webhooks:** `/webhooks/payments/{provider}`, `/webhooks/whatsapp`, `/webhooks/gps`.
- **Rules:** every endpoint is tenant-scoped, permission-checked, validated, paginated, filterable, exportable, and audited. Bulk operations are background jobs with preview + rollback.

---

## 10. UX / Design

Reuse the current dashboard hero, sidebar sections, theme system, and drag-and-drop builders. Add: role-based dashboards, 6+ themes, light/dark, multi-language + RTL, custom menu manager, white-label settings, custom domains, global search, quick actions, bulk actions, saved filters, data tables with sort/paginate/export, visual timetable builder, import hub, undo center, ERP navigator, onboarding checklist, contextual help, knowledge base, in-app support chat. Mobile-first responsive on desktop/tablet/phone.

---

## 11. Mobile Apps (later phase)

Parent, Student, Teacher, Staff, Driver, Warden, Admin. **Parent:** child dashboard, attendance, homework, timetable, fees/pay, results, report cards, transport tracking, hostel, circulars, chat, PTM booking, leave, wallet, notifications. **Teacher:** attendance, homework, marks, timetable, leave, profiles, parent comms, lesson planner, live classes, exam schedule. **Driver:** route, student list, boarding/de-boarding, GPS, SOS, delay, duty log.

---

## 12. Import / Export / Migration

CSV/Excel import hub with templates, field mapping, validation errors, duplicate detection, partial import, history, rollback: students, staff, fees, marks, inventory, library, routes, alumni. Provide migration templates + API-based migration from other ERPs.

---

## 13. Phased Delivery (start on top of the existing engine)

**Phase 1 — MVP (build first):** tenant/institution setup on the existing `appId` engine, RBAC, Student Information System, classes/sections/subjects, Admission CRM, Attendance, Timetable, Homework, Fee management, online payments, receipts, parent + teacher basics, Email/WhatsApp/SMS/push notifications, **Automation Rules 1, 2, 4, 5**, basic reports, audit logs.

**Phase 2 — Academic depth:** exams, marks entry, report cards/HPC, promotion + undo, library, front office, certificates, ID cards, import hub, advanced reports, **Rule 3 (transport)**.

**Phase 3 — Operations:** transport + GPS, hostel, inventory, canteen wallet, biometric, payroll, HR, ledger, CCTV, visitor management.

**Phase 4 — Advanced:** LMS, live classes, online CBT, AI assistant, alumni/donations, placement cell, accreditation, custom APIs/webhooks, multi-campus analytics, white-label/custom domains.

---

## 14. Quality Rules (non-negotiable)

- Every record belongs to a tenant; **never allow cross-tenant access**.
- Every important action writes an **audit log**.
- Every financial change is reversible via the **Undo Center** (approval + audit).
- Every notification is logged with delivery status; retries + fallbacks are handled.
- Every bulk operation supports validation, preview, rollback, background processing.
- Every report supports filters, export, scheduling, and role-based access.
- Every module works on desktop, tablet, and mobile.
- Clean, modular, maintainable code; seed data + demo tenant + demo users.

---

## 15. FIRST RESPONSE REQUIRED (do this before coding)

Deliver, in order, and then **stop and wait for approval**:

1. Final tech stack (confirm the existing React/Vite + Express/Postgres choice).
2. High-level system architecture diagram + tenant isolation strategy (shared schema + RLS).
3. Complete multi-tenant database schema & ER outline (§8 expanded).
4. API structure (§9 expanded).
5. Role/permission matrix.
6. Phase 1 MVP plan mapped to the existing files in `C:\Users\hp\Desktop\SchoolErp` (which files/tables to add).
7. Folder structure for the new school modules (keep `src/forms`, `server/src/routes`, `sql/` conventions).
8. Sample backend code: tenant creation, student admission, fee invoice, WhatsApp notification, and **Rule 1 fee-overdue job**.
9. Sample frontend dashboard layout + sample parent/teacher mobile screen plan.

Do **not** build everything at once. Deliver architecture, schema, API plan, and Phase 1 implementation plan first. Then implement module by module after approval.
