# Canteen — Plan Index

**Version 1.0** · 4 November 2026

---

## Plan directory

```
plan/canteen/
├── DESIGN.md              # Complete design (from supplied plan)
├── BUILD_PLAN.md          # Five build steps + optional later step
├── DATABASE_SCHEMA.sql    # Core schema (sql/80_canteen_core.sql)
├── API_ENDPOINTS.md       # REST endpoints and permissions
├── FRONTEND_SCREENS.md    # React screens, tabs and routes
├── INTEGRATION_POINTS.md  # Fees, Inventory, HR, Timetable, Notifications
├── TEST_SCENARIOS.md      # Scenario and rule test matrix
└── README.md              # This file
```

Runtime files:
| Area | Files |
|---|---|
| Migrations | `sql/80_canteen_core.sql`, `sql/81_canteen_ops.sql` |
| Migration registry | `server/_schoolsetup.mjs` |
| Backend router | `server/src/routes/school_canteen.js` |
| Router mount | `server/src/index.js` (before `schoolCompRouter`) |
| Permissions | `server/src/school/foundation.js` |
| Frontend | `src/pages/school/canteen/*.jsx` |
| Menu | `src/school/menu.js` |
| Module dispatch | `src/components/SchoolPage.jsx` |

---

## Build steps

| Step | Deliverable | Done when |
|---|---|---|
| 1 | Menu | Week's menu runs without daily entry |
| 2 | Orders | Parent pre-order reaches kitchen list |
| 3 | Billing | Bill made in under 5 seconds and cash tallies |
| 4 | Inventory | Sales reduce stock automatically |
| 5 | Reports & Hardening | Compliance and profit reports ready |
| 6 | Later (optional) | Kitchen display, nutrition, supplier API |

---

## Core rules

**Always blocked**
- Sale above wallet balance without other payment
- Sale of parent-blocked item
- Sale with zero stock without approval
- Refund without reason
- Bill edit after day closing
- Approving own refund/adjustment
- Price change without effective date

**Warn only**
- Student near daily limit
- Stock below reorder level
- High wastage item
- Allergen item sold to flagged student
- Document expiring soon
- Low wallet balance

---

## Permissions

| Permission | Purpose |
|---|---|
| `canteen.view` | Read all canteen screens |
| `canteen.manage` | Full setup and operations (superset) |
| `canteen.menu` | Menu, recipes, prices |
| `canteen.orders` | Orders, pre-orders, bulk |
| `canteen.billing` | Billing, wallets, day closing |
| `canteen.inventory` | Stock, purchase, wastage |
| `canteen.reports` | Reports and exports |
| `canteen.audit` | Audit and retention |

---

## Quick start

```bash
node server/_schoolsetup.mjs school_erp
npm run dev
```

Login as `ADMIN` to see **Canteen** in Operations menu:
Menu, Orders, Billing, Inventory.
