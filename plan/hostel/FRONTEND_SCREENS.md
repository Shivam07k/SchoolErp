# Hostel & Residential Life — Frontend Screens

**Stack:** React + Bootstrap 5, using `PageShell`, `Loading`, `Empty`, `Badge`,
`downloadCsv`, `fmtDate` from `src/pages/school/fee/shared.jsx` and the
`apiGet/apiPost/apiPut/apiDelete` helpers.

All screens live in `src/pages/school/hostel/` and are dispatched from
`src/components/SchoolPage.jsx` when `module === 'hostel'`.

---

## Routes

| Route | Component | Menu label |
|---|---|---|
| `/school/hostel/rooms` | `Rooms.jsx` | Hostel Rooms |
| `/school/hostel/allocation` | `Allocation.jsx` | Allocation |
| `/school/hostel/fees` | `Fees.jsx` | Hostel Fees |
| `/school/hostel/attendance` | `Attendance.jsx` | Hostel Attendance |
| `/school/hostel/visitors` | `Visitors.jsx` | Visitors |
| `/school/hostel/reports` | `Reports.jsx` | Reports |

`src/pages/school/hostel/shared.jsx` exports the shared hostel helpers:
`canHostelView`, `canHostelManage`, `TAB_BUTTON`, status tone maps, `today`,
`monthStart`, `monthEnd`, `studentName`, `money`, `Placeholder`.

---

## 1. Hostel Rooms (`Rooms.jsx`)

Tabs: **Layout**, **Rooms**, **Inspections**, **Maintenance**.

- Occupancy KPI strip: hostels, rooms, beds, occupied, vacant, maintenance.
- Layout builder: create hostel → block → floor → room (auto-creates beds).
- Room cards show bed grid coloured by status:
  - green = vacant, red = occupied, amber = reserved, grey = maintenance.
- Room detail drawer: occupants, amenities, assets, inspections, maintenance.
- Bulk room creation: from/to number, floor, type, capacity.
- Inspections: date, condition, findings, damage amount.
- Maintenance: issue, reporter, status, cost, vendor.

Permission: `hostel.view`; writes require `hostel.manage`.

---

## 2. Allocation (`Allocation.jsx`)

Tabs: **Applications**, **Bed Board**, **Allocations**, **Waiting List**.

- Application form: student, requested hostel/type, preferences, guardian
  consent, notes. Approve / reject / waitlist actions.
- Bed board: pick hostel, see rooms and free beds; select a student and a bed;
  preview eligibility (gender, capacity, consent, deposit).
- Allocation list: active/reserved/vacated, check-in date, deposit status.
- Room change: from bed → to bed, reason, effective date.
- Vacate wizard: vacate date, reason, clearance checklist (dues, assets, keys,
  damage), deposit settlement.
- Deposit panel: hold, adjust, refund, forfeit.
- Waiting list ordered by priority.

Permission: `hostel.view`; writes require `hostel.allocate` or `hostel.manage`.

---

## 3. Hostel Fees (`Fees.jsx`)

Tabs: **Fee Rules**, **Mess Plans**, **Billing**, **Bills**, **Rebates**,
**Deposits**, **Dues**.

- Fee rules by hostel / room category / room type with frequency, months and
  effective dates.
- Mess plans with monthly amount, minimum days away and daily rebate rate.
- Billing: pick period, preview per resident, then run billing. Bills create
  normal fee invoices.
- Bill register with rent, mess, extras, rebate, total and invoice link.
- Rebates: manual entry and auto-generate from approved leave.
- Deposits: held, adjusted, refunded, forfeited.
- Dues: outstanding hostel invoices and defaulters.

Permission: `hostel.view`; writes require `hostel.fees` or `hostel.manage`.

---

## 4. Hostel Attendance (`Attendance.jsx`)

Tabs: **Roll Call**, **Leave Passes**, **Gate Log**, **Duty**, **Incidents**,
**Complaints**, **Alerts**.

- Roll call: choose hostel, date and session (morning/evening/night). Roster is
  pre-filled (`on_leave` for approved passes, otherwise `present`). Buttons:
  *All Present*, per-student status, *Save*, *Submit & Lock*.
- Locked sessions can only be changed through *Correct* with a reason.
- Leave passes: request, guardian OTP, warden approval, gate out/in.
- Gate log: immutable in/out movements.
- Duty roster: warden, hostel, date, shift, substitute.
- Incidents: severity, description, action, visibility.
- Complaints: category, status, escalation, resolution.
- Alerts: late returns, unexplained absences, roll calls not taken.
- Night compliance: sessions taken vs expected.

Permission: `hostel.view`; writes require `hostel.rollcall`,
`hostel.leave_approve` or `hostel.manage`.

---

## 5. Visitors (`Visitors.jsx`)

Tabs: **Front Desk**, **Visitors**, **Authorised List**, **Blacklist**,
**Visit Rules**.

- Front desk: pre-register or walk-in, select student and visitor, purpose,
  badge, area. Approve → check in → check out. Open visits highlighted.
- Visitor master: name, phone, ID type/number (masked in list), relation,
  photo URL.
- Authorised list per student: relation, allowed days, valid till.
- Blacklist: reason, by, date, lift action.
- Visit rules per hostel: days, hours, max duration, max visitors, areas,
  ID required, overnight allowed.
- Daily log and open-visit list with CSV export.

Permission: `hostel.view`; writes require `hostel.visitor` or `hostel.manage`.

---

## 6. Reports (`Reports.jsx`)

Report cards with date range and CSV export:

- Occupancy by hostel / block / floor / room
- Vacancy and waiting list
- Allocation history
- Hostel fee collection and dues
- Mess rebates
- Deposits held
- Attendance by date and session
- Night-attendance compliance
- Leave passes and late returns
- Gate log
- Visitor log and blacklist
- Incident and discipline log
- Maintenance requests and cost
- Inspections
- Warden duty roster
- Audit

Permission: `hostel.reports` (audit report requires `hostel.audit`).
