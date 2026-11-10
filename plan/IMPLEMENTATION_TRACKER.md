# Implementation and QA Tracker

Update a row only with implementation evidence. Link PR/commit and test IDs when work begins; record role, tenant, environment, and result. `Audit first` means inspect existing code before deciding whether work is missing.

| ID | Work package | Initial action | Implementation status | QA status | Owner / evidence |
|---|---|---|---|---|---|
| M01 | Platform / Super Admin | Audit first | Not recorded | Not verified | |
| M02 | Settings and Organization | Audit first | Not recorded | Not verified | |
| M03 | Integrations, Compliance & Data Governance | Scope and audit | Not recorded | Not verified | |
| M04 | Dashboard | Audit first | Not recorded | Not verified | |
| M05 | Academics Master Data | Audit and wire six menu children | Partial / six screens and APIs exist; homework role grants, protected attachments, migration safety, and workflow linkage remain | Build/syntax and schema smoke checked; CRUD and `AC-LINK-*` not verified | `plan/academics/README.md`, six child plans, and `plan/academics/REMAINING.md` |
| M06 | Admission & CRM | Reconcile data model | Partial / student-photo handoff | Build/syntax and schema smoke checked; CRUD not verified | `plan/STUDENT_SECTION_REMEDIATION.md` |
| M07 | Students & Enrollment | Audit linkage/history | Partial / student photo, row print, and class-first selection | Build/syntax and schema smoke checked; CRUD/UI flows not verified | `plan/STUDENT_SECTION_REMEDIATION.md` |
| M08 | Portals & Self-Service | New capability | Not started | Not verified | |
| M09 | Student Support & Inclusion | Define privacy policy | Partial / student-linked health records and Health render hardening | Build/syntax and schema smoke checked; CRUD/UI flows not verified | `plan/STUDENT_SECTION_REMEDIATION.md` |
| M10 | Safety & Safeguarding | Define restricted access | Partial / extend | Not verified | |
| M11 | Student Documents & Records | Audit first | Partial / student identity and class-first filters/uploads | Build/syntax and schema smoke checked; CRUD/UI flows not verified | `plan/STUDENT_SECTION_REMEDIATION.md` |
| M12 | Promotion, Transfer & Exit | Audit workflow/idempotency | Partial / section choices, identity, and academic-year source | Build/syntax and schema smoke checked; CRUD/UI flows not verified | `plan/STUDENT_SECTION_REMEDIATION.md` |
| M13 | Timetable | Versioned weekly schedule, shared date resolver, and linked views | Partial / four screens and core API workflows exist; versioning, periods, calendar overrides, and year-scoped time conflicts remain | 25 API workflow checks pass; browser and attendance/report linkage not verified | `plan/timetable/README.md` and phased plans |
| M14 | Attendance | Audit first | Partial / verify | Not verified | |
| M15 | Examinations & Gradebook | Verify dedicated route | Partial / verify | Not verified | |
| M16 | Learning Management | Verify workflow depth | Partial / verify | Not verified | |
| M17 | Fees & Accounting | Define accounting scope | Partial / verify | Not verified | |
| M18 | HR & Payroll | Verify guard/catalogue | Partial / verify | Not verified | |
| M19 | Inventory, Procurement & Assets | Audit ledger behavior | Partial / verify | Not verified | |
| M20 | Transport | Verify workflow coverage | Partial / verify | Not verified | |
| M21 | Hostel / Residential Life | Verify workflow coverage | Partial / verify | Not verified | |
| M22 | Library | Verify circulation integrity | Partial / verify | Not verified | |
| M23 | Canteen / Food Service | Verify API/screen | Unverified | Not verified | |
| M24 | Facilities & Maintenance | New capability | Not started | Not verified | |
| M25 | Front Office | Verify workflow coverage | Partial / verify | Not verified | |
| M26 | Communication | Verify consent/provider safety | Partial / verify | Not verified | |
| M27 | Events, PTM & Co-curricular Activities | Verify workflow coverage | Partial / verify | Not verified | |
| M28 | Certificates & ID | Verify numbering/protection | Partial / verify | Not verified | |
| M29 | Alumni & Placement | Verify dedicated API/UI | Unverified | Not verified | |
| M30 | Reports & Analytics | Replace placeholders/verify | Incomplete / verify | Not verified | |
| M31 | Automation Center | Verify idempotency/simulation | Partial / verify | Not verified | |
| M32 | Import & Export | Verify API/UI safety | Unverified | Not verified | |
| M33 | AI Assistant | Governance decision first | Not started / gated | Not verified | |

## Shared issue status

- [ ] Resolve route permission guard and leave permission catalogue mismatch.
- [ ] Choose canonical admissions/enquiry data model.
- [ ] Map every `built` menu child to screen/API/schema/permission/test.
- [ ] Establish isolated test database, fixtures, and cleanup.
- [ ] Add standard automated test runner and CI after safety review.
- [ ] Pass `LINK-01`–`LINK-12` and all applicable module test suites.
