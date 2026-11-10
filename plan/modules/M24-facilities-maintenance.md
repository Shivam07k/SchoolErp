# M24 — Facilities & Maintenance

**Package ID:** M24.

**Priority:** Core for facilities-managed schools. **Starting status:** missing as a dedicated workflow; partly represented by rooms/assets.

## Submodules

Campus/building/rooms; room booking; maintenance requests; work orders; preventive maintenance; vendors/costs; asset links.

## How it must work

Room schedules prevent conflicts. Requests move through triage, assignment, work, completion, and reopening. Completion updates asset and cost history.

## Dependencies and links

M02 campus → rooms → M13 timetable/M27 events; M19 assets/procurement → work orders; costs → M17 finance/M30 reports.

## Files

- Proposed screens: `src/pages/school/facilities/Rooms.jsx`, `MaintenanceRequests.jsx`, `WorkOrders.jsx`, `Assets.jsx`.
- Proposed API: `server/src/routes/school_facilities.js`, registered in `server/src/index.js`.
- Add schema only after checking existing `rooms`, assets, and migration tables for reuse.

## QA plan

- Reject double-booked rooms and invalid campus/room IDs.
- Test request assignment, completion, reopen, overdue preventative schedule.
- Verify completed work updates asset and vendor/cost history.
- Reconcile facility costs to finance and ensure tenant-scoped reports.

**Acceptance:** bookings, work orders, assets, and costs are linked and auditable.
