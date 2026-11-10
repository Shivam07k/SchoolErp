# Hostel & Residential Life — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/hostel/
├── DESIGN.md              # Complete design (from the supplied plan)
├── BUILD_PLAN.md          # Six build steps + optional later step
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_hostel_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Fees, Inventory, HR, Attendance, Calendar
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:

| Area | Files |
|---|---|
| Migrations | `sql/80_hostel_core.sql`, `sql/81_hostel_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_hostel.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/hostel/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Hostel Rooms | Every bed is created and shows its status |
| 2 | Allocation | No bed is double-booked and vacating follows clearance |
| 3 | Hostel Fees | A resident's bill matches their stay |
| 4 | Hostel Attendance | Absences and late returns alert the right people |
| 5 | Visitors | Every visitor is logged in and out |
| 6 | Reports and hardening | Inspector can see occupancy, rolls and visitor logs |
| 7 | Later (optional) | Mess menu/stock, laundry, biometric, CCTV, patrol |

---

## Core rules

**Always blocked**

- One student on one bed at a time; one active allocation per bed.
- Gender mismatch between student and hostel type.
- Allocation above room capacity or to a maintenance bed.
- Allocation without guardian consent, or without deposit when policy requires it.
- A student who is not active/enrolled.
- Leave before guardian + warden approval.
- Blacklisted visitor; unauthorised visitor without approval.
- Deposit refund before clearance.
- Editing a locked roll call without a reason.
- Approving your own exception.

**Warn only**

- Room near capacity, roommate age/class gap, late return, night absence,
  overstaying visitor, frequent leave, many visitors, unpaid hostel dues.

---

## Permissions

| Permission | Purpose |
|---|---|
| `hostel.view` | Read all hostel screens |
| `hostel.manage` | Full setup and operations (superset) |
| `hostel.allocate` | Applications, allocation, room change, vacate |
| `hostel.rollcall` | Roll calls and gate log |
| `hostel.leave_approve` | Approve leave passes |
| `hostel.visitor` | Visitor check-in/out |
| `hostel.fees` | Hostel fee rules, billing, deposits |
| `hostel.reports` | Reports and exports |
| `hostel.audit` | Audit and retention |

---

## Quick start

```bash
# apply schema
node server/_schoolsetup.mjs school_erp

# run the app
npm run dev
```

Login as `ADMIN` (super access) to see **Hostel** in the Operations menu:
Rooms, Allocation, Hostel Fees, Hostel Attendance, Visitors, Reports.
