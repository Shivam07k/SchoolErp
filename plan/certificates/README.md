# Certificates and ID Management — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/certificates/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Build steps
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_certificates_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Student, Fees, Admission, File Management
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_certificates_core.sql`, `sql/81_certificates_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_certificates.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/certificates/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Templates | Template designer, dynamic fields, preview |
| 2 | ID Cards | Individual and bulk ID card generation |
| 3 | TC Certificate | TC request, approval, generation, register |
| 4 | Reports & Hardening | Roles, permissions, audit, exports, testing |

---

## Core rules

**Always blocked**
- Missing unique certificate number
- Silent modification of issued certificates
- Unauthorized corrections
- ID cards with outdated student info
- Bulk generation without class/section filters
- TC generation without approval workflow
- Unmarked duplicate certificates
- Template changes affecting issued documents
- Unauthorized certificate approval

**Warn only**
- Missing student photos for ID cards
- Template version mismatches
- Low ID card generation rate

---

## Permissions

| Permission | Purpose |
|---|---|
| `certificates.view` | Read all certificate screens |
| `certificates.manage` | Full setup and operations (superset) |
| `certificates.templates` | Template management |
| `certificates.idcards` | ID Card management |
| `certificates.tc` | TC Certificate workflow |
| `certificates.reports` | Reports and exports |

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Certificates & ID** in the menu:
Templates, Generate, ID Cards, TC Certificate.