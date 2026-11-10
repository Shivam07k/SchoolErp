# Canteen Module – Design Document

**Version:** 1.0  
**Date:** 4 November 2026  
**Module ID:** M23  
**Package ID:** M23-canteen  
**Status:** Design – Plan

---

## 1. Purpose and Scope

Provide a tenant-scoped school canteen/food service system covering weekly menu planning, pre-orders and on-the-spot sales, meal wallet accounting, inventory-driven stock control, and daily billing/closing. The module must guarantee atomic charge/wallet/stock commit, allergen/dietary restriction enforcement, duplicate-safe payments, and auditable refunds.

**In scope**
- Menu management with categories, items, prices, recipes, effective dates, dietary tags
- Pre-order and POS orders with student/class filters
- Meal wallet/parent prepaid balances and daily limits
- Billing, day closing, refunds and adjustments
- Inventory stock, purchase receipts, wastage, sales-driven stock deduction
- Reports: sales, stock, wastage, top items, profit, wallet usage, allergen exposure
- Permissions, alerts and audit

**Out of scope – Phase 1**
- Kitchen display system real-time cooking queue
- Nutrition analysis per student
- Supplier API integration
- Meal delivery/off-campus ordering

## 2. Submodules

1. **Menu** – categories, items, recipes, prices, weekly plan, daily menu
2. **Orders** – pre-orders, POS orders, bulk/class orders, order status
3. **Billing** – wallet charges, cash/card payments, bills, refunds, day closing
4. **Inventory** – stock items, opening balance, purchases, wastage, sales consumption
5. **Reports & Compliance** – sales, stock, profit, allergen warnings, audit

## 3. Requirements

### Functional
- Weekly menu plan with daily menu auto-generation; item availability controlled by stock
- Pre-order window per day/class; student can order within parent limits
- POS order at counter with instant price, wallet deduction and stock check
- Charge, wallet balance and stock movement commit atomically
- Allergen/dietary restriction flags visible only to authorized staff; block sale to flagged students
- Refund reverses wallet, stock and ledger entry with reason and approver
- Daily closing locks bills for the day; edits require reopen with audit
- Inventory consumption from recipes on sales; automatic reorder warnings
- Parent view of child orders, wallet top-up, spending limits
- Cash tally per shift reconciles with bills

### Non-functional
- Tenant-scoped with RLS on all tables
- Idempotent order/payment callbacks; duplicate-safe
- <5s bill generation per README build step
- RBAC per permission listed in README
- Audit trail for price changes, refunds, stock adjustments
- Offline-tolerant POS with sync; conflicts resolved by server timestamp

## 4. Recommended Solution

- **Backend:** Express router `server/src/routes/school_canteen.js` mounted before `schoolCompRouter`
- **Frontend:** React pages `src/pages/school/canteen/{Menu,Orders,Billing,Inventory}*.jsx` under Operations > Canteen
- **Database:** PostgreSQL migrations `sql/80_canteen_core.sql`, `sql/81_canteen_ops.sql`
- **Permissions:** `canteen.view`, `canteen.manage`, `canteen.menu`, `canteen.orders`, `canteen.billing`, `canteen.inventory`, `canteen.reports`, `canteen.audit`
- **Integration:** Students/Family M07 → wallets; Fees/Ledger M17; Inventory M19; Dietary M09; Notifications; Reporting M30

## 5. Core Design

### 5.1 Day’s canteen workflow

1. **Night before:** Daily menu published from weekly plan. Stock check runs; items below reorder show warning.
2. **Pre-order window opens:** Students/parents place orders for next day/morning. Limits enforced.
3. **Kitchen prep list:** Pre-orders aggregated by item for kitchen.
4. **Morning service:** POS orders accepted. Order → validate wallet/stock/blocked item → atomic commit → receipt.
5. **Mid-day:** Stock level updates, wastage entries allowed.
6. **End of day:** Day closing generates cash summary, wallet settlements, stock consumption report. Bills locked.
7. **Refund/adjustment:** Request → approve → reverse wallet, stock, ledger.

### 5.2 Mechanisms

- **Atomic transaction:** Order creation wraps wallet debit, stock deduction, bill creation in one DB transaction
- **Idempotency key:** `order_idempotency_key` prevents duplicate payment callbacks
- **Price effective dating:** Prices change with effective date, never retroactive
- **Allergen guard:** Sale blocked if student has allergen flag and item contains allergen; logged
- **Daily closing lock:** `day_close_date` per canteen; edits blocked after close

## 6. Data Model – B6

Tables per `sql/80_canteen_core.sql` and `sql/81_canteen_ops.sql`:

### `canteen_items`
- `id`, `tenant_id`, `item_code`, `name`, `category_id`, `description`, `unit`, `is_active`, `allergen_tags` TEXT[], `dietary_tags` TEXT[], `recipe_id`, `created_at`

### `canteen_categories`
- `id`, `tenant_id`, `name`, `display_order`

### `canteen_recipes`
- `id`, `tenant_id`, `item_id`, `stock_item_id`, `qty_per_unit`, `uom`

### `canteen_menu_plan`
- `id`, `tenant_id`, `week_start_date`, `day_of_week`, `meal_type`, `item_id`, `price`, `effective_from`, `effective_to`

### `canteen_daily_menu`
- `id`, `tenant_id`, `menu_date`, `item_id`, `price`, `available_qty`, `is_active`

### `canteen_wallets`
- `id`, `tenant_id`, `student_id`, `balance`, `daily_limit`, `parent_blocked_items` JSONB

### `canteen_orders`
- `id`, `tenant_id`, `order_no`, `student_id`, `order_date`, `order_type` ENUM('preorder','pos'), `status` ENUM('placed','confirmed','served','cancelled','refunded'), `total_amount`, `idempotency_key`, `created_by`, `created_at`

### `canteen_order_items`
- `id`, `tenant_id`, `order_id`, `item_id`, `qty`, `price`, `line_total`, `allergen_warning_shown`

### `canteen_bills`
- `id`, `tenant_id`, `bill_no`, `order_id`, `bill_date`, `amount`, `payment_mode` ENUM('wallet','cash','card','mixed'), `status` ENUM('paid','refunded','void'), `day_closed`

### `canteen_wallet_transactions`
- `id`, `tenant_id`, `wallet_id`, `order_id`, `type` ENUM('debit','credit'), `amount`, `balance_after`, `ref_no`

### `canteen_stock_items`
- `id`, `tenant_id`, `stock_code`, `name`, `unit`, `reorder_level`, `current_qty`

### `canteen_stock_movements`
- `id`, `tenant_id`, `stock_item_id`, `movement_type` ENUM('purchase','consumption','wastage','adjustment'), `qty`, `ref_order_id`, `movement_date`, `created_by`

### `canteen_purchases`
- `id`, `tenant_id`, `po_no`, `supplier_id`, `received_date`, `status`

### `canteen_refunds`
- `id`, `tenant_id`, `bill_id`, `refund_date`, `amount`, `reason`, `approved_by`, `reversal_status`

Indexes on `(tenant_id, ...)` for hot queries. RLS enforced.

## 7. Rules & Policies – B7

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

## 8. Screens – B8

**Menu:** Canteen > Menu, Orders, Billing, Inventory

- **Menu Plan:** weekly grid, item assignment, price, effective dates, allergen tags
- **Daily Menu:** publish/unpublish, availability override, stock preview
- **Items Master:** CRUD, category, recipe, allergen/dietary tags
- **Orders List:** filters by date/student/class, pre-order vs POS, status
- **Order Entry POS:** student search, item scanner, wallet balance, quick bill
- **Pre-order Desk:** class bulk entry, parent view
- **Billing & Day Close:** open bills, cash tally, day closing workflow, refund entry
- **Wallets:** top-up, balance, transaction history, daily limits
- **Stock:** stock items, opening balance, purchase receipt, wastage entry
- **Reports:** sales summary, stock movement, profit, allergen exposure, wallet usage

## 9. Workflows – B9

- **Pre-order Workflow:** Open window → Student selects → Validate limits/allergens → Confirm → Kitchen prep list
- **POS Sale Workflow:** Scan student → Select items → Check stock/wallet → Atomic commit → Print receipt
- **Refund Workflow:** Request → Validate reason/approver → Reverse wallet/stock/ledger → Audit
- **Day Closing Workflow:** Validate open bills → Generate cash summary → Lock day → Archive
- **Stock Consumption:** On order serve, deduct via recipe → Update stock → Warn reorder
- **Price Change Workflow:** Enter new price with effective date → Audit log → Apply future

## 9.5 Integration Points – B9.5

- **Fees M17:** Wallet top-ups via fees, refunds post to ledger, daily sales summary to accounting
- **Inventory M19:** Stock items shared, purchase orders, consumption posting
- **Student/Family M07:** Student master, parent guardian, wallet linkage
- **Dietary M09:** Allergen/dietary flags sync, restricted item checks
- **Notifications:** Low wallet, order ready, refund processed, stock reorder
- **Timetable:** Meal times, class-based pre-order windows
- **Reports M30:** Canteen KPIs in central analytics

## 10. Roles, Alerts & Reports – B10

**Permissions**
- `canteen.view` – read screens
- `canteen.manage` – full setup
- `canteen.menu` – menu, recipes, prices
- `canteen.orders` – orders, pre-orders
- `canteen.billing` – billing, wallets, day closing
- `canteen.inventory` – stock, purchase, wastage
- `canteen.reports` – reports and exports
- `canteen.audit` – audit and retention

**Alerts**
- Wallet low / daily limit near
- Stock below reorder
- Allergen warning on sale attempt
- Refund pending approval
- Day close not performed

**Reports**
- Daily sales and cash tally
- Item-wise sales and profit
- Stock movement and wastage
- Wallet usage and top-ups
- Pre-order vs actual sales
- Allergen exposure log

## 11. Scenario Coverage – B11

- Duplicate order/payment callback handled via idempotency
- Insufficient funds and daily limits enforced
- Allergen warning and restricted dietary information access control
- Reject unavailable stock; test refund rollback across wallet/stock/ledger
- Reconcile meal sales, stock, family balance and reports
- Price change effective dating
- Day closing locks edits
- Concurrent stock deduction resolves correctly

## 12. Build Plan – B12

1. **Menu** – Weekly menu runs without daily entry
2. **Orders** – Parent pre-order reaches kitchen list
3. **Billing** – Bill made in under 5 seconds and cash tallies
4. **Inventory** – Sales reduce stock automatically
5. **Reports & Hardening** – Compliance and profit reports ready
6. **Later optional** – Kitchen display, nutrition, supplier API

Deliverables: migrations, router `school_canteen.js`, frontend pages, menu entry, permissions.

## 13. Open Decisions – B13

- POS hardware integration scope: barcode scanner, printer
- Nutrition data source and per-item calculation
- Supplier API vs manual purchase entry
- Meal wallet vs school-wide student wallet unification
- Pre-order cutoff time per class/grade
- Kitchen display real-time queue priority
- Allergen data classification standard
- Cash handling multi-counter reconciliation

---
*Design aligns with M23 Canteen/Food Service and ERP master architecture. All tables tenant-scoped with RLS, auditable, and integrated with Fees, Inventory and Notifications.*
