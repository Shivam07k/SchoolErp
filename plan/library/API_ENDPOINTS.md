# Library — API Endpoints

All endpoints are under `/api/school/library`. The router is mounted in
`server/src/index.js` **before** `schoolCompRouter` so the richer library
handlers are not shadowed by the legacy module.

Authentication: `Authorization: Bearer <token>`. Tenant scope comes from
`req.school.appId`.

---

## Permissions

| Permission | Used for |
|---|---|
| `library.view` | All GET endpoints |
| `library.manage` | Superset for all write endpoints |
| `library.catalog` | Titles, authors, categories, publishers, copies, racks |
| `library.members` | Member CRUD and history |
| `library.issue` | Issue, return, renew, reservations |
| `library.fines` | Fines creation, payment, adjustments |
| `library.reports` | Reports |
| `library.audit` | Audit and retention |

---

## Dashboard

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/dashboard` | view | Overview: total titles, copies, issued, overdue, reservations, fines |

---

## Catalog — Titles / Copies / Racks

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/titles` | view | List titles with filters |
| POST | `/titles` | catalog | Create title |
| GET | `/titles/:id` | view | Title detail |
| PUT | `/titles/:id` | catalog | Update title |
| DELETE | `/titles/:id` | catalog | Soft-delete title |
| GET | `/titles/:id/copies` | view | Copies for title |
| POST | `/copies` | catalog | Add copy with barcode/rack |
| GET | `/copies` | view | List copies with status |
| GET | `/copies/:id` | view | Copy detail |
| PUT | `/copies/:id` | catalog | Update copy status/location |
| DELETE | `/copies/:id` | catalog | Soft-delete copy |
| GET | `/racks` | view | List racks / shelves |
| POST | `/racks` | catalog | Create rack |
| GET | `/racks/:id` | view | Rack detail with copies |
| PUT | `/racks/:id` | catalog | Update rack |
| DELETE | `/racks/:id` | catalog | Soft-delete rack |
| GET | `/authors` | view | List authors |
| POST | `/authors` | catalog | Create author |
| GET | `/categories` | view | List categories |
| POST | `/categories` | catalog | Create category |
| GET | `/publishers` | view | List publishers |
| POST | `/publishers` | catalog | Create publisher |

---

## Members

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/members` | view | List members with filters |
| POST | `/members` | members | Create member |
| GET | `/members/:id` | view | Member detail |
| PUT | `/members/:id` | members | Update member |
| DELETE | `/members/:id` | members | Deactivate member |
| GET | `/members/:id/history` | view | Borrow/return history |
| GET | `/members/:id/current` | view | Active issues |

---

## Issue / Return / Renew

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/issues` | view | List active and past issues |
| POST | `/issues` | issue | Checkout / create issue |
| GET | `/issues/:id` | view | Issue detail |
| POST | `/issues/:id/return` | issue | Process return with fine calc |
| POST | `/issues/:id/renew` | issue | Renew issue if allowed |
| PUT | `/issues/:id` | manage | Update notes/late waiver |

### Hard rules enforced here

- One active issue per copy.
- Member must be active and within borrow limit.
- Copy must be `available`.
- Due date calculated from member category policy.
- Auto-fine on return if overdue.
- Renew blocked if reservation exists.

---

## Reservations

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reservations` | view | List reservations |
| POST | `/reservations` | issue | Create reservation |
| GET | `/reservations/:id` | view | Reservation detail |
| POST | `/reservations/:id/cancel` | issue | Cancel reservation |
| POST | `/reservations/:id/fulfill` | issue | Fulfill reservation to issue |
| GET | `/reservations/queue/:copyId` | view | Queue for a copy |

---

## Fines

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/fines` | view | List fines |
| POST | `/fines` | fines | Create manual fine |
| GET | `/fines/:id` | view | Fine detail |
| PUT | `/fines/:id` | fines | Adjust/waive fine |
| POST | `/fines/:id/pay` | fines | Record payment |
| GET | `/fines/summary` | view | Fines summary and dues |
| GET | `/members/:id/dues` | view | Member outstanding dues |

---

## Reports and Settings

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/reports/usage` | reports | Borrow/return usage by period |
| GET | `/reports/overdue` | reports | Overdue items list |
| GET | `/reports/popular` | reports | Most borrowed titles |
| GET | `/reports/members` | reports | Member activity summary |
| GET | `/reports/fines` | reports | Fines collection summary |
| GET | `/reports/inventory` | reports | Copies by status/rack |
| GET | `/settings` | view | Library policy settings |
| PUT | `/settings` | manage | Update policy settings |

### Default policy settings

| Key | Default |
|---|---|
| `borrow_limit_student` | `5` |
| `borrow_limit_staff` | `10` |
| `loan_days_student` | `14` |
| `loan_days_staff` | `30` |
| `renew_limit` | `2` |
| `fine_per_day` | `1` |
| `max_reservation_days` | `7` |
| `require_member_card` | `true` |
