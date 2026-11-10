# Library — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/library/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Five build steps + optional later step
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_library_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Fees, Inventory, Assets, Admissions, Notifications
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_library_core.sql`, `sql/81_library_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_library.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/library/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Books | Whole register loaded and labels print |
| 2 | Members | Every active student/staff has a library category/card |
| 3 | Issue/Return | A book is issued in under 10 seconds |
| 4 | Fines | Overdue return produces correct fine automatically |
| 5 | Reports | Circulation and overdue reports match register |
| 6 | Later (optional) | RFID gates, e-library, inter-library loan |

---

## Core rules

**Always blocked**
- Issuing a copy already issued
- Issuing above member limit
- Issuing reference-only copy
- Issuing to inactive member
- Fine waiver without reason/approver
- Editing closed loan
- Approving own waiver
- Deleting copy with loan history
- Transfer certificate with pending book/fine

**Warn only**
- Member with overdue book requesting another
- High demand title
- Copy in poor condition issued
- Member near fine cap
- Rack not verified long time

---

## Permissions

| Permission | Purpose |
|---|---|
| `library.view` | Read all library screens |
| `library.manage` | Full setup and operations (superset) |
| `library.issue` | Issue/return, renew |
| `library.members` | Member categories and cards |
| `library.fines` | Fine rules, collection, waivers |
| `library.reports` | Reports and exports |
| `library.audit` | Audit and retention |

---

## Quick start

```bash
# apply schema
node server/_schoolsetup.mjs school_erp

# run the app
npm run dev
```

Login as `ADMIN` to see **Library** in Operations menu:
Books, Issue/Return, Members, Fines, Reports.
