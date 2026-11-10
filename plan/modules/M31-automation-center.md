# M31 — Automation Center

**Package ID:** M31.

**Priority:** Core automations; external delivery Conditional. **Starting status:** partial/verify.

## Submodules

Event/rule definitions; schedules/triggers; templates; dry-run; run history; retry/dead-letter; provider connectors.

## How it must work

Rules are versioned, permissioned, idempotent, observable, and safe without providers. Rule actions cannot bypass permissions of the target module. Dry-run is default in QA.

## Dependencies and links

M14 attendance/M17 fees/M06 admissions/M27 events → rule → M26 notifications/tasks → audit/logs/reports.

## Files

- Frontend currently in `src/components/SchoolPage.jsx`; menu has unbuilt templates/provider children.
- Backend candidates: `server/src/routes/school.js`, `school_more.js`.
- Provider secrets/configuration belong to M03.

## QA plan

- Simulate rules with deterministic fixtures; duplicate trigger creates no duplicate action.
- Disabled rule does not run; provider outage is visible and retryable.
- Test invalid template, role checks, rate limits, and no outbound request in test.
- Verify logs identify the rule version and affected entity.

**Acceptance:** runs are safe, repeatable, observable, and do not duplicate downstream mutations or messages.
