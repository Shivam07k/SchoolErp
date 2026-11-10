# Canteen — API Endpoints

All endpoints are under `/api/school/canteen`. The router is mounted in
`server/src/index.js` before `schoolCompRouter` so the richer canteen handlers are not shadowed by the legacy module.

Authentication: `Authorization: Bearer <token>`. Tenant scope comes from
`req.school.appId`.

---

## Permissions

| Permission | Used for |
|---|---|
| `canteen.view` | All GET endpoints |
| `canteen.manage` | Superset for all write endpoints |
| `canteen.menu` | Menu items, menu plan/override, recipes |
| `canteen.orders` | Orders, bulk orders, subscriptions |
| `canteen.billing` | Bills, wallet, payments, day closing |
| `canteen.inventory` | Stock items, purchases, stock movements, suppliers |
| `canteen.reports` | Reports |
| `canteen.audit` | Audit and retention |

---

## Dashboard

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/dashboard` | canteen.view | Sales today, pending orders, low stock alerts, wallet top-ups |

---

## Menu — Items, Plan, Recipes

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/menu-items` | canteen.view | List menu items with availability |
| POST | `/menu-items` | canteen.menu | Create menu item |
| GET | `/menu-items/:id` | canteen.view | Menu item detail |
| PUT | `/menu-items/:id` | canteen.menu | Update menu item |
| DELETE | `/menu-items/:id` | canteen.menu | Soft-delete menu item |
| GET | `/categories` | canteen.view | List item categories |
| POST | `/categories` | canteen.menu | Create category |
| GET | `/menu-plan` | canteen.view | List menu plan by date/meal/hall |
| POST | `/menu-plan` | canteen.menu | Create plan entry |
| GET | `/menu-plan/:id` | canteen.view | Plan entry detail |
| PUT | `/menu-plan/:id` | canteen.menu | Update plan entry |
| DELETE | `/menu-plan/:id` | canteen.menu | Delete plan entry |
| POST | `/menu-plan/:id/override` | canteen.menu | Override plan for specific date |
| GET | `/menu-plan/today` | canteen.view | Today's menu |
| GET | `/recipes` | canteen.view | List recipes |
| POST | `/recipes` | canteen.menu | Create recipe |
| GET | `/recipes/:id` | canteen.view | Recipe detail with cost |
| PUT | `/recipes/:id` | canteen.menu | Update recipe |
| DELETE | `/recipes/:id` | canteen.menu | Delete recipe |
| POST | `/recipes/:id/cost/recalculate` | canteen.menu | Recalculate cost from stock |

---

## Orders — Individual, Bulk, Subscriptions

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/orders` | canteen.view | List orders with filters |
| POST | `/orders` | canteen.orders | Place order |
| GET | `/orders/:id` | canteen.view | Order detail |
| PUT | `/orders/:id` | canteen.orders | Update order before preparation |
| POST | `/orders/:id/cancel` | canteen.orders | Cancel order |
| POST | `/orders/:id/prepare` | canteen.orders | Mark preparing |
| POST | `/orders/:id/serve` | canteen.orders | Mark served |
| POST | `/orders/:id/complete` | canteen.orders | Complete and bill |
| GET | `/bulk-orders` | canteen.view | List bulk orders |
| POST | `/bulk-orders` | canteen.orders | Create bulk order |
| GET | `/bulk-orders/:id` | canteen.view | Bulk order detail |
| PUT | `/bulk-orders/:id` | canteen.orders | Update bulk order |
| POST | `/bulk-orders/:id/items` | canteen.orders | Add/update items |
| POST | `/bulk-orders/:id/confirm` | canteen.orders | Confirm bulk order |
| GET | `/subscriptions` | canteen.view | List meal subscriptions |
| POST | `/subscriptions` | canteen.orders | Create subscription |
| GET | `/subscriptions/:id` | canteen.view | Subscription detail |
| PUT | `/subscriptions/:id` | canteen.orders | Update subscription |
| DELETE | `/subscriptions/:id` | canteen.orders | Cancel subscription |
| POST | `/subscriptions/:id/pause` | canteen.orders | Pause subscription |
| POST | `/subscriptions/:id/resume` | canteen.orders | Resume subscription |
| GET | `/subscriptions/:id/preview` | canteen.view | Preview charges |

---

## Billing — Bills, Wallet, Payments, Day Closing

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/bills` | canteen.view | Bill register |
| GET | `/bills/:id` | canteen.view | Bill detail |
| POST | `/bills` | canteen.billing | Generate bill from orders |
| POST | `/bills/:id/post` | canteen.billing | Post bill |
| POST | `/bills/:id/cancel` | canteen.billing | Cancel bill |
| GET | `/wallets` | canteen.view | List wallets |
| GET | `/wallets/:studentId` | canteen.view | Wallet summary |
| GET | `/wallets/:studentId/transactions` | canteen.view | Transaction history |
| POST | `/wallets/:studentId/credit` | canteen.billing | Credit wallet |
| POST | `/wallets/:studentId/debit` | canteen.billing | Debit wallet |
| PUT | `/wallets/:studentId/limit` | canteen.billing | Update wallet limit |
| GET | `/payments` | canteen.view | List payments |
| POST | `/payments` | canteen.billing | Record payment |
| PUT | `/payments/:id` | canteen.billing | Update payment |
| GET | `/payments/:id/receipt` | canteen.view | Receipt |
| GET | `/day-closing` | canteen.view | List closed days |
| GET | `/day-closing/:date` | canteen.view | Day closing summary |
| POST | `/day-closing` | canteen.billing | Close day |
| POST | `/day-closing/:date/reopen` | canteen.billing | Reopen day |

---

## Inventory — Stock, Purchases, Movements, Suppliers

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/stock-items` | canteen.view | List stock items |
| POST | `/stock-items` | canteen.inventory | Create stock item |
| GET | `/stock-items/:id` | canteen.view | Stock item detail |
| PUT | `/stock-items/:id` | canteen.inventory | Update stock item |
| DELETE | `/stock-items/:id` | canteen.inventory | Soft-delete stock item |
| GET | `/stock-items/:id/balance` | canteen.view | Current balance |
| GET | `/stock-items/low-stock` | canteen.view | Low stock alerts |
| GET | `/purchases` | canteen.view | Purchase orders |
| POST | `/purchases` | canteen.inventory | Create purchase order |
| GET | `/purchases/:id` | canteen.view | PO detail |
| PUT | `/purchases/:id` | canteen.inventory | Update PO |
| POST | `/purchases/:id/receive` | canteen.inventory | Receive goods and create stock movement |
| GET | `/stock-movements` | canteen.view | List stock movements |
| POST | `/stock-movements` | canteen.inventory | Manual adjustment/journal |
| GET | `/stock-movements/:id` | canteen.view | Movement detail |
| GET | `/suppliers` | canteen.view | List suppliers |
| POST | `/suppliers` | canteen.inventory | Create supplier |
| PUT | `/suppliers/:id` | canteen.inventory | Update supplier |
| DELETE | `/suppliers/:id` | canteen.inventory | Delete supplier |

---

## Documents

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/documents` | canteen.view | List documents |
| POST | `/documents` | canteen.manage | Upload document |
| DELETE | `/documents/:id` | canteen.manage | Delete document |

---

## Reports and Settings

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/sales` | canteen.reports | Sales report by period/hall |
| GET | `/reports/inventory` | canteen.reports | Inventory valuation and usage |
| GET | `/reports/wallet` | canteen.reports | Wallet summary and top-ups |
| GET | `/reports/orders` | canteen.reports | Order trends and items |
| GET | `/settings` | canteen.view | Canteen policy settings |
| PUT | `/settings` | canteen.manage | Update policy settings |

### Hard rules enforced here

- Stock balance cannot go negative on issue; warnings for low stock.
- Order total must be > 0 and items must be available on the menu plan for the date/meal.
- Wallet debit requires sufficient balance when cashless mode is enforced.
- Day closing locks orders, bills and stock movements for that date.
- Subscription auto-billing skips paused or inactive subscriptions.
