# School ERP Canteen Module – BUILD_PLAN

**Version:** 1.0  
**Date:** 4 November 2026  
**Module ID:** M23  
**Package ID:** M23-canteen

## Overview

The Canteen module provides tenant-scoped food service operations for schools: weekly menu planning, daily menu publishing, pre-orders and POS sales, meal wallet accounting, inventory-driven stock control, billing/day closing, refunds, and auditable reporting with allergen/dietary enforcement.

Core principles:
- Atomic wallet/stock/bill commit per order
- Idempotent payments via `idempotency_key`
- Price effective dating, never retroactive
- Daily closing locks bills; edits require reopen with audit
- RLS tenant scope on all tables

## Dependencies

- **Students/Family M07** – student master, parent linkage, wallet ownership
- **Fees & Ledger M17** – wallet top-ups, refunds posting, daily sales summary to accounting
- **Inventory M19** – shared stock items, purchase orders, consumption posting
- **Dietary M09** – allergen/dietary flags sync and restriction checks
- **Notifications** – low wallet, order ready, refund processed, stock reorder
- **Timetable** – meal times, class-based pre-order windows
- **Reporting M30** – canteen KPIs in central analytics
- **Permissions** – `server/src/school/foundation.js`

## Artifacts

**Migrations**
- `sql/80_canteen_core.sql` – core master tables
- `sql/81_canteen_ops.sql` – operational tables, movements, audit

**Backend**
- Router: `server/src/routes/school_canteen.js`
- Mount: `server/src/index.js` before `schoolCompRouter`
- Migration registry: `server/_schoolsetup.mjs`

**Frontend**
- Routes: `/school/canteen/*`
- Pages: `src/pages/school/canteen/{Menu,Orders,Billing,Inventory,Reports}*.jsx`
- Menu entry: `src/school/menu.js`, dispatch `src/components/SchoolPage.jsx`

## Permissions

| Permission | Purpose |
|---|---|
| `canteen.view` | Read all canteen screens |
| `canteen.manage` | Full setup and operations superset |
| `canteen.menu` | Menu, recipes, prices |
| `canteen.orders` | Orders, pre-orders, bulk |
| `canteen.billing` | Billing, wallets, day closing |
| `canteen.inventory` | Stock, purchase, wastage |
| `canteen.reports` | Reports and exports |
| `canteen.audit` | Audit and retention |

## Hard Rules

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
- Low wallet balance
- Document expiring soon

## Build Steps

### Step 1 – Menu

**Done When:** Week's menu runs without daily entry

**Database tables**
- `canteen_categories`
- `canteen_items`
- `canteen_recipes`
- `canteen_menu_plan`
- `canteen_daily_menu`

**Backend API endpoints**
- `GET /api/school/canteen/categories`
- `POST /api/school/canteen/categories`
- `GET /api/school/canteen/items`
- `POST /api/school/canteen/items`
- `PUT /api/school/canteen/items/:id`
- `GET /api/school/canteen/recipes`
- `POST /api/school/canteen/recipes`
- `GET /api/school/canteen/menu/plan?week_start=...`
- `POST /api/school/canteen/menu/plan`
- `POST /api/school/canteen/daily-menu/publish`
- `GET /api/school/canteen/daily-menu?date=...`

**Frontend screens**
- Menu > Items Master ` /school/canteen/menu/items`
- Categories ` /school/canteen/menu/categories`
- Recipe Builder ` /school/canteen/menu/recipes`
- Weekly Menu Plan ` /school/canteen/menu/plan`
- Daily Menu Publish ` /school/canteen/menu/daily`

**Permissions**
- `canteen.menu`, `canteen.manage`

### Step 2 – Orders

**Done When:** Parent pre-order reaches kitchen list

**Database tables**
- `canteen_wallets`
- `canteen_orders`
- `canteen_order_items`
- `canteen_daily_menu`

**Backend API endpoints**
- `GET /api/school/canteen/wallets/:studentId`
- `POST /api/school/canteen/wallets/topup`
- `GET /api/school/canteen/orders?date=&type=`
- `POST /api/school/canteen/orders/preorder`
- `POST /api/school/canteen/orders/pos`
- `PATCH /api/school/canteen/orders/:id/status`
- `GET /api/school/canteen/orders/kitchen-prep?date=...`
- `GET /api/school/canteen/orders/student/:studentId`

**Frontend screens**
- Orders List ` /school/canteen/orders`
- Order Entry POS ` /school/canteen/orders/pos`
- Pre-order Desk ` /school/canteen/orders/preorder`
- Parent Pre-order View ` /school/canteen/orders/parent`

**Permissions**
- `canteen.orders`, `canteen.view`

### Step 3 – Billing

**Done When:** Bill made in under 5 seconds and cash tallies

**Database tables**
- `canteen_bills`
- `canteen_wallet_transactions`
- `canteen_orders`
- `canteen_refunds`

**Backend API endpoints**
- `POST /api/school/canteen/bills/create`
- `GET /api/school/canteen/bills?date=`
- `GET /api/school/canteen/bills/:id`
- `POST /api/school/canteen/bills/:id/refund`
- `GET /api/school/canteen/wallet-transactions?walletId=`
- `POST /api/school/canteen/day-close`
- `GET /api/school/canteen/cash-tally?date=`
- `POST /api/school/canteen/bills/:id/void`

**Frontend screens**
- Billing & Day Close ` /school/canteen/billing`
- Wallets ` /school/canteen/billing/wallets`
- Refund Entry ` /school/canteen/billing/refunds`
- Cash Tally ` /school/canteen/billing/cash-tally`

**Permissions**
- `canteen.billing`, `canteen.manage`

### Step 4 – Inventory

**Done When:** Sales reduce stock automatically

**Database tables**
- `canteen_stock_items`
- `canteen_stock_movements`
- `canteen_purchases`
- `canteen_recipes`
- `canteen_items`

**Backend API endpoints**
- `GET /api/school/canteen/stock/items`
- `POST /api/school/canteen/stock/items`
- `POST /api/school/canteen/stock/opening-balance`
- `POST /api/school/canteen/purchases`
- `POST /api/school/canteen/stock/movements`
- `POST /api/school/canteen/wastage`
- `GET /api/school/canteen/stock/levels`
- `GET /api/school/canteen/stock/reorder-alerts`

**Frontend screens**
- Stock Items ` /school/canteen/inventory/stock`
- Purchase Receipt ` /school/canteen/inventory/purchases`
- Wastage Entry ` /school/canteen/inventory/wastage`
- Stock Movements ` /school/canteen/inventory/movements`

**Permissions**
- `canteen.inventory`, `canteen.manage`

### Step 5 – Reports & Hardening

**Done When:** Compliance and profit reports ready

**Database tables**
- All canteen tables

**Backend API endpoints**
- `GET /api/school/canteen/reports/sales?from=&to=`
- `GET /api/school/canteen/reports/stock-movement?from=&to=`
- `GET /api/school/canteen/reports/profit`
- `GET /api/school/canteen/reports/wallet-usage`
- `GET /api/school/canteen/reports/allergen-exposure`
- `GET /api/school/canteen/reports/preorder-vs-actual`
- `GET /api/school/canteen/audit/logs?type=`

**Frontend screens**
- Reports Dashboard ` /school/canteen/reports`
- Sales Summary ` /school/canteen/reports/sales`
- Stock & Wastage ` /school/canteen/reports/stock`
- Wallet Usage ` /school/canteen/reports/wallets`
- Audit Log ` /school/canteen/reports/audit`

**Permissions**
- `canteen.reports`, `canteen.audit`

### Step 6 – Later Optional

**Kitchen Display System real-time cooking queue**
- Real-time order queue, prep status, ready alerts

**Nutrition analysis per student**
- Per-item nutrition, daily intake reports, diet compliance

**Supplier API integration**
- Automated purchase orders, GRN sync

**Meal delivery/off-campus ordering**
- Delivery scheduling, external payment gateways

---

*Build aligns with DESIGN.md B12 Build Plan. Atomic transactions, idempotency, RLS, and audit trail enforced across all steps.*
