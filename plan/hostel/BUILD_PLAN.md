# Hostel & Residential Life — Build Plan

**Version 1.0** · Based on `DESIGN.md` · 4 November 2026

---

## Overview

The module is built in six sequential steps plus one optional later step. Each step delivers working, testable functionality.

**Dependencies**

- Students master (`school_students`, guardian fields)
- Fees & Accounts (`school_fee_head`, `school_invoice`, `school_invoice_line`, `school_receipt`)
- HR (`school_staff` for wardens)
- Inventory & Assets (`school_inv_asset.room_id` for room furniture)
- Attendance (`school_attendance` / `school_attendance_register` for school-level leave sync)
- Calendar (`school_calendar_event` for vacation/holiday closures)

**Migration files:** `sql/80_hostel_core.sql`, `sql/81_hostel_ops.sql`.

**Backend router:** `server/src/routes/school_hostel.js`, mounted at `/api/school` **before** the legacy `school_comprehensive.js` router.

**Frontend routes:** `/school/hostel/rooms`, `/school/hostel/allocation`, `/school/hostel/fees`, `/school/hostel/attendance`, `/school/hostel/visitors`, `/school/hostel/reports`.

---

## Step 1: Hostel Rooms

**Target:** Complete physical layout with bed-level status, inspections, maintenance and occupancy dashboard.

### Database
- `school_hostel` — hostel, type (boys/girls/coed), campus, chief warden, capacity
- `school_hostel_block` — block under hostel
- `school_hostel_floor` — floor under block
- `school_hostel_room` — room number, type, capacity, amenities, status, fee category, accessibility
- `school_hostel_bed` — bed number and status (`vacant`, `occupied`, `reserved`, `maintenance`)
- `school_hostel_room_inspection` — date, inspector, condition, findings, damage
- `school_hostel_maintenance` — issue, reporter, status, cost, vendor
- Room assets use `school_inv_asset.room_id`

### Backend API (`/api/school/hostel/*`)
| Endpoint | Method | Purpose |
|---|---|---|
| `/dashboard` | GET | Occupancy, vacancy, maintenance and open-visit summary |
| `/hostels` | GET/POST | List/create hostels |
| `/hostels/:id` | PUT/DELETE | Update/soft-delete hostel |
| `/blocks` | GET/POST | List/create blocks |
| `/blocks/:id` | PUT/DELETE | Update/soft-delete block |
| `/floors` | GET/POST | List/create floors |
| `/floors/:id` | PUT/DELETE | Update/soft-delete floor |
| `/rooms` | GET/POST | List/create rooms |
| `/rooms/bulk` | POST | Create a range of rooms with beds |
| `/rooms/:id` | GET/PUT/DELETE | Room detail/update/soft-delete |
| `/rooms/:id/status` | PUT | Change room status |
| `/beds` | GET/POST | List/create beds |
| `/beds/:id` | PUT/DELETE | Update/delete bed |
| `/layout` | GET | Full hostel → block → floor → room → bed tree |
| `/inspections` | GET/POST | Room inspections |
| `/maintenance` | GET/POST | Maintenance requests |
| `/maintenance/:id` | PUT | Update maintenance status/cost |
| `/room-assets` | GET/POST | Link inventory assets to rooms |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Rooms & Layout | `Rooms.jsx` | `/school/hostel/rooms` |
| Room detail drawer | (inside `Rooms.jsx`) | — |
| Inspections | (tab in `Rooms.jsx`) | — |
| Maintenance | (tab in `Rooms.jsx`) | — |

### Permission
- `hostel.view` — read layout, occupancy, inspections
- `hostel.manage` — create/edit layout, inspections, maintenance

### Done When
- Every bed is created and shows its current status.
- Allocation cannot select a bed that is `maintenance` or already `occupied`/`reserved`.
- Occupancy dashboard totals match active allocations.

---

## Step 2: Allocation

**Target:** Application → approval → bed allocation / waitlist → room change → vacate with clearance.

### Database
- `school_hostel_application`
- `school_hostel_allocation`
- `school_hostel_waitlist`
- `school_hostel_room_change`
- `school_hostel_vacate`
- `school_hostel_deposit`

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/applications` | GET/POST | List/create applications |
| `/applications/:id/approve` | POST | Approve application |
| `/applications/:id/reject` | POST | Reject with reason |
| `/applications/:id/waitlist` | POST | Put on waiting list |
| `/waitlist` | GET | Waiting list by priority |
| `/allocations` | GET/POST | List/create allocation (reservation or active) |
| `/allocations/:id` | GET/PUT | Detail/update allocation |
| `/allocations/:id/change` | POST | Room/bed change |
| `/allocations/:id/vacate` | POST | Start vacate + clearance checklist |
| `/allocations/:id/clearance` | POST | Complete clearance |
| `/allocations/:id/deposit` | GET/PUT | Deposit held/refunded/adjusted |
| `/bed-suggestions` | GET | Suggest free beds by gender, type, capacity |
| `/me` | GET | Current student/parent view (self-service) |

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Allocation dashboard | `Allocation.jsx` | `/school/hostel/allocation` |
| Application form | (modal in `Allocation.jsx`) | — |
| Bed board / allocate | (tab in `Allocation.jsx`) | — |
| Waiting list | (tab in `Allocation.jsx`) | — |
| Room change | (modal in `Allocation.jsx`) | — |
| Vacate wizard | (modal in `Allocation.jsx`) | — |

### Hard rules enforced by API
- One active/reserved allocation per student and per bed.
- Gender must match hostel type (`boys`, `girls`, `coed`).
- Room capacity cannot be exceeded.
- Bed must be `vacant` (or `reserved` for the same student).
- Student must be active and not deleted.
- Guardian consent required before `active`.
- Deposit required before check-in when policy says so.
- Deposit refund blocked until clearance is complete.

### Done When
- No bed can be double-booked.
- Vacating follows the clearance checklist.
- Waiting list offers a bed when one becomes free.

---

## Step 3: Hostel Fees

**Target:** Rent, mess, extras, deposits, rebates and damage recovery billed through Fees & Accounts.

### Database
- `school_hostel_fee_rule`
- `school_hostel_mess_plan`
- `school_hostel_fee_plan` (per allocation)
- `school_hostel_mess_rebate`
- `school_hostel_bill`
- `school_hostel_damage`
- Reuses `school_fee_head`, `school_invoice`, `school_invoice_line`, `school_receipt`

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/fee-rules` | GET/POST/PUT | Room-category rent rules |
| `/mess-plans` | GET/POST/PUT | Mess plans and rebate rules |
| `/fee-plans` | GET/POST/PUT | Assign rent/mess plan to allocation |
| `/billing/preview` | GET | Preview a resident's bill for a period |
| `/billing/run` | POST | Generate bills + fee invoices for a period |
| `/bills` | GET | Bill register |
| `/bills/:id/cancel` | POST | Cancel an unposted bill |
| `/rebates` | GET/POST | Manual/automatic mess rebates |
| `/rebates/:id/approve` | POST | Approve rebate |
| `/deposits` | GET | Deposits held/settled |
| `/damage` | GET/POST | Damage recovery charges |
| `/dues` | GET | Hostel dues and defaulters |
| `/fee-summary` | GET | Collection, outstanding, deposits, rebates |

### Billing rules
- Rent comes from `school_hostel_fee_rule` by room category / room type.
- Mess comes from `school_hostel_mess_plan` assigned to the allocation.
- Mid-month joins are prorated by policy (`daily` or `full_month`).
- Mess rebate is calculated from approved leave days beyond `rebate_min_days`.
- Deposit is a liability, not income.
- Damage is an extra fee line.
- Bills create `school_invoice` + `school_invoice_line` rows with hostel fee heads.

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Fee rules | `Fees.jsx` (tab) | `/school/hostel/fees` |
| Mess plans | `Fees.jsx` (tab) | — |
| Bill preview | `Fees.jsx` (tab) | — |
| Billing run | `Fees.jsx` (tab) | — |
| Rebates | `Fees.jsx` (tab) | — |
| Deposits | `Fees.jsx` (tab) | — |
| Dues | `Fees.jsx` (tab) | — |

### Done When
- A resident's bill matches their stay and approved leave days.
- Deposits are held as liabilities and settled only after clearance.
- Hostel invoices appear in the normal Fees collection screen.

---

## Step 4: Hostel Attendance

**Target:** Roll calls, leave passes with guardian OTP, gate log, alerts, duty roster, incidents and complaints.

### Database
- `school_hostel_roll_call`
- `school_hostel_roll_call_entry`
- `school_hostel_leave_pass`
- `school_hostel_gate_log`
- `school_hostel_duty`
- `school_hostel_incident`
- `school_hostel_complaint`
- `school_hostel_notification`

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/roll-calls` | GET/POST | List/create a session |
| `/roll-calls/:id` | GET/PUT | Session detail / save entries |
| `/roll-calls/:id/submit` | POST | Submit (immutable) |
| `/roll-calls/:id/lock` | POST | Lock session |
| `/roll-calls/:id/correct` | POST | Audited correction with reason |
| `/leave-passes` | GET/POST | List/create leave pass |
| `/leave-passes/:id/guardian-otp` | POST | Record guardian OTP approval |
| `/leave-passes/:id/approve` | POST | Warden approval |
| `/leave-passes/:id/reject` | POST | Reject with reason |
| `/leave-passes/:id/gate-out` | POST | Record actual out time |
| `/leave-passes/:id/gate-in` | POST | Record actual return |
| `/gate-log` | GET/POST | Gate movements |
| `/duty` | GET/POST/PUT | Warden duty roster |
| `/incidents` | GET/POST/PUT | Incident log |
| `/complaints` | GET/POST/PUT | Complaint log |
| `/alerts` | GET | Late returns, unexplained absences, missing roll calls |
| `/night-compliance` | GET | Night roll-call compliance |
| `/mess-rebates/auto` | POST | Generate rebates from approved leave |

### Roll-call statuses
`present`, `absent`, `on_leave`, `sick_bay`, `late`.

### Leave-pass statuses
`requested` → `guardian_approved` → `approved` → `out` → `returned` / `overdue` / `rejected` / `cancelled`.

### Alerts
- Absent without an approved pass → guardian + warden.
- Out past return time → warden, then chief warden, then principal.
- Night roll call not taken by cut-off → chief warden.
- Visitor not checked out by close → front desk + warden.

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Roll call | `Attendance.jsx` (tab) | `/school/hostel/attendance` |
| Leave passes | `Attendance.jsx` (tab) | — |
| Gate log | `Attendance.jsx` (tab) | — |
| Duty roster | `Attendance.jsx` (tab) | — |
| Incidents | `Attendance.jsx` (tab) | — |
| Complaints | `Attendance.jsx` (tab) | — |
| Night compliance | `Attendance.jsx` (tab) | — |

### Done When
- Absences and late returns alert the right people.
- Roll calls are immutable after submit; corrections need a reason.
- Approved leave pre-marks students `on_leave` in the next roll call.

---

## Step 5: Visitors

**Target:** Every visitor is registered, checked against the authorised list, and logged in and out.

### Database
- `school_hostel_visitor`
- `school_hostel_authorised_visitor`
- `school_hostel_visit_rule`
- `school_hostel_visitor_entry`
- `school_hostel_blacklist`

### Backend API
| Endpoint | Method | Purpose |
|---|---|---|
| `/visitors` | GET/POST/PUT | Visitor master |
| `/authorised-visitors` | GET/POST/DELETE | Per-student authorised list |
| `/visit-rules` | GET/POST/PUT | Hostel visiting rules |
| `/visitor-entries` | GET/POST | Pre-register / walk-in |
| `/visitor-entries/:id/approve` | POST | Host/warden approval |
| `/visitor-entries/:id/check-in` | POST | Check in with badge |
| `/visitor-entries/:id/check-out` | POST | Check out |
| `/visitor-entries/:id/deny` | POST | Deny with reason |
| `/blacklist` | GET/POST/PUT | Blacklist |
| `/open-visits` | GET | Visitors not checked out |

### Hard rules
- Blacklisted visitor cannot be checked in.
- Unauthorised visitor needs warden/guardian approval.
- Outside visiting hours needs approval with reason.
- Taking a child out needs an approved leave pass and authorised person.
- Overnight guests are blocked unless the policy enables them.

### Frontend Screens
| Screen | File | Route |
|---|---|---|
| Front desk | `Visitors.jsx` (tab) | `/school/hostel/visitors` |
| Pre-registration | `Visitors.jsx` (tab) | — |
| Authorised list | `Visitors.jsx` (tab) | — |
| Blacklist | `Visitors.jsx` (tab) | — |
| Visit rules | `Visitors.jsx` (tab) | — |
| Daily log | `Visitors.jsx` (tab) | — |

### Done When
- Every visitor is logged in and out.
- Open visits are flagged at day close.
- Blacklisted and unauthorised visitors are blocked.

---

## Step 6: Reports and Hardening

**Target:** Inspector-ready reports, role controls, privacy, retention and audit.

### Reports
- Occupancy by hostel, block, floor and room
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

### Hardening
- Mask visitor ID numbers in list views.
- Role-based access for warden, front desk, accounts, principal and auditor.
- Retention settings for gate logs, visitor logs, photos and incident records.
- Audit every sensitive action: allocation, room change, vacate, deposit, leave approval, roll-call correction, visitor check-in, blacklist.
- Offline roll-call source flag (`online`, `offline`) and later sync.
- Export CSV from every report.

### Done When
- An inspector can see occupancy, rolls and visitor logs.
- Sensitive actions are audited.
- Retention and masking settings are enforced.

---

## Step 7: Later (optional)

Mess menu and stock, laundry, biometric/face/QR gate hardware, CCTV integration, patrol checkpoints. Add only when needed.

---

## Permissions

| Permission | Purpose |
|---|---|
| `hostel.view` | Read all hostel screens |
| `hostel.manage` | Setup, rooms, allocation, fees, attendance, visitors |
| `hostel.allocate` | Allocation and room changes |
| `hostel.rollcall` | Roll calls and gate log |
| `hostel.leave_approve` | Approve leave passes |
| `hostel.visitor` | Visitor check-in/out |
| `hostel.fees` | Hostel fee setup and billing |
| `hostel.reports` | Reports and exports |
| `hostel.audit` | Audit and retention |

`hostel.manage` is a superset for backward compatibility.
