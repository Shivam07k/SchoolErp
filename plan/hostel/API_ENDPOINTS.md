# Hostel & Residential Life — API Endpoints

All endpoints are under `/api/school/hostel`. The router is mounted in
`server/src/index.js` **before** `schoolCompRouter` so the richer hostel
handlers are not shadowed by the legacy module.

Authentication: `Authorization: Bearer <token>`. Tenant scope comes from
`req.school.appId`.

---

## Permissions

| Permission | Used for |
|---|---|
| `hostel.view` | All GET endpoints |
| `hostel.manage` | Superset for all write endpoints |
| `hostel.allocate` | Applications, allocations, changes, vacate |
| `hostel.rollcall` | Roll calls, gate log, duty |
| `hostel.leave_approve` | Leave approval |
| `hostel.visitor` | Visitors and blacklist |
| `hostel.fees` | Fee rules, billing, deposits, damage |
| `hostel.reports` | Reports |
| `hostel.audit` | Audit and retention |

---

## Layout — Rooms

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/dashboard` | view | Occupancy, vacancy, maintenance, open visits |
| GET | `/hostels` | view | List hostels |
| POST | `/hostels` | manage | Create hostel |
| PUT | `/hostels/:id` | manage | Update hostel |
| DELETE | `/hostels/:id` | manage | Soft-delete hostel |
| GET | `/blocks` | view | List blocks |
| POST | `/blocks` | manage | Create block |
| PUT | `/blocks/:id` | manage | Update block |
| DELETE | `/blocks/:id` | manage | Soft-delete block |
| GET | `/floors` | view | List floors |
| POST | `/floors` | manage | Create floor |
| PUT | `/floors/:id` | manage | Update floor |
| DELETE | `/floors/:id` | manage | Soft-delete floor |
| GET | `/layout` | view | Full hostel → block → floor → room → bed tree |
| GET | `/rooms` | view | List rooms with occupancy |
| POST | `/rooms` | manage | Create room (auto-creates beds) |
| POST | `/rooms/bulk` | manage | Create a range of rooms |
| GET | `/rooms/:id` | view | Room detail with beds, occupants, assets |
| PUT | `/rooms/:id` | manage | Update room |
| DELETE | `/rooms/:id` | manage | Soft-delete room |
| PUT | `/rooms/:id/status` | manage | Change room status |
| GET | `/beds` | view | List beds |
| POST | `/beds` | manage | Add a bed |
| PUT | `/beds/:id` | manage | Update bed status/number |
| DELETE | `/beds/:id` | manage | Remove bed |
| GET | `/inspections` | view | Room inspections |
| POST | `/inspections` | manage | Record inspection |
| GET | `/maintenance` | view | Maintenance requests |
| POST | `/maintenance` | manage | Raise request |
| PUT | `/maintenance/:id` | manage | Update status/cost |
| GET | `/room-assets` | view | Assets linked to rooms |
| POST | `/room-assets` | manage | Link asset to room |

---

## Allocation

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/applications` | view | List applications |
| POST | `/applications` | allocate | Create application |
| POST | `/applications/:id/approve` | allocate | Approve |
| POST | `/applications/:id/reject` | allocate | Reject with reason |
| POST | `/applications/:id/waitlist` | allocate | Put on waiting list |
| GET | `/waitlist` | view | Waiting list by priority |
| GET | `/allocations` | view | List allocations |
| POST | `/allocations` | allocate | Reserve or activate a bed |
| GET | `/allocations/:id` | view | Allocation detail |
| PUT | `/allocations/:id` | allocate | Update notes/dates |
| POST | `/allocations/:id/change` | allocate | Room/bed change |
| POST | `/allocations/:id/vacate` | allocate | Start vacate + clearance |
| POST | `/allocations/:id/clearance` | allocate | Complete clearance |
| GET | `/allocations/:id/deposit` | fees | Deposit record |
| PUT | `/allocations/:id/deposit` | fees | Hold/adjust/refund/forfeit |
| GET | `/bed-suggestions` | view | Free beds by gender/type |
| GET | `/students` | view | Student search for allocation |

### Hard rules enforced here

- Unique active allocation per student and per bed (partial unique indexes).
- Student gender must match hostel type (`boys` / `girls`; `coed` allows both).
- Room occupancy cannot exceed capacity.
- Bed must be `vacant` (or `reserved` for the same student).
- Student must be active and not deleted.
- Guardian consent required before `active`.
- Deposit required before check-in when `require_deposit` is on.
- Deposit refund blocked until clearance is complete.

---

## Hostel Fees

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/fee-rules` | view | List fee rules |
| POST | `/fee-rules` | fees | Create rule |
| PUT | `/fee-rules/:id` | fees | Update rule |
| GET | `/mess-plans` | view | List mess plans |
| POST | `/mess-plans` | fees | Create mess plan |
| PUT | `/mess-plans/:id` | fees | Update mess plan |
| GET | `/fee-plans` | view | Allocation fee plans |
| POST | `/fee-plans` | fees | Assign plan |
| PUT | `/fee-plans/:id` | fees | Update plan |
| GET | `/billing/preview` | view | Preview resident bill |
| POST | `/billing/run` | fees | Generate bills + invoices |
| GET | `/bills` | view | Bill register |
| POST | `/bills/:id/cancel` | fees | Cancel unposted bill |
| GET | `/rebates` | view | Mess rebates |
| POST | `/rebates` | fees | Manual rebate |
| POST | `/rebates/:id/approve` | fees | Approve rebate |
| GET | `/deposits` | fees | Deposits held/settled |
| GET | `/damage` | view | Damage charges |
| POST | `/damage` | fees | Raise damage charge |
| GET | `/dues` | view | Hostel dues and defaulters |
| GET | `/fee-summary` | view | Collection/outstanding/deposit summary |

Billing creates `school_invoice` + `school_invoice_line` rows using fee heads of
type `hostel` and `deposit`, so hostel dues appear in the normal Fees screens.

---

## Hostel Attendance

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/roll-calls` | view | List sessions (with entries) |
| POST | `/roll-calls` | rollcall | Open a session and prefill roster |
| GET | `/roll-calls/:id` | view | Session detail |
| PUT | `/roll-calls/:id` | rollcall | Save entries (draft only) |
| POST | `/roll-calls/:id/submit` | rollcall | Submit and lock |
| POST | `/roll-calls/:id/correct` | rollcall | Audited correction with reason |
| GET | `/leave-passes` | view | Leave pass inbox |
| POST | `/leave-passes` | rollcall | Request a pass |
| POST | `/leave-passes/:id/guardian-otp` | rollcall | Record guardian OTP |
| POST | `/leave-passes/:id/approve` | leave_approve | Warden approval |
| POST | `/leave-passes/:id/reject` | leave_approve | Reject with reason |
| POST | `/leave-passes/:id/gate-out` | rollcall | Actual out + gate log |
| POST | `/leave-passes/:id/gate-in` | rollcall | Actual return + gate log |
| GET | `/gate-log` | view | Gate movements |
| POST | `/gate-log` | rollcall | Record movement |
| GET | `/duty` | view | Warden duty roster |
| POST | `/duty` | rollcall | Add duty |
| PUT | `/duty/:id` | rollcall | Update duty/substitute |
| GET | `/incidents` | view | Incident log |
| POST | `/incidents` | rollcall | Log incident |
| PUT | `/incidents/:id` | rollcall | Update action/status |
| GET | `/complaints` | view | Complaints |
| POST | `/complaints` | rollcall | Raise complaint |
| PUT | `/complaints/:id` | rollcall | Update/escalate/resolve |
| GET | `/alerts` | view | Late returns, absences, missing roll calls |
| GET | `/night-compliance` | view | Night roll-call compliance |
| POST | `/mess-rebates/auto` | fees | Generate rebates from approved leave |

Roll-call statuses: `present`, `absent`, `on_leave`, `sick_bay`, `late`.

Leave-pass lifecycle: `requested` → `guardian_approved` → `approved` → `out` →
`returned` / `overdue` / `rejected` / `cancelled`.

---

## Visitors

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/visitors` | view | Visitor master (ID masked in list) |
| POST | `/visitors` | visitor | Create visitor |
| PUT | `/visitors/:id` | visitor | Update visitor |
| GET | `/authorised-visitors` | view | Authorised list |
| POST | `/authorised-visitors` | visitor | Add to authorised list |
| DELETE | `/authorised-visitors/:id` | visitor | Remove |
| GET | `/visit-rules` | view | Visiting rules |
| POST | `/visit-rules` | visitor | Create rule |
| PUT | `/visit-rules/:id` | visitor | Update rule |
| GET | `/visitor-entries` | view | Visitor log |
| POST | `/visitor-entries` | visitor | Pre-register or walk-in |
| POST | `/visitor-entries/:id/approve` | visitor | Approve |
| POST | `/visitor-entries/:id/check-in` | visitor | Check in + badge |
| POST | `/visitor-entries/:id/check-out` | visitor | Check out |
| POST | `/visitor-entries/:id/deny` | visitor | Deny with reason |
| GET | `/open-visits` | view | Visitors not checked out |
| GET | `/blacklist` | view | Blacklist |
| POST | `/blacklist` | visitor | Add to blacklist |
| PUT | `/blacklist/:id` | visitor | Lift/update |

### Hard rules enforced here

- Blacklisted visitor cannot check in.
- Unauthorised visitor needs warden/guardian approval.
- Outside visiting hours needs approval with reason.
- Taking a child out needs an approved leave pass and authorised person.
- Overnight guests blocked unless policy enables them.

---

## Reports and settings

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/occupancy` | reports | Occupancy by hostel/block/floor/room |
| GET | `/reports/attendance` | reports | Roll-call summary by date/session |
| GET | `/reports/visitors` | reports | Visitor log and open visits |
| GET | `/reports/fees` | reports | Hostel collection and dues |
| GET | `/reports/audit` | audit | Sensitive action audit |
| GET | `/settings` | view | Policy settings |
| PUT | `/settings` | manage | Update policy settings |

### Default policy settings

| Key | Default |
|---|---|
| `require_guardian_consent` | `true` |
| `require_deposit` | `false` |
| `deposit_amount` | `0` |
| `mid_month_rule` | `daily` |
| `leave_require_guardian_otp` | `true` |
| `visitor_require_approval` | `true` |
| `allow_overnight_guests` | `false` |
| `rollcall_grace_minutes` | `15` |
| `retention_gate_days` | `365` |
| `retention_visitor_days` | `365` |
