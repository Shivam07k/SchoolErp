# M08 — Portals & Self-Service

**Package ID:** M08.

**Priority:** Core. **Starting status:** not a dedicated module/unverified.

## Submodules

Family/parent portal; student portal; teacher portal; online enrollment/re-enrollment; profile/consent forms; notices/messages; schedule/attendance/grades/homework; balances/payments.

## How it must work

Each account sees only its linked family/student/class records. Portal changes update source records and show approval status when staff review is required. Sensitive fields are role-scoped.

## Dependencies and links

M01/M02 identity and permissions + M07 student/guardian/staff associations → M13 timetable, M14 attendance, M15 exams, M16 LMS, M17 fees, M26 communication, M27 events.

## Files

- Proposed screens: `src/pages/school/portals/FamilyPortal.jsx`, `StudentPortal.jsx`, `TeacherPortal.jsx`.
- Proposed API: `server/src/routes/school_portals.js`, registered in `server/src/index.js`.
- Existing route/menu conventions: `src/app.jsx`, `src/school/menu.js`, `src/components/SchoolPage.jsx`, `src/api.js`.

## QA plan

- Parent linked to two students sees exactly both; cannot view unrelated student or change grades.
- Verify student and teacher role scopes by direct API as well as UI.
- Test consent grant/revoke and family profile edits requiring staff approval.
- Mobile viewport, keyboard navigation, session expiry, and malformed IDs.

**Acceptance:** role-scoped portal data matches SIS source records and every portal mutation is audited.
