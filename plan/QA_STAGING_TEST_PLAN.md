# School ERP QA / Staging Test Plan

## Staging environment

- Database: `school_erp_staging_20261110`
- Source: isolated clone of the configured `school_erp` database
- Test data: synthetic QA users and records only
- Production database: not used by the staging workflow
- Staging server: temporary server workspace under the Copilot session state

## External quality basis

This plan combines the repository's module workflows with established standards and
testing guidance:

- [ISO/IEC 25010](https://www.iso.org/standard/78176.html): product-quality
  characteristics and evaluation criteria.
- [OWASP ASVS](https://asvs.owasp.org/), [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/),
  and [OWASP API Security](https://owasp.org/API-Security/): application, web, and
  API security verification.
- [NIST SP 800-115](https://csrc.nist.gov/pubs/sp/800/115/final): security-test
  planning and execution.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and
  [W3C evaluation guidance](https://www.w3.org/WAI/test-evaluate/): accessibility.
- [OpenAPI](https://spec.openapis.org/oas/latest.html): API contract and negative
  testing.
- [Ed-Fi data exchange](https://docs.ed-fi.org/reference/data-exchange/) and
  [1EdTech OneRoster](https://www.1edtech.org/standards/oneroster): education data
  relationships and interoperability fixtures.
- [Google SRE monitoring guidance](https://sre.google/sre-book/monitoring-distributed-systems/):
  black-box SLIs, white-box metrics, and alerting.
- [Twelve-Factor App](https://12factor.net/): configuration, build/release/run,
  logs, disposability, and staging/production parity.
- [AWS reliability guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/reliability.html):
  recovery and operational readiness.

## Test catalogue

### P0 release gates

1. **Authentication and authorization**
   - Login, logout, expiry, invalid credentials, account deactivation, password
     change, and rate limits.
   - Admin, principal, teacher, accountant, HR, student, guardian, and read-only
     role matrices.
   - Direct URL/API access denial, object-ID substitution, tenant/company isolation,
     export scope, file/download scope, and audit events.

2. **Student lifecycle**
   - Inquiry → application → approval → student → enrollment → promotion/transfer/
     exit → alumni.
   - Duplicate admission identifiers, guardian links, documents, health/discipline
     privacy, rollback, and re-enrollment.

3. **Academics and attendance**
   - Academic years, classes, sections, subjects, allocations, rooms, homework,
     timetable publication/conflicts, attendance marking/correction/finalization,
     holidays, leave, reports, and section scoping.

4. **Exams and results**
   - Exam/paper/component setup, mark boundaries, absent/status codes, optimistic
     concurrency, submit/verify/lock/reopen, report cards, and result reconciliation.

5. **Fees and finance**
   - Fee setup, invoice, partial/duplicate/failed payment, receipt, refund,
     scholarship/concession, overpayment, no-dues, numbering, and ledger/report
     reconciliation.

6. **Database integrity and recovery**
   - Fresh install, idempotent schema application, constraints/indexes, rollback or
     forward-fix, backup restore, attachment availability, orphan detection, row
     counts, and financial/attendance totals before and after restore.

### P1 quality gates

7. **Operational modules**
   - HR/payroll, inventory, transport, hostel, library, canteen, front office,
     communication, LMS, events/PTM, certificates, alumni, and automation.
   - Test capacity, duplicate transactions, approval states, privacy, retries,
     and downstream student/fee/attendance linkage.

8. **API and integration**
   - Required/optional fields, enum/date validation, pagination, sorting, filtering,
     status/error contracts, idempotency, retries, rate limits, and version
     compatibility.
   - OneRoster/Ed-Fi-shaped fixtures where integrations are enabled.

9. **Security and privacy**
   - SQL injection, XSS, CSRF, file upload validation, session handling, token
     revocation, secret exposure, error disclosure, sensitive-data redaction,
     retention/deletion, and protected health/financial data.

10. **Performance and resilience**
    - Login, dashboard, student search, attendance burst, exam publication, fee
      deadline, report generation, and notification burst.
    - Capture p50/p95/p99 latency, throughput, error rate, DB locks, pool usage,
      queue depth, CPU/memory, restart behavior, and dependency outage behavior.

11. **Frontend and accessibility**
    - Every menu child by direct URL, refresh, back/forward, empty state, API error,
      and permission.
    - Keyboard-only navigation, focus order, labels, validation errors, contrast,
      zoom/reflow, responsive layouts, print/export output, and console errors.

12. **Deployment readiness**
    - Reproducible build, locked dependencies, environment-only secrets, health and
      readiness checks, graceful shutdown, migration compatibility, rollback,
      monitoring, alert routing, TLS/DNS, and runbook rehearsal.

## Current staging evidence

| Check | Result |
|---|---|
| Frontend production build | Passed; Vite reports a large chunk warning |
| School schema smoke test | Passed |
| Full cross-module API workflow | Passed: 104/104 |
| Academics and homework workflow | Passed: 45/45 |
| Timetable and substitution workflow | Passed: 27/27 |
| Parameterless endpoint smoke coverage | Passed: 334 routes; 0 network/5xx failures; expected 4xx/404 cases remain |
| Timetable, homework, attendance, fees, exams, certificates, inventory, library, transport, hostel, canteen, events, alumni, HR, front office, LMS | Passed inside the 104-check workflow |
| Comprehensive CRUD workflow | Passed: 72/72 |
| Dashboard and settings/group linkage | Passed inside the 104-check workflow |
| Production runtime hardening | Added production environment validation, generic 5xx responses, readiness endpoint, upload/body limits, master-password restriction, SQL-log safety default, and graceful shutdown |
| Parent/guardian portal coverage | Not yet executed |
| Backup restore/RPO/RTO evidence | Restore verified in 8.93 seconds into a temporary database; `npm run backup` now creates validated custom-format dumps with retention. Production RPO remains unproven until the script is scheduled and archives are copied to independent storage. |
| Security assessment | Not yet executed |
| Browser accessibility/E2E | Passed: login, responsive navigation, all 121 built routes, no console/page/API/HTTP failures, and zero Axe violations. |
| Peak-load/resilience testing | Corrected harness passed health/menu load against IPv4 API paths; dashboard load completed but measured approximately 2.2 s median latency on the current large staging dataset and requires capacity planning. |
| Admissions counseling, actual admission-fee collection, and admission reports | Incomplete/unverified |

## Release decision rules

Do not promote staging to production until:

- all applicable P0 gates pass;
- no unresolved critical/high security or data-integrity defects remain;
- backup restore and rollback are demonstrated with measured RPO/RTO;
- parent/guardian and staff permission tests pass;
- accessibility and peak-load evidence is recorded;
- unfinished admission/report workflows are implemented or explicitly disabled;
- the exact build, migration state, test results, and environment configuration are
  recorded for the release.

