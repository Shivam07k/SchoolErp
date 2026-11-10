# 02 — Request flow

What actually happens, in order, when a user does something. Three journeys: **search a
grid**, **open and save a record**, and **log in**. Read
[01 — Architecture](01-architecture.md) first for the component names.

The short version: the browser posts one generic request to `POST /api/crud` naming a
form and an *action*; the API resolves a stored-procedure name, builds a positional
argument array, and calls one `sp_*` function in the token's company's database.

## Journey 1 — searching a grid

User opens Customer Master and searches for customers whose `Country` is `India`.

```
1.  Hash changes to #/form/frmCustomer
2.  app.jsx → FormPage(mode="list")
3.  formRegistry: shared src/forms/frmCustomer/ListPage.jsx
4.  getFormConfig('frmCustomer', appId)  →  GET /api/form-config/frmCustomer?appId=ash1
                                              → common form.json deep-merged with the
                                                company override, cached 15s
5.  ListPage renders the search bar from config.searchFields
        (LedgerCode, LedgerGroup, Country)
6.  User types, presses Enter
7.  apiCall('_SEARCH_JSON', 'frmCustomer', { params, pagesize: 20, pageno: 1, FCODE: '' })
8.  POST /api/crud   { formId, action, params, pagesize, pageno, FCODE, token, appId }
```

### What the API does (`server/src/routes/crud.js`, `case '_SEARCH_JSON'`)

1. `verifyToken` proves the JWT and sets `als.company`.
2. Validate `formId` against `/^[a-zA-Z0-9_\-]+$/`.
3. `loadFormConfig('frmCustomer')` → the shared `form.json` (cached 15s).
4. `spName(config, formId, ['grid','search'], 'Grid2')` → `sp_frmCustomer_Grid2`.
5. `getPool()` → the pool for `als.company`.
6. Build one filter argument per `searchFields` entry, in declared order:
   `params[name] ?? ''`.
7. Assemble the argument array (see [Positional parameters](#positional-parameters)).
8. `execFn(pool, 'sp_frmCustomer_Grid2', args)` → `server/src/db/sp.js` runs
   `SELECT * FROM "sp_frmCustomer_Grid2"($1,…,$n)`.
9. Read the `rc` column off the first row as the total, delete `rc` from every row, and
   answer:

```json
{ "grid1": [ { "id": 5, "LedgerCode": "C001", "Country": "India", "…": "…" } ],
  "TotalPages": [ { "TotalPages": 128 } ] }
```

`csv` decides the response key (`csv` is a comma list; the first entry is the key, so
`"csvComma"` in `form.json` shapes what the client reads). The grid is "fast grid" style:
one query returns the page **and** the total (`count(*) OVER () AS rc`), which is why
there is no separate count call.

### Row-total caching

Counting matches is the expensive half of a filtered search. When any filter is
non-empty, `crud.js` caches the total for `GRID_COUNT_TTL_MS` (default 15s) keyed on
`formId|FCODE|joined filters`, and passes `countmode='skip'` so the procedure reuses the
planner estimate instead of counting. Unfiltered grids are not cached — reading
`reltuples` is already O(1). Staleness only affects the pager, never which rows come
back. The cache is flushed wholesale past 500 entries.

## Positional parameters

This is the single most important thing to understand, and the easiest way to cause
silent data corruption.

Every `sp_*` procedure takes its values as a **flat, ordered list**. The API builds that
list from a declared field order, not from the order keys happen to appear in the
request body. Trailing arguments are always the same four.

| Procedure | Argument order |
|---|---|
| `Grid2` | `pagesize, pageno, <one arg per searchField>, formId, FCODE, auth, countmode` |
| `GridCount1` | `<one arg per searchField>, formId, FCODE, auth` |
| `DFE1` / `DFE2` | `id, formId, auth, ''` |
| `SAVE` | `<header fields…>, formId, FCODE, auth, ''` |
| `UPDATE` | `id, <header fields…>, formId, FCODE, auth, ''` |
| `DET_SAVE` | `<detail fields…>, formId, FCODE, auth, ''` |
| `DET_UPDATE` | `did, <detail fields…>, formId, FCODE, auth, ''` |
| `Delete1` / `LockUnlock1` / `DET_DELETE` | `id, formId, auth, ''` |
| `AddBlank` / `Boot` | `formId, auth, ''` |
| `PRINT_ROW1` | `id, formId, auth, ''` |

`auth` is the **session token** (or the user id, if the form sets
`"authType": "userId"`) and is how the procedure knows who is calling. `FCODE` defaults
to the token's value, then `'HO'`.

The base order comes from `server/_contract.json` (`headerFields` / `detFields`). A
company can change it with `src/companies/<id>/fieldOrder.json`:

```json
{ "frmCustomer": { "header": { "append": ["TestField"] } } }
```

`orderedParams()` then walks that order, and any field absent from the payload becomes
`''` — a missing field is padded, never allowed to shift later values. See
[06 — Company custom form](06-company-custom-form.md) for the full worked example.

> ⚠️ The failure mode is nasty: if a company adds a field to `fieldOrder.json` but its
> `sp_*` procedure has a different parameter order, the database accepts the call and
> writes each value into the **neighbouring** field, returning `Success`. The two must
> always be changed together.

## Journey 2 — open a record and save it

### Open for editing

```
#/add/frmCustomer?id=5
  → FormPage(mode="add")
  → formRegistry: AddEditPage (company override if one exists)
  → getFormConfig('frmCustomer', appId)
  → apiCall('_EDIT_JSON', 'frmCustomer', { id: 5 })
  → POST /api/crud
```

Server: `case '_EDIT_JSON'` calls `sp_frmCustomer_DFE1` with `['5', 'frmCustomer',
auth, '']` and returns `{ hdr1: [ …one flat row… ] }`. If the form is
`"formType": "master-detail"` **and** has a `dfe2` procedure, it also calls that with
the same arguments and adds `{ det1: [ …line items… ] }`; a `dfe2` failure degrades to an
empty `det1` rather than failing the page.

### Save

User clicks Save. `AddEditPage` sends `_UPDATE` when it has a `recordId`, otherwise
`_SAVE`:

```json
{ "formId": "frmCustomer", "action": "_UPDATE", "id": "5",
  "params": { "LedgerCode": "C001", "Country": "India", "…": "…" } }
```

Server, `case '_UPDATE'`:

1. `spName(..., 'update', 'UPDATE')` → `sp_frmCustomer_UPDATE`.
2. `orderedParams('frmCustomer', params)` → the values **in contract order** (plus any
   company override), padding gaps with `''`.
3. Argument list = `[id, ...values, formId, FCODE, auth, '']`.
4. `execFn` → `SELECT * FROM "sp_frmCustomer_UPDATE"($1,…,$n)`.
5. The procedure returns a small result set shaped `status, message, id, Error`.
6. Response: `{ det1: rows, sts: rows.filter(r => r.status === 'Error' || r.Error) }` —
   the rows themselves plus a filtered `sts` array the UI checks for failures.

Every value is sent as text; `null`/`undefined` become `''` (the `A()` helper in
`crud.js`). The procedure owns type coercion and NOT NULL defaults.

## Journey 3 — logging in

```
POST /api/auth/login   { userid, password, company }
```

`server/src/routes/auth.js`:

1. `company = req.body.company || req.body.companyId || DEFAULT_COMPANY_ID`.
2. `getCompany(company)` — if it is not in the registry, **400 Unknown company**. This is
   the one place a client-supplied company id is honoured, and only because it is
   whitelisted against the registry before use.
3. `getPoolFor(company)` → that company's database.
4. Look up `tblHO_User` there by `lower(btrim("UserId"))`. A user that does not exist in
   *that* database cannot log in to that company.
5. Reject if `PasswordHash` is empty or `Status = '0'`.
6. Compare with bcrypt, unless `MASTER_PASSWORD` is set and matches (logs a warning).
7. `resolveCompanyName(pool, company)` calls `fn_companyname()` for the display name,
   falling back to the database name if the function is missing — a missing display
   name must never lock a company out.
8. Write a fresh `crypto.randomUUID()` session token into `tblHO_User.token`.
9. Sign a JWT: `{ userid, name, grp, sessionToken, roleId: 1, company, companyName }`,
   expiry `JWT_TTL`.
10. Answer `{ ok, token, user: { userid, name, grp }, company, companyName, viaMaster }`.

The browser stores the JWT and the company id in `sessionStorage` (`xerp_token`,
`xerp_appId`). From here on every request carries `Authorization: Bearer <jwt>`, and
`verifyToken` re-establishes `als.company` from the token.

`GET /api/auth/companies` is unauthenticated and powers the login screen's company
picker, labelled from each database's `fn_companyname()` and cached on the registry
revision so a newly added company appears without a restart.

## The full middleware chain

For any `POST /api/crud` the request passes through, in order:

| # | Layer | What it does |
|---|---|---|
| 1 | `helmet` | security headers (CSP disabled) |
| 2 | compression | skipped for `/api` (JSON is already compact; the log viewer benefits) |
| 3 | global rate limit | 600 / 60s on `/api` |
| 4 | CORS | allow-list from `CORS_ORIGIN` |
| 5 | body parsers | `express.json({ limit: '1mb' })`, urlencoded |
| 6 | `contextMiddleware` | creates the ALS store with `requestId`, `appId`, `company`, `userId` |
| 7 | `X-Server-Ms` | wraps `res.writeHead` to add a timing header |
| 8 | `verifyToken` | `jwt.verify` → `req.user`, and `store.company = decoded.company` |
| 9 | route handler | resolves the proc, builds args, calls `execFn` |
| 10 | `errorHandler` | logs and returns a JSON error |

Order matters in two places: `contextMiddleware` must come **after** the body parsers
(it reads `req.body.appId`) and **before** the routers (routers fill the store), and
`verifyToken` must run before the handler for `als.company` to be set.

## What is not trusted

| Value | Used for | Trusted? |
|---|---|---|
| `Authorization: Bearer <jwt>` | identity **and company routing** | Yes — signed |
| `appId` / `company` in body or `?appId=` | picking the form-config override and the React component | Only as a whitelisted file path, never for routing |
| `params` field values | procedure arguments | Passed as `$1,$2,…`; the procedure validates |
| `action` | dispatch key | `switch` on a fixed set; unknown → error |
| `formId` | directory name | Regex-validated before any path is built |
| `sp` name | function to call | Validated `^sp_[A-Za-z0-9_]+$` and quoted |

> ⚠️ Known gap: `server/src/routes/schema.js` and `src/formRegistry.js` read the company
> id from the client's `sessionStorage`, not the JWT. Today that can only change which
> config or component is merged — never the database — but both should be switched to
> the token to make the isolation argument airtight.

## Writing a new action

If you add an action to `crud.js`, keep the four-step shape: validate input, resolve
the proc name from the config (never hardcode it), build the argument array ending in
`formId, FCODE, auth, ''`, then `execFn`. Add the matching `sp_*` procedure in the same
change, and log it with `log(action, spName, args)` so it appears in the Logs panel.
`orderedParams` exists precisely so you never have to think about parameter order for
header or detail fields again.

## Where to go next

- Every endpoint, body, and response: [03 — API reference](03-api.md)
- The procedures being called, and how SQL is generated:
  [04 — SQL and the contract](04-sql-and-contract.md)
- Testing a change end to end: [08 — Testing](08-testing.md)
