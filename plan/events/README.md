# Events and PTM — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/events/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Build steps
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_events_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Student, Staff, Timetable, Communication
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_events_core.sql`, `sql/81_events_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_events.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/events/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Event Calendar | Calendar, event creation, event listing |
| 2 | PTM | Teacher availability, slots, booking, remarks |
| 3 | Photo Gallery | Albums, media upload, permissions |
| 4 | Reports & Hardening | Roles, permissions, audit, exports, testing |

---

## Core rules

**Always blocked**
- Event registration exceeding participant limit
- Parents seeing irrelevant events
- Duplicate PTM bookings
- Overlapping PTM appointments
- Rescheduling past deadline
- Cancelled events without notification
- Unauthorized photo publishing
- PTM remarks accessible to unauthorized users
- Unrecorded meeting changes

**Warn only**
- Low event registration rate
- Upcoming PTM conflicts
- Gallery storage near limit

---

## Permissions

| Permission | Purpose |
|---|---|
| `events.view` | Read all events screens |
| `events.manage` | Full setup and operations (superset) |
| `events.calendar` | Calendar and event management |
| `events.ptm` | PTM schedule and booking |
| `events.gallery` | Photo gallery management |
| `events.reports` | Reports and exports |

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Events & PTM** in the menu:
Event Calendar, Events List, PTM Schedule, Photo Gallery.