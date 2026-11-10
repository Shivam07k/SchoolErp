# Front Office — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/front_office/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Six build steps + optional later step
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_frontoffice_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Admissions, Student, HR, Transport, Notifications
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_frontoffice_core.sql`, `sql/81_frontoffice_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_frontoffice.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/front_office/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Enquiry | Enquiry converts to admission without re-entry |
| 2 | Visitors | Desk shows who is inside at any time |
| 3 | Complaints | No complaint stays open without owner/due date |
| 4 | Call Log | Call logged in under 15 seconds |
| 5 | Appointments | No host has two bookings in one slot |
| 6 | Reports & Hardening | Conversion and complaint reports ready |
| 7 | Later (optional) | Face recognition, telephony, chatbot |

---

## Core rules

**Always blocked**
- Visitor entering without check-in
- Child released to unauthorized person without approval
- Visitor on blacklist
- Double booking of host slot
- Complaint closed without resolution note
- Editing closed visit/call
- Approving own pickup exception
- Deleting enquiry with follow-up history

**Warn only**
- Follow-up overdue
- Complaint near due date
- Visitor overstaying
- Repeat complaint
- Host overloaded
- Enquiry without follow-up date

---

## Permissions

| Permission | Purpose |
|---|---|
| `frontoffice.view` | Read all front office screens |
| `frontoffice.manage` | Full setup and operations (superset) |
| `frontoffice.enquiry` | Enquiry pipeline and conversion |
| `frontoffice.visitors` | Visitor check-in/out, gate passes |
| `frontoffice.complaints` | Complaint tickets |
| `frontoffice.calls` | Call log |
| `frontoffice.appointments` | Appointments |
| `frontoffice.reports` | Reports and exports |
| `frontoffice.audit` | Audit and retention |

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Front Office** in Operations menu:
Enquiry, Visitors, Complaints, Call Log, Appointments.
