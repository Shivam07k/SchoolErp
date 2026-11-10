# School ERP QA and Implementation Gaps

This register separates findings visible in the repository from issues requiring a safe runtime test. “Unverified” means no passing end-to-end evidence is recorded; it does not assert that every code path is broken.

## P0 — Security and data integrity gates

| Gap | Evidence / status | Required closure |
|---|---|---|
| Inconsistent school permission checks | `school_more.js` and `school_comprehensive.js` check `req.user.permissions`, while school access is resolved through the foundation. Confirm runtime behavior for admin and non-admin users. | Standardize a server-side permission guard; test view, manage, denied, and super-admin roles on every endpoint. |
| Tenant isolation not demonstrated for all route groups | Staging checks now reject unknown tenants, enforce current-session company context, invalidate rotated tokens, restrict log files to the authenticated company, and reject forged paths. Full authenticated two-tenant coverage remains incomplete. | Add two-tenant API tests for reads, writes, exports, and uploads; test forged IDs and file keys. |
| Sensitive health/support/safeguarding data | Student health and discipline routes exist; new support/safeguarding scope is planned. | Define field-level roles, access audit, file policy, retention, and export redaction before expanding features. |
| Financial and lifecycle atomicity | Payments, admission approval, promotion, and TC affect multiple records. | Test rollback, duplicate callbacks/retries, atomic numbering, and no-dues enforcement in isolated data. |

## P1 — Navigation, module coverage, and linkage gaps

| Gap | Evidence / status | Required closure |
|---|---|---|
| Menu child marked built without proven dedicated screen | Browser route audit passed on staging on 2026-11-10 for all 121 built menu routes, with no console/page errors, HTTP failures, or API 5xx responses. | Add route-specific business assertions and retain `built: false` for menu items that are not ready for user-facing workflows. |
| Generic form definitions may not be routed | `formRegistry.js` and `FormPage.jsx` form a separate dynamic-form path; a form folder/config does not prove that `App` dispatches the menu item to it. | Prove live route wiring for every form-backed module and add route tests. |
| Admission/enquiry model overlap | `school_inquiries`, enhanced admissions, and `school_enquiries` route/schema families coexist. | Select canonical data ownership or document adapters/migration; test application approval and reporting against the same source. |
| Leave permission catalogue mismatch | Leave endpoints use `leaves.view/manage`, while the module permission catalogue does not include `leaves`. | Align catalogue, role grants, UI visibility, and route tests. |
| Incomplete module-level workflow evidence | Reports, AI, import/export, canteen, and several operational modules have incomplete or unverified dedicated API/UI coverage. | Work through `modules/M01`–`M33`; do not treat menu presence or SQL tables as implementation. |
| Cross-module consistency | Student, attendance, fees, academics, exit, support, and services each have separate route groups. | Pass `LINK-01`–`LINK-12`; verify UI, API, database, audit, and report values agree. |

## P2 — QA infrastructure and user-experience gaps

| Gap | Evidence / status | Required closure |
|---|---|---|
| No standard root test/lint/type-check/browser script | Root package includes a build but no common test/lint/type-check entry; server has standalone checks. | Select supported test and browser runners; add safe scripts and CI after dependency review. |
| Existing scripts may mutate data | Testing docs describe data-writing/deleting scripts; setup/seeding can have side effects. | Review target database, writes/deletes, credentials, rate limits, and cleanup before use. |
| No unified fixtures or cleanup contract | Existing staging suites use isolated, timestamped fixtures with cleanup; comprehensive CRUD passed 73/73 and full-module CRUD passed 104/104. A single shared fixture library is still not verified. | Consolidate synthetic tenants, users/roles, students, finance, files, and workflow states behind a documented reusable fixture/teardown contract. |
| Print/export coverage is uneven | Some screens have print support; many module print pages are generic or unverified. | Test actual output, filters, pagination, role scope, and hidden controls for each report. |
| Responsive/accessibility/performance checks | Browser smoke and Axe passed on staging on 2026-11-10 across all 121 built routes, with no console/page errors, HTTP/API failures, or accessibility violations. The corrected load harness now targets IPv4 API paths; health/menu completed successfully under load, while dashboard measured approximately 2.2 s median latency on the current large staging dataset. | Optimize or explicitly capacity-plan the dashboard before peak production load; validate production-like data volume and resource limits. |

## UAT release blockers

| Item | Current evidence | Required closure |
|---|---|---|
| Business approval ownership | Engineering UAT passed the major module and lifecycle suites; no business owner has signed the role-wise workflows. | Obtain named approvals for admissions, academics, finance, HR, operations, and administration. |
| Backup operations | Restore completed in 8.93 seconds and backup creation/retention is automated by script. | Configure scheduled execution, independent archive storage, stale-backup alerting, and measured service RPO/RTO. |
| Tenant acceptance | Authenticated tenant-boundary checks passed for the staging tenant; the configured second database was not approved for mutation testing. | Confirm an isolated second tenant and run read/write/export/upload isolation tests. |
| Product policy decisions | Latest-session-wins token invalidation is deterministic and tested; `fn_companyname()` falls back to the database name. | Confirm the session policy and whether the company-name migration/function is required in production. |
| Reports and exports | Routes and API smoke checks passed. | Business owners must reconcile representative report, print, and export totals against source records. |

## Module gap rule

Every `M01`–`M33` package must have a real screen/route, API and permission contract, schema/data owner, positive/negative/retry/access tests, linkage tests, audit behavior, and report/print/export behavior where applicable.

Update this register only with evidence: test ID, environment, date, and result. Keep unresolved issues marked `unverified`; do not claim “working perfectly” based on a build alone.
