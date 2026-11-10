# Hostel & Residential Life — Integration Points

---

## 1. Students master

| Source | Use |
|---|---|
| `school_students.id` | Resident identity |
| `first_name`, `last_name`, `admission_no` | Display and search |
| `gender` | Boys/girls hostel rule |
| `class_id`, `section_id` | Roommate grouping, reports |
| `guardian_name`, `guardian_phone` | Consent, OTP, alerts |
| `status` | Only `active` students may be allocated |
| `deleted_at` | Deleted students cannot be allocated |

No student columns are modified. `hostel_required` on the student remains a
flag only; the allocation table is the source of truth.

---

## 2. Fees & Accounts

**Tables reused**

- `school_fee_head` (`type` = `hostel` or `deposit`)
- `school_invoice`, `school_invoice_line`
- `school_receipt`, `school_receipt_allocation`
- `school_concession_type`, `school_fine_rule`

**Behaviour**

- Hostel billing creates one `school_invoice` per resident per period with
  lines for rent and mess (net of rebate).
- Invoice numbers use the same `INV-YYYYMMDD-NNNN` pattern as
  `school_fee_ops.js`.
- Deposit is a liability, not income. It is recorded in
  `school_hostel_deposit` and settled on clearance.
- Damage recovery is an extra invoice line.
- Because invoices are normal fee invoices, the existing Collection, Dues,
  Defaulters, Refunds and Reports screens work unchanged.
- Fee heads `Hostel Rent`, `Hostel Mess` and `Hostel Deposit` are created on
  demand if missing.

**Accounting entries** (documented in `DESIGN.md` §9.6): hostel fee income,
mess income, deposit liability, damage recovery income, deposit refund and
deposit adjustment against dues.

---

## 3. Inventory & Assets

- `school_inv_asset.room_id` already exists. Hostel rooms can be linked by
  updating that column or through `school_hostel_room_asset`.
- `school_hostel_room_asset` stores quantity, condition, issued/returned dates
  for bedding and furniture.
- Damage found at inspection or vacating is recorded in
  `school_hostel_room_inspection` / `school_hostel_damage` and can be charged
  through Fees.
- Asset write-off stays in the Inventory module.

---

## 4. HR & Payroll

- `school_hostel.chief_warden_staff_id` and
  `school_hostel_block.warden_staff_id` reference `school_staff(id)`.
- `school_hostel_duty.staff_id` and `substitute_staff_id` reference staff.
- Warden leave is handled in HR; the duty roster records the substitute.
- Payroll is unchanged; hostel staff salary flows through the existing payroll
  run.

---

## 5. Attendance

- Hostel attendance is separate from class attendance.
- Approved hostel leave (`school_hostel_leave_pass`) and sickness
  (`sick_bay`) can be surfaced in school attendance reports later; class
  teachers still mark day attendance.
- The hostel module never overwrites `school_attendance`.

---

## 6. Calendar

- `school_calendar_event` vacations/holidays can close hostel beds for dates.
- The module stores the dates on leave passes (`home_leave`, `vacation`) and
  uses them for mess rebates.
- A future enhancement can auto-generate vacation passes from the calendar.

---

## 7. Notifications

- `school_hostel_notification` stores hostel alerts (leave requested/decided,
  student out/returned, late return, absence, visitor arrived, incident).
- Delivery can reuse the existing communication/automation infrastructure.
- The UI exposes alerts in the Attendance screen; no external gateway is
  required for the first release.

---

## 8. Audit

- Every sensitive action calls `writeAudit(pool, req, { action, entity,
  entityId, before, after })` from `server/src/school/foundation.js`.
- Audited actions: hostel/room/bed changes, application decision, allocation,
  room change, vacate, clearance, deposit settlement, fee rule change, billing
  run, rebate approval, roll-call submit/correction, leave approval/gate
  movement, visitor check-in/out, blacklist.
- Roll calls, gate logs and visitor entries are immutable rows; corrections
  create audit entries and keep the original.

---

## 9. Privacy and retention

- Visitor ID numbers are masked in list responses.
- Role-based access via the granular hostel permissions.
- Retention settings (`retention_gate_days`, `retention_visitor_days`) are
  stored in `school_hostel_setting`; a later cleanup job can enforce them.
- Photos are referenced by URL only; the module does not copy binary data.
- CCTV is out of scope and must remain outside private areas.
