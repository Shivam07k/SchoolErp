# M04 — Dashboard

**Package ID:** M04.

**Priority:** Core. **Starting status:** partial/verify.

## Submodules

Role-specific overview; campus/year filters; alerts; recent activity; shortcuts; KPI drill-down.

## How it must work

Show scoped, explainable aggregates. Each card/shortcut opens the exact filtered module/list behind that count. The dashboard reads source records and does not create duplicate business data.

## Dependencies and links

Reads from admissions, students, attendance, fees, exams, and notification data; linked to M02 context and M30 reports.

## Files

- Frontend: `src/components/SchoolPage.jsx`; menu path in `src/school/menu.js`.
- Backend: dashboard endpoint in `server/src/routes/school.js`.
- Shared: `src/api.js`, `server/src/school/foundation.js`.

## QA plan

- Compare every displayed count/sum to source SQL fixtures.
- Test empty data, date boundaries, campus/year changes, and role restrictions.
- Verify every shortcut's URL and resulting list/filter.
- Check slow/error API states do not show stale success values.

**Acceptance:** visible values reconcile to the current tenant/campus/year and all links open the intended screen.
