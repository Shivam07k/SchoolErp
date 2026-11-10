# Standalone School ERP Module Plans

These files are the detailed, independently buildable specifications for the 33 work packages in [`ALL_MODULES_QA_PLAN.md`](../ALL_MODULES_QA_PLAN.md). They cover the 26 current menu areas, five recommended capability domains, and separate Student Documents and Promotion/Exit work packages.

## Build order

1. Foundation and access: M01–M04.
2. Student lifecycle and care: M05–M12.
3. Teaching and learning: M13–M16.
4. Finance and operations: M17–M24.
5. Office and engagement: M25–M29.
6. Intelligence and controlled automation: M30–M33.

Dependencies still apply inside each group; for example, configure campus/year and classes before admitting/enrolling students.

## Module plans

### Foundation and access

- [M01 — Platform / Super Admin](M01-platform-super-admin.md)
- [M02 — Settings and Organization](M02-settings-organization.md)
- [M03 — Integrations, Compliance & Data Governance](M03-integrations-compliance-data-governance.md)
- [M04 — Dashboard](M04-dashboard.md)

### Student lifecycle and care

- [M05 — Academics Master Data](M05-academics-master-data.md)
  - Detailed six-submodule plans: [Academics](../academics/README.md).
- [M06 — Admission & CRM](M06-admission-crm.md)
- [M07 — Students & Enrollment](M07-students-enrollment.md)
- [M08 — Portals & Self-Service](M08-portals-self-service.md)
- [M09 — Student Support & Inclusion](M09-student-support-inclusion.md)
- [M10 — Safety & Safeguarding](M10-safety-safeguarding.md)
- [M11 — Student Documents & Records](M11-student-documents-records.md)
- [M12 — Promotion, Transfer & Exit](M12-promotion-transfer-exit.md)

### Teaching and learning

- [M13 — Timetable](M13-timetable.md)
- [M14 — Attendance](M14-attendance.md)
- [M15 — Examinations & Gradebook](M15-examinations-gradebook.md)
- [M16 — Learning Management](M16-learning-management.md)

### Finance and operations

- [M17 — Fees & Accounting](M17-fees-accounting.md)
- [M18 — HR & Payroll](M18-hr-payroll.md)
- [M19 — Inventory, Procurement & Assets](M19-inventory-procurement-assets.md)
- [M20 — Transport](M20-transport.md)
- [M21 — Hostel / Residential Life](M21-hostel-residential-life.md)
- [M22 — Library](M22-library.md)
- [M23 — Canteen / Food Service](M23-canteen-food-service.md)
- [M24 — Facilities & Maintenance](M24-facilities-maintenance.md)

### Office and engagement

- [M25 — Front Office](M25-front-office.md)
- [M26 — Communication](M26-communication.md)
- [M27 — Events, PTM & Co-curricular Activities](M27-events-ptm-cocurricular.md)
- [M28 — Certificates & ID](M28-certificates-id.md)
- [M29 — Alumni & Placement](M29-alumni-placement.md)

### Intelligence and automation

- [M30 — Reports & Analytics](M30-reports-analytics.md)
- [M31 — Automation Center](M31-automation-center.md)
- [M32 — Import & Export](M32-import-export.md)
- [M33 — AI Assistant](M33-ai-assistant.md)

## Shared QA contract

Every module plan must pass these checks in an isolated test tenant:

- Route/menu click, direct URL, refresh, back/forward, invalid route, and permission-filtered visibility.
- CRUD or workflow transitions, invalid input, duplicates, retry/double-submit, stale IDs, and not-found behavior.
- API authentication/authorization and expected `400`, `401`, `403`, `404`, and conflict responses.
- Tenant-scoped data access, constraints, transaction rollback, audit events, and linked-screen refresh.
- View-only, manage, sensitive-data, and super-admin roles; server authorization must work without relying on hidden UI controls.
- Print/export outputs match filtered data, omit controls, and exclude unauthorized fields.
- No open critical/high-severity defects; all module-specific tests and applicable linkage tests pass.

## Cross-module linkage suite

Run the numbered scenarios in the master plan's **End-to-end linkage test suite** (`LINK-01`–`LINK-12`). The owning module documents which linkage IDs apply; tests verify UI, API, database, audit, and report outputs agree.

## File ownership

Current shared wiring is documented in the master plan's **Current route, submodule, and file map**. Proposed files in an individual module plan do not exist yet; add them only after the route, permission, schema, and integration owner are agreed.
