# Canteen & Food Service — Integration Points

---

## 1. Students master

| Source | Use |
|---|---|
| `school_students.id` | Wallet, orders, subscription identity |
| `first_name`, `last_name`, `admission_no` | Display and search |
| `class_id`, `section_id` | Pre-order windows, bulk orders, reports |
| `guardian_name`, `guardian_phone`, `guardian_email` | Wallet top-up notifications, consent |
| `status` | Only `active` students may order/top-up |
| `deleted_at` | Wallet disabled, orders blocked |
| `dietary_restrictions`, `allergies` | Allergen guard on menu items |

No student columns are modified. `school_canteen_wallet` is the source of truth for canteen balance. Dietary/allergen flags are read-only from student health profile.

**Tables involved**
- `school_students`
- `school_canteen_wallet`
- `school_canteen_order`
- `school_canteen_order_line`
- `school_canteen_subscription`

**Data flow**
- Student onboarding → wallet row created with `balance = 0`.
- Class change updates reporting but does not migrate wallet.
- Deactivation → wallet `is_active = false`, orders blocked.

**Events**
- `student.created` → provision wallet
- `student.updated` → sync display name/guardian
- `student.deactivated` → block wallet and orders
- `student.allergen_changed` → re-evaluate pending orders

---

## 2. Fees & Accounts

**Tables reused**
- `school_fee_head` (`type` = `canteen` or `wallet_topup`)
- `school_invoice`, `school_invoice_line`
- `school_receipt`, `school_receipt_allocation`
- `school_ledger_entry`, `school_ledger_account`
- `school_concession_type`, `school_fine_rule`

**Behaviour**
- Wallet top-up is recorded as a fee invoice of type `wallet_topup` and settled via normal receipt.
- Daily canteen sales are aggregated to a summary invoice/ledger entry for accounting.
- Refunds create a credit note / negative receipt linked to the original bill.
- Because canteen bills reuse the fee/ledger engine, Collection, Dues, Refunds and Reports work unchanged.

**Accounting entries**

*Wallet top-up*
- Debit `Cash/Bank`  → Credit `Canteen Wallet Liability`
- `school_canteen_wallet_entry` type = `credit`

*Wallet spend / sale*
- Debit `Canteen Income` → Credit `Canteen Wallet Liability`
- `school_canteen_wallet_entry` type = `debit`
- Bill `payment_mode = wallet`

*Cash/Card sale*
- Debit `Cash/Bank` → Credit `Canteen Income`
- `school_canteen_payment` created

*Refund*
- Reverse original entries: Debit `Canteen Wallet Liability` / `Cash` → Credit `Canteen Income` and Debit `Canteen Wallet Liability`
- `school_canteen_refunds` records reversal status and approver

*Purchase*
- Debit `Inventory Stock` → Credit `Accounts Payable` / `Cash`
- `school_canteen_purchase` + `school_canteen_stock_movement` type `purchase`

*Consumption*
- Debit `Cost of Goods Sold` → Credit `Inventory Stock`
- Triggered on order serve via recipe, `school_canteen_stock_movement` type `consumption`

*Wastage*
- Debit `Wastage Expense` → Credit `Inventory Stock`
- `school_canteen_stock_movement` type `wastage` with reason

Fee heads `Canteen Wallet Top-up`, `Canteen Sales Income`, `Canteen COGS`, `Canteen Wastage` are created on demand if missing.

---

## 3. Inventory & Stock

**Tables involved**
- `school_canteen_stock_item`
- `school_canteen_stock_movement`
- `school_canteen_purchase`
- `school_canteen_supplier`
- `school_canteen_recipe`
- `school_canteen_menu_item`
- `school_canteen_order`
- `school_canteen_order_line`

**Data flow**
- Purchase receipt → `school_canteen_purchase` status `received` → `school_canteen_stock_movement` type `purchase` → `current_qty` updated.
- Order serve → recipe explosion → per stock item consumption → `school_canteen_stock_movement` type `consumption` → `current_qty` decremented.
- Wastage entry → `school_canteen_stock_movement` type `wastage`.
- Adjustment → `school_canteen_stock_movement` type `adjustment` with audit reason.

**Events**
- `stock.reorder_threshold_breached` → notification
- `purchase.received` → stock increase
- `order.served` → stock decrease
- `wastage.logged` → expense posted

The canteen stock is module-scoped. If Inventory M19 is enabled, `school_canteen_stock_item` can be mapped to `school_inventory_item` via `stock_code` for consolidated reporting.

---

## 4. HR & Payroll

**Tables involved**
- `school_staff`
- `school_canteen_staff`
- `school_hostel_duty` pattern reused for canteen duty roster if required

**Behaviour**
- `school_canteen_staff.staff_id` references `school_staff(id)`.
- Canteen roles, counters and kitchen staff are assigned via `school_canteen_staff.role`.
- Duty roster and shift logs reference staff; leave is handled in HR.
- Payroll is unchanged; canteen staff salary flows through existing payroll run.
- Approvals for refunds, stock adjustments and day closing require staff with `canteen.*` permissions.

No HR columns are modified by canteen.

---

## 5. Timetable & Calendar

**Tables involved**
- `school_calendar_event`
- `school_timetable`
- `school_canteen_menu_plan`
- `school_canteen_menu_override`
- `school_canteen_daily_menu`

**Data flow**
- `school_calendar_event` vacations/holidays close canteen service for dates.
- `school_timetable` meal periods inform pre-order windows and POS service hours.
- Weekly menu plan is published to daily menu; overrides can be created for holidays/events.
- Day closing dates align with academic calendar periods.

**Events**
- `calendar.holiday_created` → auto-disable daily menu for date
- `timetable.meal_time_changed` → update service window
- `menu.plan_published` → generate `school_canteen_daily_menu`

---

## 6. Notifications

**Tables involved**
- `school_canteen_notification`
- `school_notification` / communication automation engine

**Behaviour**
- `school_canteen_notification` stores canteen alerts: low wallet, daily limit near, order ready, refund processed, stock reorder, allergen warning blocked.
- Delivery reuses existing communication/automation infrastructure.
- Parent alerts are sent on wallet top-up confirmation, low balance, and refund completion.

**Events**
- `wallet.low_balance`
- `wallet.daily_limit_near`
- `order.placed`, `order.served`
- `refund.approved`
- `stock.reorder`
- `allergen.blocked`

The UI surfaces alerts in Canteen screens; no external gateway is required for first release.

---

## 7. Audit

- Every sensitive action calls `writeAudit` from `server/src/school/foundation.js`.
- Audited actions: price change, menu publish, order create/cancel, wallet credit/debit, refund approval, stock movement, purchase receipt, day closing, role changes.
- Stock movements and wallet entries are immutable rows; corrections create reversal entries with audit trail.

---

## 8. Privacy and retention

- Wallet balances and order history are tenant-scoped with RLS.
- Allergen/dietary data is read-only and access-controlled to authorized staff.
- Retention settings can be stored in `school_canteen_setting`; cleanup job is out of scope for Phase 1.
- Photos/documents referenced by URL only; module does not store binary data.
