# M26 — Communication

**Package ID:** M26.

**Priority:** Core. **Starting status:** partial/verify.

## Submodules

SMS/email/app/notice; templates; recipient lists; consent/preferences; queued messages; delivery/retry logs; provider configuration.

## How it must work

Audience comes from authorized source records; opt-outs are honored; test mode is simulated; retry cannot send duplicate messages. Providers are configured through the integration layer.

## Dependencies and links

M07 family/student/staff → admissions, attendance, fees, safety policy notifications, events, and M31 automation.

## Files

- Form candidate: `src/forms/frmSchoolCommunication/`.
- Backend candidates: `server/src/routes/school_comprehensive.js`, `school_more.js`, `school.js`.
- Provider/secret ownership: M03; ensure no credentials in frontend or logs.

## QA plan

- Consent and opt-out; role/tenant audience filter; missing provider; failed/replayed callback.
- Template escaping and malformed recipient data.
- Prove no real outbound call in QA; retries are idempotent.
- Verify delivery logs and message counts against queued audience.

**Acceptance:** messages are consent-aware, scoped, safe in simulation, and observable.
