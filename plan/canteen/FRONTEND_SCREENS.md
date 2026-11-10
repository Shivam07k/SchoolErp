# Canteen — Frontend Screens

**Stack:** React + Bootstrap 5, using `PageShell`, `Loading`, `Empty`, `Badge`,
`downloadCsv`, `fmtDate`, `fmtCurrency` from `src/pages/school/fee/shared.jsx` and the
`apiGet/apiPost/apiPut/apiDelete` helpers.

All screens live in `src/pages/school/canteen/` and are dispatched from
`src/components/SchoolPage.jsx` when `module === 'canteen'`.

---

## Routes

| Route | Component | Menu label |
|---|---|---|
| `/school/canteen/menu` | `Menu.jsx` | Menu |
| `/school/canteen/orders` | `Orders.jsx` | Orders |
| `/school/canteen/billing` | `Billing.jsx` | Billing |
| `/school/canteen/inventory` | `Inventory.jsx` | Inventory |
| `/school/canteen/reports` | `Reports.jsx` | Reports |

`src/pages/school/canteen/shared.jsx` exports shared canteen helpers:
`canCanteenView`, `canCanteenManage`, `canCanteenMenu`, `canCanteenOrders`,
`canCanteenBilling`, `canCanteenInventory`, `TAB_BUTTON`, status tone maps,
`today`, `weekStart`, `weekEnd`, `studentName`, `money`, `Placeholder`, `KPIStrip`.

---

## 1. Menu (`Menu.jsx`)

Tabs: **Items**, **Weekly Plan**, **Overrides**, **Recipes**, **Combos**.

- KPI strip: active items, categories, items in weekly plan, items with low stock, allergen flagged items.
- **Items**: master CRUD for canteen items. Fields: item_code, name, category, unit, description, price effective dates, allergen_tags[], dietary_tags[], recipe_id, is_active, parent blocked flag. Search, filter by category/allergen, bulk activate/deactivate.
- **Weekly Plan**: 7-day grid by meal_type. Drag-drop assign items to day/meal, set price per item, effective_from/to. Preview stock availability per day based on recipe consumption. Save plan per week_start_date.
- **Overrides / Daily Menu**: publish/unpublish daily menu generated from weekly plan. Availability override, available_qty, price override, out-of-stock flag. Daily menu table with publish toggle and stock preview.
- **Recipes**: item → stock ingredients mapping. `qty_per_unit` and UOM per stock item. Recipe cost auto-calc from stock purchase price. Effective dating for recipe changes.
- **Combos**: bundle of items with combo price, validity, discount auto-calc. Combo eligibility check against allergens and stock.

UI components: `KPIStrip`, `TAB_BUTTON`, table with inline edit, drawer for item/recipe detail, date picker, week grid, badge for allergen/dietary tags.

Permission: `canteen.view`; writes require `canteen.menu` or `canteen.manage`.

---

## 2. Orders (`Orders.jsx`)

Tabs: **Counter**, **Pre-order List**, **Bulk**, **Subscription**, **Token Pickup**.

- **Counter / POS**: student search by admission no/name/QR, class filter. Item list filtered by daily menu and stock. Quantity stepper, allergen guard warning, wallet balance & daily limit check, mixed payment toggle. Atomic commit → order + wallet debit + stock deduction + bill. Receipt print preview.
- **Pre-order List**: orders for future date(s). Filters by date, class, status. Pre-order window enforcement. Approve/confirm pre-orders, kitchen prep list view aggregated by item. Student cancellation within window.
- **Bulk**: class/section bulk entry for trips/events. Select class → select items → quantity per student or total. Preview cost and wallet sufficiency, batch create orders.
- **Subscription**: recurring meal plans per student. Define days/meals, validity period, auto-deduct from wallet daily. Status: active/paused/expired. Renewal and pause controls.
- **Token Pickup**: token / order slip generation for pre-orders and POS. Search by token no/student, status: placed/confirmed/served/refunded. Serve confirmation updates stock consumption.

UI components: `PageShell` with quick search bar, item grid with category tabs, cart drawer, wallet balance pill, badge for order status, token printer modal.

Permission: `canteen.view`; writes require `canteen.orders` or `canteen.manage`.

---

## 3. Billing (`Billing.jsx`)

Tabs: **Counter Screen**, **Wallet Top-up**, **Refund**, **Day Closing**.

- **Counter Screen**: open bills list for current shift/counter. Filter by payment mode, status, student. Quick search, bill detail drawer with items, taxes, discounts, payment split, receipt reprint.
- **Wallet Top-up**: top-up ledger. Student selector, amount, payment mode, reference no. Balance after update, daily limit edit, parent blocked items toggle. Transaction history table with CSV export.
- **Refund**: refund request list. Select bill → reason mandatory, amount partial/full, approver check. Approval triggers reversal of wallet, stock and ledger with audit log. Refund status: pending/approved/reversed.
- **Day Closing**: day close workflow per canteen/counter. Summary: bills count, cash/card/wallet totals, pending bills. Validation for open bills. Generate cash tally, lock day. After close, bills immutable; reopen requires `canteen.audit`.

UI components: `KPIStrip` with cash, wallet, card totals; bill table with status badges; refund modal with reason picker; day close summary modal with lock confirmation.

Permission: `canteen.view`; writes require `canteen.billing` or `canteen.manage`. Day close requires `canteen.billing`.

---

## 4. Inventory (`Inventory.jsx`)

Tabs: **Stock List**, **Purchase Entry**, **Consumption**, **Wastage**, **Supplier**, **Documents**.

- **Stock List**: stock items master with current_qty, reorder_level, unit, unit cost. Low stock highlights, stock movement history drawer. Opening balance entry.
- **Purchase Entry**: purchase order/register. Supplier selection, PO no, received date, items with qty and rate. Receipt creates stock movements of type `purchase`. Attach GRN documents.
- **Consumption**: auto from sales via recipes. Manual consumption entry for kitchen prep, event use, with reference to order/menu. Stock deduction preview.
- **Wastage**: wastage entry per stock item, reason, qty, date, approved_by. Wastage report highlights high wastage items.
- **Supplier**: supplier master with contact, GSTIN, bank details, documents expiry. Supplier-wise purchase history.
- **Documents**: GRN, invoices, compliance docs per purchase. Upload/view, expiry alerts.

UI components: stock table with reorder badge, purchase entry form with dynamic rows, movement timeline drawer, supplier card list, document viewer.

Permission: `canteen.view`; writes require `canteen.inventory` or `canteen.manage`.

---

## 5. Reports (`Reports.jsx`)

Report cards with date range, canteen/counter filters and CSV export:

- Daily sales and cash tally
- Item-wise sales, profit, and stock consumption
- Stock movement and wastage summary
- Wallet usage, top-ups, and low-balance alerts
- Pre-order vs actual sales variance
- Subscription utilization
- Allergen exposure log
- Refund and adjustment audit
- Day closing audit trail

Permission: `canteen.reports`; audit reports require `canteen.audit`.
