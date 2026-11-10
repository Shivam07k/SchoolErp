# School ERP Test Execution Plan

## 1. Safe environment

- Use a throwaway database/company and synthetic names, contact details, files, and payment data.
- Confirm the database target before migrations or scripts. Keep the configured `school_erp` and other valuable tenants untouched.
- Read each script for database selection, writes/deletes, credentials, rate limits, and cleanup before execution.
- Do not casually run `npm run setup`, `server/setup.mjs`, bulk seeds, or legacy mutating checks; setup may have side effects.
- Keep external SMS/email/payment/SSO/AI providers disabled or mocked; assert no outbound network call in tests.
- Keep test credentials local; never commit them or print them in logs.

## 2. Existing checks and missing infrastructure

- Existing baseline command: `npm run build`.
- Existing server checks include `server/tests/school_modules.test.mjs` and standalone scripts documented in `docs/08-testing.md`; inspect targets before execution.
- No unified root `test`, `lint`, type-check, or browser automation script has been verified. Select a supported runner and add repeatable, isolated commands before claiming automated coverage.

## 3. Test layers

### Database and migrations

- Fresh isolated install; migration prerequisites; idempotent rerun; constraints/indexes; rollback/restore plan.
- Check tenant scope, unique identifiers, foreign keys, archive/delete behavior, and transaction rollback.

### Backend API

- Every route: authenticated allowed request; missing/expired authentication; view-only/manage roles; cross-tenant ID tampering.
- Input validation and expected `400`, `401`, `403`, `404`, `409` outcomes; duplicate/retry/idempotency; concurrency for balances, capacities, and numbering.
- Verify audit events and no sensitive values in logs/errors.

### Frontend and navigation

- Every menu parent/child: click, direct hash, refresh, back/forward, invalid path, loading, empty, API failure.
- Verify each real screen is connected to its API; successful mutations refresh source and linked views.
- Check validation, loading states, duplicate submission prevention, keyboard operation, responsive layout, and console errors.

### Browser end-to-end

- Login as the test role; complete one workflow using synthetic data; verify UI/API/DB/audit/report; test print/export; clean up.
- Run all `LINK-01`–`LINK-12` scenarios from `ALL_MODULES_QA_PLAN.md`.
- Cover parent, student, teacher, admin officer, accountant, health/discipline roles, and super-admin as applicable.

### Security and operations

- Tenant isolation across reads, mutations, files, exports, and reports.
- Upload content/type/size/context and protected download checks.
- Privacy, retention, consent, audit, outage/retry, accessibility, and carefully bounded performance checks.

## 4. Per-package execution

For each `modules/Mxx-*.md` plan:

1. Review current route, files, permissions, API, and schema; record actual status.
2. Implement prerequisite migration/API/screen work in dependency order.
3. Add unit/API/database tests before or alongside workflow UI.
4. Run module QA cases and relevant `LINK-*` scenarios in isolated data.
5. Verify report/print/export and role behavior.
6. Record evidence and defects in `IMPLEMENTATION_TRACKER.md`; do not advance with open P0/P1 defects.

## 5. Release gate

Release only when Core modules pass module and linkage tests; applicable Conditional modules pass for the selected school; all routes have deliberate availability labels; zero critical/high-severity defects remain; migration/restore is proven; and test evidence is reproducible.
