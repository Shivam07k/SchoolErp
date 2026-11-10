# M27 — Events, PTM & Co-curricular Activities

**Package ID:** M27.

**Priority:** Events/PTM Core; clubs/sports/trips Conditional. **Starting status:** partial/verify.

## Submodules

Event calendar/list; registration; PTM slots; clubs/activities/sports; trips/permission forms; gallery/media.

## How it must work

Enforce event capacity and schedule conflicts. Guardians register only linked students. Required consent is captured before trips. Media visibility respects privacy.

## Dependencies and links

M02 calendar + M13 timetable/M24 rooms → events; PTM → M08 portal/M26 communication; activities → M14 attendance, M17 fees, reports.

## Files

- Form candidate: `src/forms/frmSchoolEvents/`.
- Backend candidate: `server/src/routes/school_comprehensive.js`.
- Verify child menu routes map to distinct list/calendar/PTM flows.

## QA plan

- Full/overlapping event, duplicate registration, capacity, and cancellation.
- Guardian-student relationship check; missing trip consent blocks registration.
- Verify notification/refund on cancellation and media privacy.
- Room booking conflict test links to M24.

**Acceptance:** events, PTM, consent, facilities, communications, and attendance stay synchronized.
