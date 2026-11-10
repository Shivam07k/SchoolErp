# Communication Module — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/communication/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Build steps
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_communication_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Student, Parent, Staff, Fees, Exam, Attendance
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_communication_core.sql`, `sql/81_communication_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_communication.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/communication/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Communication Setup | Templates, providers, audience groups, notification engine |
| 2 | Notice Board | Notice creation, attachments, publishing, expiry, acknowledgement |
| 3 | Communication Logs | Delivery tracking, retries, reports, analytics |
| 4 | Reports & Hardening | Roles, permissions, audit, exports, testing |

---

## Core rules

**Always blocked**
- Sending to unauthorized audiences
- Bulk communication without class/section filters
- Missing communication log
- Duplicate notifications
- Exposing sensitive student info in public notices
- Scheduled messages past expiry/cancellation
- Provider credentials accessible to non-admins
- Ignoring parent communication preferences

**Warn only**
- High failure rate in delivery
- Low template coverage
- Scheduled message near send time
- Large recipient list without confirmation

---

## Permissions

| Permission | Purpose |
|---|---|
| `communication.view` | Read all communication screens |
| `communication.manage` | Full setup and operations (superset) |
| `communication.sms` | Send SMS, manage templates |
| `communication.email` | Send Email, manage templates |
| `communication.notice` | Notice Board management |
| `communication.app` | App Notifications management |
| `communication.logs` | Message Logs and analytics |
| `communication.provider` | SMS/Email provider settings |

---

## Quick start

```bash
# apply schema
node server/_schoolsetup.mjs school_erp

# run the app
npm run dev
```

Login as `ADMIN` to see **Communication** in the menu:
Dashboard, Send SMS, Send Email, Notice Board, App Notifications, Templates, Logs, Reports, Providers.