# M10 — Safety & Safeguarding

**Package ID:** M10.

**Priority:** Core capability; policy/jurisdiction details are conditional. **Starting status:** visitors/gate passes exist in part; safeguarding scope unverified.

## Submodules

Visitor checks; pickup/gate-pass authorization; safeguarding report/intake; restricted case/evidence; escalation/follow-up; emergency contacts; emergency plans/drills.

## How it must work

Safety cases can be reported, triaged, assigned, escalated, and closed with restricted access and immutable audit. Visitor/pickup decisions use authorized student contacts. General discipline views cannot reveal safeguarding notes.

## Dependencies and links

M25 front office/visitor → M07 student/family → safety case. Link M09/M11 only through approved references and permissions.

## Files

- Existing: `src/pages/school/students/Discipline.jsx`, `src/pages/school/students/TransferExit.jsx`.
- Proposed screens: `src/pages/school/safety/SafetyCases.jsx`, `EmergencyPlans.jsx`, `VisitorChecks.jsx`.
- Proposed API: `server/src/routes/school_safety.js`; reuse protected upload and audit mechanisms.

## QA plan

- Unauthorized staff cannot view case details or evidence through UI, API, or export.
- Test escalation, reassignment, closure/reopen, mistaken reports, retention, and audit trail.
- Verify pickup/gate-pass identity against current guardian permissions.
- Test emergency contact access only for authorized workflows.

**Acceptance:** safeguarding records are access-restricted, auditable, and do not leak through other module screens.
