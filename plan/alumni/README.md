# Alumni and Placement Management — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/alumni/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Build steps
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_alumni_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Student, Communication, Fees, File Management
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_alumni_core.sql`, `sql/81_alumni_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_alumni.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/alumni/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Alumni Directory | Alumni registration, verification, profiles |
| 2 | Alumni Events | Events, registrations, participation |
| 3 | Job Postings | Job creation, approval, applications |
| 4 | Donations | Campaigns, payments, receipts |
| 5 | Reports & Hardening | Roles, permissions, audit, exports, testing |

---

## Core rules

**Always blocked**
- Alumni records without student history link
- Duplicate alumni registration
- Unverified profiles shown as verified
- Unauthorized job posting publication
- Jobs without approval/expiry rules
- Expired jobs not auto-inactivated
- Donation transactions without payment records
- Missing donation receipts
- Deleted donation records after financial posting
- Unauthorized donor info access

**Warn only**
- Low alumni verification rate
- Expired job postings not cleaned
- Donation campaign below target

---

## Permissions

| Permission | Purpose |
|---|---|
| `alumni.view` | Read all alumni screens |
| `alumni.manage` | Full setup and operations (superset) |
| `alumni.directory` | Alumni directory management |
| `alumni.events` | Alumni events management |
| `alumni.jobs` | Job postings management |
| `alumni.donations` | Donation management |
| `alumni.reports` | Reports and exports |

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Alumni & Placement** in the menu:
Alumni Directory, Alumni Events, Job Postings, Donations.