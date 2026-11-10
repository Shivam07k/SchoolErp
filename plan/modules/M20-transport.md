# M20 — Transport

**Package ID:** M20.

**Priority:** Conditional by school. **Starting status:** partial/verify.

## Submodules

Routes/stops; vehicles/drivers; capacity/inspection; student allocation; trips/attendance; tracking; transport fees.

## How it must work

Allocation respects capacity, route, stop, and student eligibility. Changes propagate to emergency/pickup views and transport charges. Trip state is auditable.

## Dependencies and links

M07 student/family + M02 campus → route/fee → M14 attendance, M10 safety, M17 fees, M26 communication, M12 exit.

## Files

- Form candidate: `src/forms/frmSchoolTransport/`.
- Backend candidate: `server/src/routes/school_comprehensive.js`.
- Verify tracking provider configuration through M03.

## QA plan

- Reject over-capacity and invalid driver/vehicle assignments.
- Prevent duplicate active student allocation; test route/stop changes and exit closure.
- Simulate tracking outage; verify no stale location presented as current.
- Reconcile transport fees and allocation reports.

**Acceptance:** route, allocation, safety, fee, and exit records remain synchronized.
