# Hostel & Residential Life — Test Scenarios

**Legend:** ✅ expected pass · ⛔ expected block · ⚠️ warning only

---

## A. Layout and beds

| # | Scenario | Expected |
|---|---|---|
| A1 | Create hostel with type `boys` | Saved, appears in layout |
| A2 | Create block, floor, room with capacity 3 | Room created with 3 beds |
| A3 | Bulk-create rooms 101–110 | 10 rooms and their beds created |
| A4 | Set a bed to `maintenance` | Bed shows grey; allocation blocked |
| A5 | Set a room to `maintenance` | New allocations blocked |
| A6 | Delete a room with active occupants | Blocked or soft-deleted with occupants warned |
| A7 | Change capacity below current occupancy | Blocked |
| A8 | Room type `warden` / `guest` | Not allocatable |
| A9 | Occupancy dashboard | Totals equal active allocations |
| A10 | Record inspection with damage | Inspection saved with amount |
| A11 | Raise maintenance request and resolve | Status and cost update |

---

## B. Allocation

| # | Scenario | Expected |
|---|---|---|
| B1 | Allocate an active student to a vacant bed | Allocation active, bed occupied |
| B2 | Allocate same student to a second bed | ⛔ unique active student index |
| B3 | Allocate another student to the same bed | ⛔ unique active bed index |
| B4 | Male student into girls' hostel | ⛔ gender rule |
| B5 | Female student into boys' hostel | ⛔ gender rule |
| B6 | Coed hostel, either gender | ✅ |
| B7 | Room already at capacity | ⛔ capacity rule |
| B8 | Bed under maintenance | ⛔ bed status rule |
| B9 | Inactive/left student | ⛔ student status rule |
| B10 | Allocation without guardian consent | ⛔ when policy requires consent |
| B11 | Allocation without deposit | ⛔ when `require_deposit` is on |
| B12 | Hostel full | Student goes to waiting list |
| B13 | Bed freed | Waitlist can be offered/converted |
| B14 | Room change approved | Old bed vacant, new bed occupied, history kept |
| B15 | Vacate with dues pending | Clearance blocked |
| B16 | Vacate with assets/keys missing | Clearance blocked |
| B17 | Deposit refund before clearance | ⛔ |
| B18 | Complete clearance | Allocation vacated, bed vacant, deposit settled |
| B19 | Duplicate active allocation via room change | ⛔ |
| B20 | Mid-year join | Effective date recorded, fees prorated |

---

## C. Hostel fees

| # | Scenario | Expected |
|---|---|---|
| C1 | Fee rule by room category | Rule saved |
| C2 | Bill preview for a resident | Rent + mess + extras − rebate |
| C3 | Billing run for a month | Bill + fee invoice + invoice lines |
| C4 | Run billing twice for same period | ⛔ unique allocation/period |
| C5 | Joins mid-month (daily policy) | Rent/mess prorated |
| C6 | Joins mid-month (full-month policy) | Full month charged |
| C7 | Approved 10-day leave, min 3 days | 7 days rebate |
| C8 | Leave below minimum days | No rebate |
| C9 | Manual rebate approved | Applied to next bill |
| C10 | Deposit held | Liability record, not income |
| C11 | Damage charge | Extra invoice line |
| C12 | Cancel draft bill | Bill cancelled, invoice cancelled |
| C13 | Hostel invoice appears in Fees collection | ✅ |
| C14 | Dues report | Outstanding hostel invoices listed |

---

## D. Attendance and leave

| # | Scenario | Expected |
|---|---|---|
| D1 | Open morning roll call | Roster prefilled |
| D2 | Approved pass on date | Student prefilled `on_leave` |
| D3 | All Present | All non-leave students `present` |
| D4 | Mark absent and submit | Session locked, alert raised |
| D5 | Edit submitted session directly | ⛔ locked |
| D6 | Correct locked entry with reason | Saved + audit entry |
| D7 | Leave request without guardian OTP | ⛔ approval |
| D8 | Guardian OTP then warden approval | Status approved |
| D9 | Approver is requester | ⛔ self-approval |
| D10 | Gate out without approval | ⛔ |
| D11 | Gate out after approval | Status out, gate log row |
| D12 | Return before due | Status returned, gate log updated |
| D13 | Return after due | Status overdue, alert |
| D14 | Night roll call not taken | Alert to chief warden |
| D15 | Warden absent | Substitute on duty roster |
| D16 | Incident logged | Severity/action saved, alert |
| D17 | Complaint escalated | Status escalated, owner set |
| D18 | Gate log vs roll call mismatch | Alert/report shows mismatch |
| D19 | Offline roll call sync | Source `offline`, flagged |

---

## E. Visitors

| # | Scenario | Expected |
|---|---|---|
| E1 | Create visitor with ID | ID masked in list |
| E2 | Authorised parent checks in | ✅ |
| E3 | Unauthorised walk-in | Needs approval before check-in |
| E4 | Blacklisted visitor | ⛔ check-in |
| E5 | Outside visiting hours | Needs approval with reason |
| E6 | Pre-registered visitor | Faster check-in |
| E7 | Visitor for two students | Two separate entries |
| E8 | Check out | Badge returned, status checked_out |
| E9 | Not checked out at close | Open visit flagged |
| E10 | Taking child out without pass | ⛔ |
| E11 | Overnight guest when policy off | ⛔ |
| E12 | Courier/delivery | Desk handover, no hostel entry |
| E13 | Lift blacklist | Allowed again after lift |
| E14 | Lost badge | Badge replacement recorded |

---

## F. Permissions and audit

| # | Scenario | Expected |
|---|---|---|
| F1 | `hostel.view` user opens screens | Read-only |
| F2 | `hostel.allocate` user allocates | ✅ |
| F3 | `hostel.visitor` user checks in visitor | ✅ |
| F4 | Accountant bills hostel fees | ✅ with `hostel.fees` |
| F5 | Warden approves leave | ✅ with `hostel.leave_approve` |
| F6 | Unauthorised write | 403 |
| F7 | Allocation/room change/vacate | Audit entry |
| F8 | Deposit settlement | Audit entry |
| F9 | Roll-call correction | Audit entry with reason |
| F10 | Visitor check-in/out | Audit entry |
| F11 | Blacklist add/lift | Audit entry |
| F12 | Audit report | Shows all sensitive actions |

---

## Automation structure

```
tests/hostel/
├── layout.test.js        # A1–A11
├── allocation.test.js    # B1–B20
├── fees.test.js          # C1–C14
├── attendance.test.js    # D1–D19
├── visitors.test.js      # E1–E14
└── permissions.test.js   # F1–F12
```

Each test seeds its own hostel/block/room/bed/student fixture, calls the API
with a role-scoped token, and asserts both the HTTP response and the database
state. Destructive cases run inside a transaction that is rolled back.
