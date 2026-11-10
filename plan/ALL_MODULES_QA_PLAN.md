# School ERP: All-Module Implementation and QA Plan

**Purpose:** establish a reliable, testable implementation and QA path for every School ERP module, including navigation, APIs, permissions, data relationships, CRUD/workflows, reporting, and printing.

**Scope:** all 26 current top-level entries in `src/school/menu.js`, their child routes, five additional planning domains identified in vendor research, shared foundation services, and cross-module workflows. The added domains are recommendations for this product—not a claim that every ERP must have the same menu or module count.

**Coverage count:** 31 planning domains (26 current menu modules + 5 recommended additions). This is this plan's scope, not an industry standard.

## 1. Baseline assessment

The current application has a broad menu, but a menu entry marked `built` does not prove that its route has a dedicated screen or that the full workflow works. `SchoolPage` contains the student/academic/attendance/fees/automation experience and a few explicit subroutes; other paths can fall through to shared screens. Backend routes are spread across `school.js`, `school_admissions.js`, `school_students_complete.js`, `school_more.js`, `school_comprehensive.js`, and `schoolFoundation.js`.

The student/admissions area is substantially implemented, including the inquiry/application flow, student CRUD with archive, profiles and guardians, enrollment/promotion, exit/TC, document, health, and discipline workflows. Classes, sections, and subjects have create/update/delete paths. Treat these as **partially implemented until end-to-end scenarios prove each operation and linkage**.

The existing `GAP_ANALYSIS.md` predates recent student work and should be reconciled rather than treated as the current status. The repository has a production build command and existing standalone/server checks, but no standard root test, lint, type-check, or browser automation script. Some documented test scripts mutate data. Do not run setup, seeding, or mutation scripts against a valuable database.

There is no universally accepted “best school ERP” module count. Vendor materials describe different bundles and separately packaged products. This plan therefore uses the existing 26 menu modules as the baseline, and adds missing capability domains only where they improve coverage; adoption and menu placement should be confirmed against the school's jurisdiction and operating model.

### Known risks to resolve early

1. `school_more.js` and `school_comprehensive.js` use `req.user.permissions` for route checks, while the login token does not appear to include that property and access is resolved through the school foundation. Confirm admin and non-admin behavior; standardize route guards before broad testing.
2. Leave endpoints refer to `leaves.view/manage`, while `leaves` is absent from the permission catalogue. Add a consistent permission/module mapping or remove the mismatch.
3. Multiple admission/enquiry tables and route sets exist (`school_inquiries`, enhanced admissions, and `school_enquiries`). Decide which workflow is canonical and verify no UI/API silently writes to a disconnected model.
4. Reconcile all menu routes with a real screen, API, schema, permission, and test. Disable or label unfinished routes instead of implying they work.
5. Review cross-tenant ownership checks, health/discipline privacy, protected uploads, cascade/delete behavior, duplicate/idempotent requests, and audit coverage.

## 2. Module coverage matrix

For each row, first map the screen and route to the actual API and tables. Then complete the listed workflow and add automated coverage. “Partial / verify” is a conservative starting point, not a claim that every route is broken.

| Module | Starting assessment | Minimum workflow and QA coverage |
|---|---|---|
| Dashboard | Partial / verify | Load campus/year-scoped counts; verify every card/link opens its intended module; reconcile dashboard numbers against source rows; test empty and large datasets. |
| Admission & CRM | Partial / verify | Inquiry create/edit/status transitions → application draft/edit/submit → approve/reject/waitlist; prove approval atomically creates exactly one student and enrollment; test duplicates, required documents, lost reason, and refresh/deep links. |
| Students | Partial / most developed | Create/read/update/archive; filter/search; profile, guardian edit/link/unlink, document and enrollment linkage; verify class/section changes update current enrollment without rewriting prior years; test duplicate admission IDs, permissions, and student/profile print. |
| Academics | Partial / verify | Six current menu children: Classes & Sections, Subjects, Academic Years, Subject Allocation, Rooms, and Homework. Validate explicit child-route wiring, CRUD, tenant/role ownership, year and enrollment scoping, schedule/room conflicts, submission/grading rules, and all `AC-LINK-*` scenarios in [`academics/README.md`](academics/README.md). Curriculum, lesson plans, gradebook, and report-card scope remain linked capabilities, not additional children in the current six-item menu. |
| Timetable | Partial / verify | Create/edit/publish timetable and substitutions; reject class/teacher/room/time conflicts; verify student/teacher views use the same published schedule. |
| Attendance | Partial / verify | Mark, bulk-save, correct, and report attendance; test duplicate dates, absent/late/excused states, class filters, counts, permissions, and suspension/exit linkage. |
| Examinations | Partial / verify | Create schedule, enter/update marks, validate ranges and grade rules, publish results/report cards, and verify promotion eligibility reads the same result set. |
| Fees & Accounts | Partial / verify | Fee plans/heads, invoices, payments/receipts, scholarships/aid, refunds, accounts payable/receivable, expenses, general ledger/journals, budgets, bank reconciliation, and reports; test overpayment/duplicate protection, transactional balances, permissions, and TC/promotion no-dues linkage. Confirm accounting jurisdiction and required scope. |
| HR & Payroll | Partial / verify | Staff records, attendance/leave, payroll run and payslip; test calculations, approval states, duplicate pay runs, and restricted salary visibility. |
| Inventory & Assets | Partial / verify | Item/supplier/purchase/issue/return/asset lifecycle; verify stock ledger, non-negative stock, duplicate transaction protection, and valuation/report consistency. |
| Transport | Partial / verify | Route/vehicle/trip/student allocation lifecycle; verify vehicle capacity, driver/route relationships, fees, and student exit/update propagation. |
| Hostel | Partial / verify | Room/bed setup, allocation, roll call, gate pass, and fees; verify occupancy limits, duplicate allocation prevention, and student exit handling. |
| Library | Partial / verify | Catalogue, member, issue/renew/return, reservation, and fine flows; verify copy availability, overdue calculation, and student archive/exit behavior. |
| Canteen | Unverified / likely incomplete | Menu, order/POS, wallet/limit, stock, and refund flows; verify authorization, transaction atomicity, and duplicate payment/order protection. |
| Front Office | Partial / verify | Visitor, call, enquiry, appointment, request/helpdesk, and gate-pass lifecycle; verify check-in/out, student lookup, audit, and privacy. |
| Communication | Partial / verify | Templates, audience, consent, queued/simulated delivery, and logs; verify no real gateway call without configured credentials, retry/idempotency behavior, and recipient scoping. |
| Learning (LMS) | Partial / verify | Course/class content, homework, submission, review/grade, and student/teacher visibility; test due dates, attachments, ownership, and grade linkage. |
| Events & PTM | Partial / verify | Event creation, audience/registration, PTM slot booking and attendance; test capacity, conflicts, cancellation, and notifications. |
| Certificates & ID | Partial / verify | Certificate/ID configuration, issuance, reprint/revocation; verify unique numbering, correct student data, protected files, and print layout. |
| Alumni & Placement | Unverified / likely incomplete | Graduation-to-alumni handoff, profile update, events/placement/donation records; verify graduated-only eligibility and privacy. |
| Reports & Analytics | Incomplete / placeholders present | Implement and test each promised report with filters, totals, pagination/export, campus/year scope, role scope, empty data, and reconciliation to source records. |
| Automation Center | Partial / verify | Rule configuration, run, logs, pause/enable, and retry; test deterministic/idempotent behavior, safe simulation, and no outbound delivery in test. |
| Import & Export | Unverified / likely incomplete | Upload/preview/map/validate/dry-run/commit/export; test malformed files, row-level errors, duplicate handling, atomic rollback, permissions, and PII scoping. |
| AI Assistant | Unverified / likely incomplete | Establish allowed tasks and data boundaries; test permission-filtered retrieval, sensitive-data exclusion, prompt/error handling, and disabled/unconfigured state. |
| Settings | Partial / verify | Branding, campus, academic year, roles/permissions, document types, and options; test validation, propagation to screens, and prevention of privilege escalation. |
| Platform / Super Admin | Unverified / high risk | Tenant lifecycle and administration; prove tenant isolation, super-admin-only access, audit trail, and no cross-tenant reads/writes by school users. |
| Portals & Self-Service (recommended addition) | Not a dedicated menu module / unverified | Parent/guardian, student, and teacher views; online enrollment/re-enrollment, attendance/grades/homework/schedule, balances/payments, consent/forms, messages, and profile updates; test role-specific visibility, consent, mobile use, and that portal writes update the same SIS records. |
| Student Support & Inclusion (recommended addition; partly overlaps Health/Discipline) | Partial capabilities / not a complete case-management module | Nurse/health events, counseling/referrals, IEP/accommodations, intervention/MTSS plans, goals/services/progress evidence, and family follow-up; test sensitive-data isolation, authorized staff access, and links to attendance/grades without leaking private notes. |
| Safety & Safeguarding (recommended addition; partly overlaps Front Office/Discipline) | Partial capabilities / safeguarding scope unverified | Visitor/gate-pass checks, incident reporting, child-protection case workflow, emergency contacts/drills, follow-up, and restricted evidence; test escalation, audit, confidentiality, retention, and authorized access. |
| Facilities & Maintenance (recommended addition) | Missing as a dedicated workflow / partly represented by Rooms and Assets | Campus/building/room inventory, reservations, maintenance tickets, preventive schedules, work orders, vendors, and asset lifecycle; test room conflicts, ticket status/assignment, asset linkage, and cost reports. |
| Integrations, Compliance & Data Governance (recommended addition; integrations exist under Settings) | Partial / unverified | SSO/identity, API/webhooks, provider health, synchronization/retry logs, jurisdiction-specific reporting, retention/deletion rules, privacy/consent, and export governance; test auth, tenant scoping, retries, audit, retention, and regulator-specific report reconciliation. |

## 3. Research basis and recommended additions

There is no objective industry-wide “best ERP” or fixed module count. The following official vendor pages are product descriptions, not independent audits; they establish examples of capabilities vendors offer, not that every school needs them or that each feature is included in every package.

- [Gradelink SIS](https://gradelink.com/student-information-system/) describes online sign-ups/document uploads, gradebooks/report cards, attendance/behavior, parent/student apps, tuition and lunch/after-care charges, reports, and IEP reporting.
- [Edsby features](https://www.edsby.com/features/) describes a student “Panorama” view combining grades, parent information, attendance, discipline, IEPs, learning evidence, portfolios, schedules, alerts, and teacher observations.
- [FACTS](https://factsmgt.com/) describes connected SIS, academic management, analytics, and integrations across admissions, finance, family engagement, and academic operations.
- Infinite Campus lists [Food Service](https://www.infinitecampus.com/demo/campus-food-service) as a product demo, illustrating that meal service may be separately packaged from the core SIS.

These sources support making the following capabilities explicit in the plan: family/student/teacher self-service; health and student support including inclusion/IEP/intervention; safeguarding; facilities and maintenance; and integration/compliance/data governance. Gradebook/assessment detail, online enrollment, full accounting, and co-curricular activities are added as submodules of existing academic, admissions, finance, and events areas. Transport, hostel, canteen, payroll depth, statutory reports, and alumni/placement remain dependent on the school's model and jurisdiction.

## 4. Current route, submodule, and file map

### Shared wiring

| Layer | Current owner | Responsibility / QA link |
|---|---|---|
| Menu and child routes | `src/school/menu.js` | Canonical module keys, labels, permissions, paths, and `built` flags. A `built` flag must be verified against a real screen and passing workflow. |
| Hash parsing and shell | `src/app.jsx` | Parses `#/school/<module>/<sub>`, observes hash changes, and mounts `SchoolPage`; QA direct links, refresh, back/forward, and unknown routes here. |
| Sidebar | `src/components/SchoolSidebar.jsx` | Renders menu and filters by permission; QA visibility and navigation against server-side authorization. |
| Module dispatch | `src/components/SchoolPage.jsx` | Main screen and explicit subroute dispatch. New module/submodule screens must be connected here or through a deliberate router—not merely added to the menu. |
| Student subpages | `src/components/StudentProfile.jsx`, `src/school/students/Admissions.jsx`, `src/pages/school/students/{Promotion,TransferExit,Documents,Health,Discipline}.jsx` | Explicitly wired student/admission screens; test all UI calls against APIs and linked data. |
| Configurable forms | `src/formRegistry.js`, `src/components/FormPage.jsx`, `src/forms/<formId>/form.json` and `ListPage.jsx` / `AddEditPage.jsx` / `PrintPage.jsx` | Separate dynamic-form framework. `form.json` and a form folder do not prove that `App` routes a menu item to `FormPage`; verify the live route before treating a form as a module UI. |
| API client | `src/api.js` | Authenticated frontend requests and upload/file helpers; test status/errors, auth expiry, and request serialization. |
| API mount and middleware | `server/src/index.js`, `server/src/middleware/auth.js` | Mounts APIs and authenticates requests. Check every route's permission and tenant context. |
| School access catalogue | `server/src/school/foundation.js`, `server/src/routes/schoolFoundation.js` | Module permissions, role/access resolution, campus/year context, settings, and audit/approval foundations. |
| SQL schema | `sql/*.sql`, applied in order by `server/setup.mjs` | Tables, indexes, constraints, and migrations; test with an isolated database and review setup side effects first. |

### Existing module ownership map

The form IDs below are the matching folders in `src/forms/`; they are configuration/component candidates, not confirmation of a dedicated screen. API files are route groups to inspect for each child route.

| Menu module and current child routes | Frontend owner(s) / form folder | Backend route group(s) |
|---|---|---|
| Dashboard | `SchoolPage.jsx` | `school.js` |
| Admission & CRM: Enquiry Leads, Applications, Counseling*, Admission Fees*, Admission Reports* | `src/school/students/Admissions.jsx`; `frmSchoolAdmission` | `school_admissions.js`, `school_students_complete.js` |
| Students: All Students, New Admission, Promotion, Transfer & Exit, Documents, Health Records, Discipline | `SchoolPage.jsx`, `StudentProfile.jsx`, student page files above; `frmSchoolStudents`, `frmSchoolGuardians` | `school.js`, `school_admissions.js`, `school_students_complete.js`, `school_uploads.js` |
| Academics: Classes & Sections, Subjects, Academic Years, Subject Allocation, Rooms, Homework | `SchoolPage.jsx`; `frmSchoolClasses`; detailed six-child QA plans in `plan/academics/` | Classes/sections/subjects: `school.js`; year context: `schoolFoundation.js`; homework submissions/lesson plans: `school_more.js`; allocation/room CRUD and complete homework lifecycle need route audit/implementation |
| Timetable: Master, Teacher Timetable, Student Timetable, Substitutions | `frmSchoolTimetable`; verify dedicated route screen | `school_more.js` |
| Attendance: Mark Attendance, Register, Corrections, Staff Attendance, Reports | `SchoolPage.jsx`; `frmSchoolAttendance` | `school.js`, `school_more.js` |
| Examinations: Schedule, Marks Entry, Grade Setup, Report Cards, Results | `frmSchoolExams`; verify dedicated route screen | `school_more.js` |
| Fees & Accounts: Invoices & Collection, Fee Setup, Dues, Refunds, Reconciliation, Accounts | `SchoolPage.jsx`; `frmSchoolFees` | `school.js`, `school_more.js`, `school_comprehensive.js` |
| HR & Payroll: Staff Directory, Leaves, Payroll, Advances, Reports | `frmSchoolHR`, `frmSchoolUsers`; verify dedicated route screen | `school_comprehensive.js`, `school_more.js`, `schoolFoundation.js` |
| Inventory & Assets: Items, Purchase, Issue/Return, Assets, Stock Report | `frmSchoolInventory`; verify dedicated route screen | `school_comprehensive.js` |
| Transport: Routes, Vehicles, Student Allocation, Fees, GPS/Tracking | `frmSchoolTransport`; verify dedicated route screen | `school_comprehensive.js` |
| Hostel: Rooms, Allocation, Fees, Attendance, Visitors | `frmSchoolHostel`; verify dedicated route screen | `school_comprehensive.js` |
| Library: Books, Issue/Return, Members, Fines, Reports | `frmSchoolLibrary`; verify dedicated route screen | `school_comprehensive.js` |
| Canteen: Menu, Orders, Billing, Inventory | `frmSchoolCanteen`; verify dedicated route screen | Dedicated API coverage is unverified; inspect `school_comprehensive.js` and shared routes. |
| Front Office: Enquiry, Visitors, Complaints, Call Log, Appointments | `frmSchoolFrontOffice` | `school_comprehensive.js`, `school_more.js`, `school_admissions.js` |
| Communication: SMS, Email, Notice Board, App Notifications, Message Logs | `frmSchoolCommunication` | `school_comprehensive.js`, `school_more.js`, `school.js` |
| Learning (LMS): Courses, Assignments, Quizzes, Study Materials, Progress | `frmSchoolLMS` | `school_more.js`, `school_comprehensive.js` |
| Events & PTM: Calendar, Events List, PTM Schedule, Gallery | `frmSchoolEvents` | `school_comprehensive.js` |
| Certificates & ID: Templates, Generate, ID Cards, TC Certificate | `frmSchoolCertificates` | `school_comprehensive.js`, `school_students_complete.js` |
| Alumni & Placement: Directory, Events, Job Postings, Donations | `frmSchoolAlumni` | `school_comprehensive.js`; route completeness is unverified. |
| Reports & Analytics: Student, Attendance, Fees, Exam, Custom | `frmSchoolReports`; report list currently requires dedicated screen/API verification | `school.js`, `school_more.js`, `school_comprehensive.js` |
| Automation Center: Rules & Runs, Message Templates*, Channel Providers* | `SchoolPage.jsx`; no dedicated `frmSchoolAutomation` found | `school.js`, `school_more.js`; provider/template child routes are marked not built. |
| Import & Export: Students, Fees, Attendance, Export Data | `frmSchoolImport`; verify dedicated route screen | Import API coverage is unverified. |
| AI Assistant | `frmSchoolAI`; `SchoolPage.jsx` currently owns the menu dispatch | Dedicated AI API/workflow is unverified. |
| Settings: Institute Profile, Campuses, Roles, Audit, Users, Approvals, Integrations, Subscription | `src/components/SchoolSettings.jsx`; `frmSchoolSettings`, `frmSchoolUsers`, `frmSchoolApprovals`, `frmSchoolIntegrations` | `schoolFoundation.js`, `school.js`, `school_comprehensive.js` |
| Platform / Super Admin | `frmSchoolPlatform`; `SchoolPage.jsx` dispatch must be verified | `schoolFoundation.js`, `school_comprehensive.js`; tenant lifecycle coverage is unverified. |

`*` marks a child explicitly marked as not built in `src/school/menu.js`. The route/file inventory is a starting map: each menu child still needs an endpoint, data owner, permission, and passing test recorded. Consolidate route groups into focused files as modules mature rather than duplicating business logic across them.

### Proposed files for recommended additions

These paths are **proposals**, not files that currently exist. Keep the existing menu/hash conventions and add API modules to `server/src/index.js` only after route ownership, permissions, and schema are decided.

| Planning domain | Proposed frontend screens | Proposed backend/schema ownership |
|---|---|---|
| Portals & Self-Service | `src/pages/school/portals/FamilyPortal.jsx`, `StudentPortal.jsx`, `TeacherPortal.jsx` | `server/src/routes/school_portals.js`; role-safe endpoints reuse existing SIS/fees/LMS/attendance data rather than creating duplicate records. |
| Student Support & Inclusion | `src/pages/school/support/HealthServices.jsx`, `CounselingCases.jsx`, `IEPPlans.jsx`, `Interventions.jsx` | `server/src/routes/school_support.js`; add privacy-scoped support plans, goals, services, referrals, and audit fields in a sequential SQL migration. |
| Safety & Safeguarding | `src/pages/school/safety/SafetyCases.jsx`, `EmergencyPlans.jsx`, `VisitorChecks.jsx` | `server/src/routes/school_safety.js`; connect existing visitors/discipline/uploads with restricted safeguarding records and audit. |
| Facilities & Maintenance | `src/pages/school/facilities/Rooms.jsx`, `MaintenanceRequests.jsx`, `WorkOrders.jsx`, `Assets.jsx` | `server/src/routes/school_facilities.js`; link campus/room/assets, requests, work orders, vendors, and costs. |
| Integrations, Compliance & Data Governance | `src/pages/school/compliance/Integrations.jsx`, `ComplianceReports.jsx`, `DataGovernance.jsx` | `server/src/routes/school_integrations.js`; connect provider status, API/webhook events, jurisdiction reporting, consent/retention policies, and exports. |

Before creating migration filenames, inspect the highest existing migration number; do not assume the next number. Every proposed route must use the shared authenticated tenant/access context and must be registered/wired through the same documented pattern as existing School APIs.

## 5. How modules and submodules link

### Runtime and data flow

```text
src/school/menu.js
  -> src/app.jsx (hash -> module/sub)
  -> SchoolSidebar.jsx (permission-filtered navigation)
  -> SchoolPage.jsx (explicit module/sub dispatch)
  -> feature screen (or deliberate FormPage/formRegistry route)
  -> src/api.js
  -> /api/school + authenticated server routes
  -> tenant/access guard + domain service/query
  -> SQL tables, constraints, and transaction
  -> audit/event log
  -> response refreshes the originating screen and linked modules
```

The dynamic form framework is a parallel path:

```text
src/forms/<formId>/form.json
  -> FormPage.jsx + formRegistry.js
  -> configured List/Add/Edit/Print components
  -> configured API endpoint
```

Do not assume the second path is active for a menu item unless `App`/`SchoolPage` explicitly routes to it.

### Business data links to implement and test

| Starting event | Must link to | Required invariant |
|---|---|---|
| Inquiry/application approval | Student, guardian/family, campus, academic year, documents, audit | One approval creates one student/enrollment; retry cannot duplicate. |
| Student/class/section/year change | Current enrollment, attendance, timetable, exams, fees, reports | Current views agree; prior-year history is retained. |
| Attendance/marks/behavior | Student profile, notifications, intervention/support plans, reports, promotion eligibility | Consistent counts and access boundaries; sensitive notes never leak to general reports. |
| Student/staff schedule change | Timetable, substitutions, course/teacher assignment, portals | No teacher/room/class time conflicts; all role-specific views agree. |
| Invoice/payment/refund | Family account, receipts, general ledger, reminders, no-dues clearance | Each transaction posts once; balances reconcile and failed transactions roll back. |
| Student transport/hostel/library/canteen allocation | Student, campus, fees, safety/attendance, exit/archive state | Capacity and eligibility remain valid; exit/archive removes or closes active allocations per policy. |
| Documents/health/support/safeguarding | Student, file store, permissions, retention policy, audit | File and record share tenant/student ownership; only authorized roles can view sensitive data. |
| Module transaction | Reports, exports, automation triggers, audit | Derived views reconcile to source records and respect campus/year/role filters. |

## 6. Delivery phases and gates

### Phase 0 — Safe QA environment

- Create an isolated test database/company and test users; use synthetic student/guardian data and controlled files.
- Document connection/configuration and teardown. Back up before any migration test.
- Review every existing standalone test script for target database, writes/deletes, credentials, rate limits, and cleanup before use.
- Define stable fixtures: campuses, academic years, classes/sections, student/guardian, staff/roles, invoices/payments, documents, and one record per workflow state.
- Keep production/default tenant data untouched. Never run setup or bulk-seed scripts on it as a QA shortcut.

**Gate:** tests can create, reset, and remove their own data without affecting another tenant or environment.

### Phase 1 — Route, permission, and data map

- Inventory each menu parent and child route against the actual hash parser, screen, API method/path, permission key, table(s), and implementation status.
- Fix route fall-through and broken links; ensure refresh/deep-link/back navigation lands on the same feature.
- Resolve the permission guard/token mismatch and catalogue gaps; test view-only, manage, role-specific, and super-admin access.
- Choose the canonical admission/enquiry model and document migrations/data transition if duplicate models are retained.
- Record each module as `implemented`, `partial`, or `not implemented`; only mark a menu item built when its minimum workflow passes.

**Gate:** every menu destination has one owner screen and a traceable route → API → permission → schema mapping.

### Phase 2 — Shared foundation and core records

- Verify settings, tenants/campuses, academic years, roles, permissions, audit, document types, and shared lookup/options.
- Complete student, guardian, class, section, subject, and enrollment CRUD/link integrity.
- Establish error and empty/loading states, API response conventions, and audit behavior for mutations.
- Add DB constraints or transactional checks for critical unique/foreign-key/tenant relationships.

**Gate:** a fresh isolated tenant can be configured, a student enrolled, updated, archived, and found in all intended linked screens.

### Phase 3 — Admission-to-exit student lifecycle

- Finish inquiry/application/review/approval; prove approval is atomic and idempotent.
- Finish promotion preview/eligibility/execution and verify the prior academic-year record stays intact.
- Finish exit clearances, fee no-dues, TC issuance/numbering, document versioning/review, health, discipline, counseling, inclusion/IEP/intervention, and safeguarding workflows.
- Verify profile, audit, protected file access, and printable reports for permitted roles.

**Gate:** one synthetic student can traverse admission → enrollment → attendance/fees/documents → promotion or exit without orphaned or contradictory records.

### Phase 4 — Academic delivery

- Finish academics, timetable, attendance, examinations, report cards, and LMS/homework.
- Validate schedule/room/teacher conflicts, marks and grade boundaries, late/correction paths, and promotion data dependencies.

**Gate:** class setup → timetable → attendance/homework/exam/result → promotion has consistent linked data.

### Phase 5 — Finance and operations

- Finish Fees & Accounts (including the agreed accounting scope), HR & Payroll, Inventory & Assets, Transport, Hostel, Library, Canteen, and Facilities & Maintenance.
- Test each ledger/transaction as atomic, permission-checked, idempotent where appropriate, and auditable.
- Verify student/staff lifecycle changes propagate to allocations, balances, access, and reports.

**Gate:** balances, stock, capacity, and payment state reconcile to underlying transactions after success, rejection, retry, and rollback.

### Phase 6 — Office, communication, and engagement

- Finish Front Office, Communication, family/student/teacher self-service, Events & PTM/co-curricular activities, Certificates & ID, and Alumni & Placement.
- Test consent, audiences, booking capacity/conflicts, numbering, privacy, and safe simulated delivery.

**Gate:** a role-appropriate user can complete each workflow end-to-end and see only its authorized records.

### Phase 7 — Intelligence, administration, and platform

- Implement Reports & Analytics, Automation Center, Import & Export, AI Assistant, Integrations/Compliance/Data Governance, Settings, and Platform / Super Admin.
- Include dry-run/preview, export scoping, simulation, audit, tenant isolation, and safe behavior when integrations are unconfigured.

**Gate:** generated reports match source data; imports roll back safely; automations are repeatable; platform actions cannot cross tenant boundaries.

### Phase 8 — Full regression and release readiness

- Run all API, database integration, UI/browser, security, accessibility, responsive, print, migration, and performance suites in the isolated/staging environment.
- Re-run critical flows for each supported role and at least two tenants.
- Review unresolved defects and verify no production data, secrets, or real external integrations were used.

**Gate:** all critical/high-severity scenarios pass; no broken menu routes; no unowned data; no unauthorized access; release notes identify remaining limitations.

## 7. QA test catalogue

### Per-module minimum tests

For every module and each resource it owns:

1. **Navigation:** menu click, direct hash, refresh, back/forward, cross-link, unauthorized route, and a visible error/empty state.
2. **CRUD/workflow:** create/read/update/delete or archive/transition as designed; required/invalid input; duplicate/conflicting request; retry; stale record; not found.
3. **API contract:** authenticated success and expected `400`, `401`, `403`, `404`, `409`/conflict responses; response fields match UI assumptions.
4. **Database integrity:** tenant-scoped reads/writes, foreign keys, uniqueness, cascade/restrict behavior, transaction rollback, and audit row.
5. **Role matrix:** view-only cannot mutate; manage can perform allowed operations; sensitive roles see only the required fields; super-admin access is explicitly tested.
6. **Print/export:** correct filtered records and totals; headers/columns; multipage output; no navigation, controls, or hidden unrelated records; exported data honors permissions.
7. **Resilience:** empty/loading/error states, network failure, large list/pagination, date/time boundaries, and double-click/retry behavior.

### Cross-module invariant scenarios

- Admission approval creates one student, guardian link, campus/year enrollment, and audit record; duplicate approval does not create duplicates.
- Student class/section update is reflected in the current enrollment and attendance filters; prior-year enrollment remains unchanged.
- Attendance corrections and discipline suspension entries reconcile with attendance counts and reports.
- Fee payments update invoice balances exactly once; outstanding balances block TC where policy requires; TC closes active enrollment.
- Promotion eligibility reads the configured attendance/exam/fee data; execution creates the next-year enrollment and preserves source-year history.
- Document upload, version replacement, verification, download authorization, and missing-document report all reference the same student/document.
- Student archive/exit behavior is consistent in attendance, fees, transport, hostel, library, communications, and reports.
- Campus/year filters produce consistent results across dashboard, lists, and reports.
- Every cross-module mutation is audited with the actor, tenant, entity, and before/after state where applicable.
- Parent/student/teacher portal data matches the source SIS records and role-specific field visibility; portal changes are audited.
- IEP/intervention/counseling/safeguarding cases are inaccessible to ordinary teacher/parent roles unless explicitly authorized; exports and reports omit restricted notes.
- Facility bookings do not conflict; maintenance completion updates work-order and asset history; costs reconcile to finance.
- Provider outages, webhook replay, and SSO failure do not duplicate or expose records; retention/export policies are enforced.

### Security, accessibility, and operational QA

- Tenant A cannot read, update, delete, export, or download Tenant B records by changing IDs, filters, file keys, or request payloads.
- Test permission bypass attempts for every route, including direct API calls outside the UI.
- Validate upload content/type/size, randomized storage key, protected download, and rejection of traversal/unsupported content.
- Keyboard-only navigation, labels/focus/errors, visible focus, contrast, responsive narrow-screen layout, and accessible dialogs.
- Test print preview on a supported browser for list/profile and each implemented report; confirm page breaks and page orientation.
- Run critical API load checks against isolated data only; monitor query latency and rate-limit behavior without stressing shared/production infrastructure.

## 8. Test layers and implementation backlog

1. **Database/migration tests:** schema prerequisites, repeatable migrations, constraints/indexes, rollback plan, and a clean-tenant install. Do not assume the main `setup` command is safe for QA.
2. **Backend unit/integration tests:** authorization helpers, validators, state transitions, transactions, tenant scoping, and each API success/failure contract.
3. **Frontend tests:** shared forms, route mapping, validation, mutation states, refresh behavior, and print controls.
4. **Browser end-to-end tests:** login → navigate → perform workflow → verify linked record → print/export. Use isolated synthetic tenants and deterministic fixtures.
5. **Regression/security suites:** role/tenant matrix and cross-module invariants on every release candidate.

Add a standard, safe test runner and CI workflow only after reviewing existing scripts and choosing a non-production test database. Consolidate ad hoc checks into repeatable tests with explicit setup/cleanup; do not silently reuse destructive scripts. Keep `npm run build` as the existing production-build gate.

## 9. Completion tracking

Track each module with these fields in the implementation tracker:

- Screen/route and API/schema mapping complete.
- Required workflows and CRUD behavior implemented.
- View/manage and tenant isolation tests pass.
- Positive, negative, retry, and transaction tests pass.
- Cross-module invariants pass.
- Print/export, accessibility, and responsive checks pass where applicable.
- Known limitations, data migration, and operational notes documented.

A module is **QA complete** only when all applicable fields pass in the isolated/staging environment, the menu accurately communicates its availability, and no open critical/high-severity defect remains. Testing cannot prove that software will never have an error; release readiness means the defined gates pass and known limitations are recorded.

## 10. Section-by-section build specification and QA plan

Use this section as the implementation order. Each module section defines its required scope, intended behavior, upstream/downstream links, and minimum module-specific tests. `Core` means required for a usable school SIS; `Conditional` means required when the school operates that service or local law requires it; `Later` means valuable but can follow stable core workflows.

The `M01`–`M33` labels are independently testable work packages, not a new industry module count. Student Documents and Promotion/Exit are split out from the Students menu area so they can be built and signed off as separate workflows; the plan still covers 31 planning domains (26 current menu areas plus five recommendations).

**Standalone specs:** build each package from its individual file in [`modules/00-index.md`](modules/00-index.md). That index links every module plan and contains the shared QA contract and build order; the detailed specs below remain the consolidated overview.

### Build order

1. **Safe base:** isolated QA database, route/file inventory, tenant context, authentication, permission checks, audit, settings, campuses, academic years, and integrations framework.
2. **Student record lifecycle:** academics master data → admission → student/enrollment → guardian/family portals → documents, health/support, safety, and exit.
3. **Teaching and learning:** timetable → attendance → assessment/exams → LMS/homework → promotion/report cards.
4. **Money and operations:** fees/accounting → HR/payroll → inventory/procurement → transport/hostel/library/canteen/facilities.
5. **Communication and engagement:** front office → communications → portals → events/PTM → certificates → alumni.
6. **Management and release:** reports → automation → import/export → AI (if approved) → full regression and release gate.

Do not begin downstream screens until their upstream data contract, permission key, API, and migration have owners. A section is not finished when its form renders; it is finished when its workflow and linkage tests pass.

### Shared implementation and QA contract

Apply these checks to every module section below:

- **Route:** menu click, direct `#/school/...` URL, refresh, browser back/forward, invalid child route, and permission-filtered visibility.
- **Mutation:** create/read/update/archive/delete as appropriate, valid and invalid data, duplicate submission, retry, stale ID, not found, and visible success/error response.
- **API and data:** authenticated request, expected `400/401/403/404/409` responses, tenant-scoped query, foreign-key/unique constraints, transaction rollback, and audit event.
- **Roles:** view-only, module manager, sensitive-data role, and super-admin; the server must enforce permissions independently of hidden UI controls.
- **Output:** filters and totals match source records; print/export hides actions and never includes unauthorized fields.
- **Quality gate:** tests run on isolated synthetic data, pass without console/API/SQL errors, and leave no duplicate/orphan records after retries.

### A. Shared platform and school foundation

#### M01 — Platform / Super Admin (Conditional by deployment model)

- **Submodules:** tenant/company provisioning; tenant activation/suspension; subscription/limits; support access; platform audit.
- **Must work:** platform admins provision a tenant without exposing another tenant's users, data, files, or configuration; tenant suspension blocks sign-in and APIs according to policy.
- **Links:** identity/authentication → tenant context → every school module; platform actions → audit and support logs.
- **QA:** non-super-admin gets `403` on every platform endpoint; tenant A cannot enumerate/read/change tenant B by ID or file key; suspend/reactivate behavior is consistent; every privileged action records actor, tenant, time, and target.

#### M02 — Settings and Organization (Core)

- **Submodules:** institute profile/branding; campuses; academic years/terms; school calendar/holidays; roles/permissions; users/access; document types; approval flows; feature options.
- **Must work:** setup creates valid organization context; year/campus selection is used by downstream workflows; role changes take effect on next request/session refresh; invalid dates, duplicate codes, and privilege escalation are rejected.
- **Links:** settings → all screens/reports; campus/year → students, classes, attendance, fees, timetable, exams, payroll, and reports.
- **QA:** create/update/deactivate settings; reject overlapping/invalid years where policy prohibits; verify campus/year filters downstream; view-only cannot alter roles; removing a permission revokes API access; audit all security-sensitive changes.

#### M03 — Integrations, Compliance & Data Governance (Core capability; legal scope is Conditional)

- **Submodules:** provider registry/secrets; SSO/identity; API keys/webhooks; sync jobs and retry/dead-letter logs; consent; retention/deletion; data export governance; jurisdiction-specific reporting.
- **Must work:** integrations are disabled until configured; secrets never return in list responses/logs; repeated webhook delivery is idempotent; failed synchronization is visible and retryable; retention/export policies are enforced.
- **Links:** providers ↔ admissions, payments, communication, LMS, identity, and reporting; governance ↔ all records/files and audit.
- **QA:** invalid credentials, expired credentials, timeout, replayed webhook, malformed payload, and retry are covered; secrets are redacted; tenant A credentials cannot operate on tenant B; export and deletion honor role, consent, and retention.

#### M04 — Dashboard (Core)

- **Submodules:** role-specific overview; campus/year filters; alerts; recent activity; shortcuts; KPI drill-down.
- **Must work:** dashboard shows scoped, explainable aggregates and each card opens the exact filtered module/list behind that count.
- **Links:** reads from student, attendance, fees, admissions, exams, and notification data; must not own duplicate business data.
- **QA:** compare every displayed count/sum to source SQL fixtures; test empty state, time boundaries, campus/year changes, role restrictions, and shortcut deep links.

### B. Student lifecycle and care

#### M05 — Academics Master Data (Core)

- **Submodules:** classes/sections; subjects/courses; academic years/terms; subject allocation; rooms; curriculum/standards; lesson plans; homework; assignment/gradebook setup.
- **Must work:** establish validated class/section/course structure before enrollment; prevent duplicate names/codes and mismatched class/section/subject references; preserve history when structure changes.
- **Links:** foundation campus/year → classes/sections → students, timetable, attendance, exams, LMS, and reports.
- **QA:** CRUD plus duplicate and invalid parent references; student cannot be assigned to a section outside its class; deleting a referenced entity follows documented restrict/archive behavior; assignments and gradebook show correct course/class.

#### M06 — Admission & CRM (Core)

- **Submodules:** inquiry/lead capture; follow-up/assignment; application and document checklist; review; waitlist/reject; approval; registration/admission fee; re-enrollment.
- **Must work:** inquiry → application → submit → review → approve creates one student, family/guardian link, enrollment, and audit record in one transaction; rejection/waitlist require valid state/reason; application files are protected.
- **Links:** source/campaign → inquiry → student/family → class/year → fees/documents/communication.
- **QA:** full approve/reject/waitlist path; duplicate approval/retry; required and rejected documents; invalid state transition; cross-tenant IDs; interrupted transaction leaves no partial student; verify inquiry and application records are not split between competing models.

#### M07 — Students & Enrollment (Core)

- **Submodules:** student master; search/filter; profile; guardian/family; sibling links; enrollment history; status/archive; authorized pickup; student documents; audit.
- **Must work:** create/read/update/archive while preserving history; admission number is unique in tenant; current enrollment matches current class/section/roll while prior years remain intact; profile tabs show linked records.
- **Links:** admissions → student; student ↔ family, class/year, attendance, fees, timetable, exams, LMS, services, transport, hostel, library, and portals.
- **QA:** full CRUD; duplicate admission no; changing class updates current enrollment only; archived student disappears from active lists but remains in historical reports; guardian link/edit/unlink and print profile; unauthorized health/discipline fields stay hidden.

#### M08 — Portals & Self-Service (Core)

- **Submodules:** family/parent portal; student portal; teacher portal; online enrollment/re-enrollment; profile/consent forms; notices/messages; schedule/attendance/grades/homework; balances/payments.
- **Must work:** each account sees only its linked family/student/class records; portal edits update the same source records and show approval status where staff review is required.
- **Links:** identity and guardian/student/staff associations → SIS, attendance, fees, timetable, exams, LMS, communications, and events.
- **QA:** parent with two linked students sees exactly both; parent cannot change grades or view unrelated student data; student/teacher role scopes; consent revocation; mobile viewport and keyboard navigation; API tampering returns `403`.

#### M09 — Student Support & Inclusion (Core capability; local IEP rules Conditional)

- **Submodules:** health/nurse profile and events; immunization/medication; counselor referrals/cases; IEP/accommodations; MTSS/intervention plan; goals/services/progress; family follow-up.
- **Must work:** authorized professionals can record case-specific information and follow-up; accommodations are visible only to staff who need them; general dashboards/reports never expose private case notes.
- **Links:** student → support case → attendance/assessment accommodations → family contact; protected files → document service/audit.
- **QA:** health officer/counselor/specialist permissions; teacher receives only approved accommodation summary; parent sees only released information; file access, retention, audit, and report/export redaction; test date and referral state transitions.

#### M10 — Safety & Safeguarding (Core capability; exact policy/jurisdiction Conditional)

- **Submodules:** visitor checks; pickup/gate-pass authorization; safeguarding report/intake; restricted case/evidence; escalation/follow-up; emergency contacts; emergency plans/drills.
- **Must work:** safety case can be reported, triaged, assigned, escalated, and closed with restricted access and immutable audit; visitor/pickup decisions use authorized student contacts.
- **Links:** front office/visitor → student/family → safety case; discipline/support may receive policy-approved references, not unrestricted case notes.
- **QA:** unauthorized staff denied; evidence download scoped; escalation/closure logged; emergency contact visible in authorized workflow; test repeated report, mistaken closure/reopen, retention, and audit export restrictions.

#### M11 — Student Documents & Records (Core)

- **Submodules:** document types/requirements; upload; verification/rejection; version history; expiry; missing-document report; protected viewing/download.
- **Must work:** each file belongs to one tenant/student/context; replacement creates a new version; rejection includes reason; prior version and audit remain discoverable according to retention rules.
- **Links:** admission checklist ↔ student profile ↔ health/support/safety contexts ↔ certificates and reports.
- **QA:** valid/invalid content and size; tenant/file-key tampering; version replacement; verification state and rejection reason; expired/missing report reconciliation; inaccessible download without authorization.

#### M12 — Promotion, Transfer & Exit (Core)

- **Submodules:** promotion run/preview; eligibility rules; promoted/detained decisions; next-year enrollment; exit request; departmental/fee clearance; transfer certificate; close/re-admit.
- **Must work:** preview lists the exact eligible student set; execute is transactional/idempotent; TC is blocked by required clearances; issue closes active enrollment and preserves earlier history.
- **Links:** exams/attendance/fees → promotion; student/family/clearances → TC/document/certificate → alumni eligibility.
- **QA:** eligibility boundary tests; mixed promoted/detained group; retry/double execute; blocked clearance and outstanding fee; atomic numbering under concurrent issue; verify active status and enrollment after issue/close/re-admit.

### C. Teaching, learning, and assessment

#### M13 — Timetable (Core)

- **Submodules:** timetable master; periods/rooms; teacher/class/subject allocation; student/teacher timetable; substitutions; publish/version history.
- **Must work:** draft schedule validates room/teacher/class conflicts; published version is consistent for every role; substitution updates affected views and retains original timetable history.
- **Links:** academics master data + staff → attendance, LMS, portal, room facilities, and reports.
- **QA:** overlapping teacher, room, and class periods rejected; valid substitution; publish/unpublish permissions; academic-year boundary; student and teacher schedule equality.

#### M14 — Attendance (Core)

- **Submodules:** student daily/period attendance; staff attendance; bulk mark; corrections/approvals; registers; summaries/reports; notifications.
- **Must work:** one authoritative attendance record per applicable student/class/period/date; correction is audited; totals and notifications reflect saved—not unsaved—data.
- **Links:** student/enrollment + timetable → attendance; attendance → dashboard, family portal, interventions, discipline, payroll (staff), fees/eligibility if policy requires, and reports.
- **QA:** duplicate date/period; bulk partial failure; absent/late/excused/correction; wrong section/tenant ID; count reconciliation; notification dedupe; staff attendance not mixed with students.

#### M15 — Examinations & Gradebook (Core)

- **Submodules:** exam calendar/schedule; assessment setup; marks entry/import; grading scales; report cards/comments; transcripts; result publication; graduation checks.
- **Must work:** teacher enters only assigned assessments; marks obey maximum/rubric; grades calculate deterministically; report card is reproducible and reflects published source marks.
- **Links:** academic setup/timetable/staff → assessments → student profile/portals/reports/promotion.
- **QA:** min/max/decimal/absent cases; unauthorized grade entry; grade-scale boundaries; recalculation after correction; unpublished results hidden; report card totals match marks; duplicate upload/import.

#### M16 — Learning Management (Core capability; advanced LMS scope may vary)

- **Submodules:** courses/materials; assignments/homework; quizzes; submissions/attachments; grading/feedback; progress.
- **Must work:** teacher assigns to an authorized class; student submits within policy; staff review updates grade/progress; due-date and late policy are visible.
- **Links:** class/course/staff/student → timetable, gradebook, portals, notifications, and reports.
- **QA:** class membership; due/late boundary; attachment security; duplicate submission/idempotency; teacher/student visibility; grade synchronization and feedback privacy.

### D. Finance, workforce, and school operations

#### M17 — Fees & Accounting (Core fees; full accounting depth Conditional)

- **Submodules:** fee heads/plans; invoices; scholarships/discounts; online/offline payments; receipts; refunds/adjustments; dues/reminders; accounts payable/receivable; general ledger/journals; budgets; bank reconciliation.
- **Must work:** invoice, payment, refund, and ledger posting are transactional; balances derive from transactions; payment retry cannot double-post; policy-driven dues feed no-dues checks.
- **Links:** student/family → fees/payment → ledger/reports/automation; fees → promotion/TC and optional transport/hostel/canteen charges.
- **QA:** overpayment, partial payment, concurrent payment, duplicate gateway callback, refund rollback, ledger reconciliation, campus/year scope, receipt print, and outstanding-balance clearance.

#### M18 — HR & Payroll (Core workforce; payroll law Conditional)

- **Submodules:** staff master; contracts/roles; leave; attendance; payroll components; pay runs; advances/deductions; payslips/reports.
- **Must work:** staff role controls teaching and approvals; payroll is calculated from approved inputs, posted once, and restricted to authorized roles.
- **Links:** staff → timetable/attendance/LMS/approvals; HR attendance/leave → payroll; payroll → finance/ledger.
- **QA:** salary visibility; leave balances; boundary calculations; duplicate pay run; reversal/correction; role termination blocks access; payslip totals reconcile to ledger.

#### M19 — Inventory, Procurement & Assets (Conditional by school operations)

- **Submodules:** catalog/categories; vendors; purchase requests/orders; receiving; stock ledger; issue/return; fixed assets; depreciation/maintenance.
- **Must work:** every stock change has a source transaction; purchase and issue are atomic; stock cannot go negative unless a documented policy allows it.
- **Links:** departments/canteen/facilities → requisition/purchase → inventory/assets → finance and reports.
- **QA:** concurrent issue of final item; rejected receipt; duplicate order; return and adjustment; asset assignment/retirement; ledger/cost reconciliation and audit.

#### M20 — Transport (Conditional by school)

- **Submodules:** routes/stops; vehicles/drivers; capacity/inspection; student allocation; trips/attendance; tracking; transport fees.
- **Must work:** allocation respects capacity and route/stop; changes are reflected in emergency/pickup views and transport charges; trip status is auditable.
- **Links:** student/family → route/fee → attendance, safety, communication, and exit.
- **QA:** over-capacity, invalid driver/vehicle, duplicate allocation, route change, student exit, simulated tracking outage, and fee/report reconciliation.

#### M21 — Hostel / Residential Life (Conditional by school)

- **Submodules:** buildings/rooms/beds; allocation; occupancy/roll call; leave/gate pass; visitors; hostel fees; incident referral.
- **Must work:** one valid active bed allocation per student under policy; occupancy cannot exceed capacity; leave and roll call respect permissions.
- **Links:** student/family → bed/attendance/fee → safety, notifications, and exit.
- **QA:** capacity/duplicate allocation; room move; overnight pass authorization; missed roll call alert; exit/release; hostel fees and occupancy report reconcile.

#### M22 — Library (Conditional service; common capability)

- **Submodules:** catalog/copies; members; issue/return/renewal; reservations; fines; acquisition; reports.
- **Must work:** copy availability, due date, renewal limit, and fine calculation are consistent across concurrent requests.
- **Links:** student/staff identity → circulation → fines/fees, portals, notices, and reports.
- **QA:** issue final copy concurrently; overdue boundaries; lost/damaged copy; fine waiver approval; archive/exit behavior; catalog and circulation totals.

#### M23 — Canteen / Food Service (Conditional by school)

- **Submodules:** menus/dietary data; orders/POS; meal accounts/wallets; limits/subsidies; sales/refunds; stock; nutrition/allergen controls.
- **Must work:** order charge, wallet balance, and stock movement commit together; allergen/dietary restrictions are visible only as needed; refunds reverse the original posting.
- **Links:** student/family → wallet/order → inventory, fees/ledger, dietary support, and reports.
- **QA:** duplicate tap/payment callback; insufficient funds/limit; allergy warning; unavailable stock; refund rollback; meal reports reconcile to wallet and inventory.

#### M24 — Facilities & Maintenance (Core for facilities-managed schools)

- **Submodules:** campus/building/rooms; room booking; maintenance requests; work orders; preventive maintenance; vendors/costs; asset links.
- **Must work:** room schedules prevent conflicts; requests move through triage/assignment/work/completion; completed work updates asset and cost history.
- **Links:** settings/campus → rooms/timetable/events; assets/procurement → work orders; cost → finance/reports.
- **QA:** room double booking; unauthorized close; work order reopen; overdue preventative schedule; vendor/cost totals and asset history reconcile.

### E. Office, communications, and community

#### M25 — Front Office (Core)

- **Submodules:** enquiry; visitor check-in/out; appointments; call log; complaints/helpdesk; gate pass; reception dashboard.
- **Must work:** visitors are checked in/out with authorized host; complaints have ownership/status/closure; student lookups honor scope.
- **Links:** admissions, student/family, safety, events, and communications.
- **QA:** duplicate/open visitor, invalid student/host, lost badge or early check-out, complaint escalation, privacy, and audit.

#### M26 — Communication (Core)

- **Submodules:** SMS/email/app/notice; templates; recipient lists; consent/preferences; queued messages; delivery/retry logs; provider configuration.
- **Must work:** audience is computed from authorized source records; opt-outs are honored; test mode is simulated; retry does not send duplicate messages.
- **Links:** student/family/staff → admissions, attendance, fees, health/safety policy notifications, events, and automation.
- **QA:** consent/opt-out; role and tenant audience filters; missing provider; failed/late/replayed callback; template escaping; no real outbound call in QA.

#### M27 — Events, PTM & Co-curricular Activities (Core events; activities Conditional)

- **Submodules:** event calendar/list; registration; PTM slots; clubs/activities/sports; trips/permission forms; gallery/media.
- **Must work:** event capacity and schedule conflicts are enforced; guardians can register only linked students; required consent is captured before trips.
- **Links:** calendar ↔ timetable/facilities; PTM ↔ family portal/communication; activity participation ↔ attendance/fees/reports.
- **QA:** full/overlapping event; duplicate registration; guardian link check; cancellation/refund/notification; consent missing; media privacy.

#### M28 — Certificates & ID (Core records; ID card scope varies)

- **Submodules:** templates; student/staff ID cards; certificate generation; TC; numbering; reprint/revoke; secure download/print.
- **Must work:** generated document uses authoritative student/enrollment data; serials are unique; TC generation requires exit workflow state; reprint is audited.
- **Links:** student/enrollment/exit → template → protected file/print and audit.
- **QA:** numbering concurrency; missing required data; stale enrollment; unauthorized print/download; revoke/reprint; verify QR/barcode resolves only permitted data.

#### M29 — Alumni & Placement (Later / Conditional)

- **Submodules:** graduate transition; directory; consent/preferences; alumni events; mentoring/jobs/placement; donations.
- **Must work:** only eligible graduates transition; alumni can maintain permitted profile fields; donations/jobs respect privacy and financial controls.
- **Links:** graduation/exit → alumni identity → events, communications, placements, donations, and reports.
- **QA:** non-graduate blocked; duplicate transition; consent withdrawal; job posting moderation; donation reconciliation; alumni cannot access active-student data.

### F. Intelligence and controlled automation

#### M30 — Reports & Analytics (Core)

- **Submodules:** operational reports; academic/student reports; attendance/fees/finance; exports; dashboards; custom report definitions.
- **Must work:** report definitions have source, filters, permissions, and calculation documented; totals reconcile to source; exports use the same scope as on-screen results.
- **Links:** read-only governed views over all modules; never become a second source of truth.
- **QA:** independent fixture reconciliation; filters, pagination, date/campus/year and role scoping; empty/large dataset; CSV/print; restricted fields excluded.

#### M31 — Automation Center (Core automations; external delivery Conditional)

- **Submodules:** event/rule definitions; schedules/triggers; templates; dry-run; run history; retry/dead-letter; provider connectors.
- **Must work:** rules are versioned, permissioned, idempotent, observable, and safe when providers are absent; actions cannot bypass module permissions.
- **Links:** attendance/fees/admissions/events → rule → notifications/tasks; outcomes → audit/logs/reports.
- **QA:** simulate rule with fixtures; duplicate trigger; disabled rule; provider outage; retry; invalid template; prove no outbound request in test and no duplicate business mutation.

#### M32 — Import & Export (Core data operations)

- **Submodules:** schema/template download; upload; column mapping; validation preview; dry run; commit/rollback; export.
- **Must work:** preview identifies row errors before commit; import is atomic or clearly row-transactional by policy; duplicates are handled explicitly; export honors permissions and tenant scope.
- **Links:** external data ↔ student, fees, attendance, and other explicitly supported sources; import results → audit/report.
- **QA:** malformed/oversized file; invalid encoding/date; duplicate rows; foreign tenant IDs; partial failure/rollback; repeated upload; export PII/role filtering; verify count and errors.

#### M33 — AI Assistant (Later; only after governance approval)

- **Submodules:** approved use cases; permission-aware retrieval; prompt/tool policy; citations/source links; feedback; usage/audit; disable switch.
- **Must work:** assistant answers only from authorized records, distinguishes unknown data, does not mutate critical records without explicit approved workflow, and is off when provider/configuration is absent.
- **Links:** governed reports and permitted module data → assistant; no direct bypass around API access controls.
- **QA:** prompt injection attempts, cross-tenant and restricted health/safety requests, fabricated-data prompts, tool/action confirmation, provider failure, and audit of data access.

## 11. End-to-end linkage test suite

Build these as stable, repeatable browser/API integration scenarios with synthetic fixtures. A test passes only when the UI, API response, database rows, audit record, and linked screen/report agree.

| Test ID | Journey | Expected linked result |
|---|---|---|
| LINK-01 | Configure tenant → campus/year → roles/users → classes/sections/subjects | All later writes carry the correct tenant/campus/year and permitted actor. |
| LINK-02 | Inquiry → application/documents → approval → student/guardian/enrollment | Exactly one consistent student/family/enrollment; retry has no duplicate. |
| LINK-03 | Student class change → enrollment → timetable/attendance/exam/LMS | Current year follows the new class; old year remains unchanged; no wrong section appears. |
| LINK-04 | Attendance/assessment/discipline → support/intervention → portal/report | Correct totals and permitted summaries; sensitive case notes stay restricted. |
| LINK-05 | Invoice → payment/refund → ledger/receipt/dashboard/report | Balances post once and reconcile; failed/replayed callback does not double charge. |
| LINK-06 | Fee dues + department clearance → TC → enrollment/active lists/certificate | TC stays blocked until policy clearance; issue closes the active enrollment once. |
| LINK-07 | Promotion preview → execution → next-year class/fees/timetable/portal | Promoted and detained decisions are correct; histories and downstream views reconcile. |
| LINK-08 | Transport/hostel/library/canteen allocation → student exit/archive | Allocations, balances, capacity, and access close or transfer per policy without orphan rows. |
| LINK-09 | Upload/verify/replace → protected file download → missing-doc report/export | Same version/student/type across UI and DB; unauthorized access/export fails. |
| LINK-10 | Staff/leave/payroll → timetable/attendance/ledger/payslip | Authorized staff assignment and payroll totals match approved inputs and accounts. |
| LINK-11 | Event/PTM/room booking → family portal/communication/facility calendar | Capacity, consent, notification, and room schedule agree after update/cancel. |
| LINK-12 | Two tenants, multiple roles → every route, report, export, and file | No unauthorized cross-tenant or cross-role data access by UI or direct API. |

## 12. Per-section execution record

For every `M01`–`M33` section, maintain a small issue/test record containing:

1. **Scope decision:** Core/Conditional/Later; included submodules; jurisdiction-specific rules; exclusions.
2. **Implementation map:** menu path, screen file, API path/route file, permission key, schema/migration, and audit event.
3. **Dependencies and consumers:** upstream records required and downstream modules affected.
4. **Test evidence:** automated test IDs, synthetic fixture IDs, API/browser result, migration result, and print/export sample where applicable.
5. **Defects and sign-off:** severity, owner, fix/retest link, known limitations, and module owner approval.

Do not mark a module “working” based only on a successful build or an HTTP `200`. The module is ready only when its module-specific QA above and every applicable `LINK-*` scenario pass, the data reconciles, and no critical/high-severity defect remains.
