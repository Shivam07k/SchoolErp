# M03 — Integrations, Compliance & Data Governance

**Package ID:** M03.

**Priority:** Core capability; jurisdiction-specific reporting/retention is conditional. **Starting status:** partial/unverified.

## Submodules

Provider registry/secrets; SSO/identity; APIs/webhooks; sync jobs/retry/dead-letter logs; consent; retention/deletion; export governance; jurisdiction-specific reporting.

## How it must work

Integrations remain disabled until configured. Secrets never appear in list responses or logs. Replayed webhooks are idempotent; failed synchronization is visible and retryable. Retention and export policies are enforced.

## Dependencies and links

Provider links to admissions, payments, communications, LMS, identity, and reporting. Governance applies to all records and files. Uses M01 tenant identity and M02 roles/settings.

## Files

- Existing configuration: `src/components/SchoolSettings.jsx`, `src/forms/frmSchoolIntegrations/`.
- Proposed screens: `src/pages/school/compliance/Integrations.jsx`, `ComplianceReports.jsx`, `DataGovernance.jsx`.
- Proposed API: `server/src/routes/school_integrations.js`, registered in `server/src/index.js`; add a sequential SQL migration only after checking the current maximum number.

## QA plan

- Test invalid/expired credentials, timeout, malformed payload, replay, and retry.
- Verify secrets are redacted; Tenant A credentials cannot read or mutate Tenant B.
- Confirm export/deletion honors role, consent, and retention.
- Check SSO failure is fail-safe and audit logs record integration access without secret values.
- Reconcile one jurisdiction-required report to source fixtures.

**Acceptance:** provider state and failures are observable; retries do not duplicate data; governance is tested on API, file, and export paths.
