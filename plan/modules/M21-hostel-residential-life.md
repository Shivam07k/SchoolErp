# M21 — Hostel / Residential Life

**Package ID:** M21.

**Priority:** Conditional by school. **Starting status:** partial/verify.

## Submodules

Buildings/rooms/beds; allocation; occupancy/roll call; leave/gate pass; visitors; hostel fees; incident referral.

## How it must work

One valid active bed allocation per student under policy; occupancy cannot exceed capacity; leave and roll call respect permissions; released students have no active bed.

## Dependencies and links

M07 student/family → bed/attendance/fee → M10 safety, M26 notifications, M17 accounts, M12 exit.

## Files

- Form candidate: `src/forms/frmSchoolHostel/`.
- Backend candidate: `server/src/routes/school_comprehensive.js`.
- Verify room/bed model and route-level permissions before implementation.

## QA plan

- Capacity and duplicate active allocation; room move and release.
- Overnight pass authorization and missed roll-call alert.
- Test student exit/archive releases allocation and closes applicable charges.
- Reconcile occupancy and fee reports to active allocation records.

**Acceptance:** room occupancy, student state, passes, and hostel charges agree.
