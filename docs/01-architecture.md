# 01 — Architecture

How the whole system is put together. Read [README](README.md) first, then this, then
[Request flow](02-request-flow.md) for the step-by-step version of a single request.

## The shape of it

```
┌──────────────────────────┐        ┌──────────────────────────┐        ┌──────────────┐
│  Browser (React/Vite)    │  HTTP  │  Express API             │  pg    │  PostgreSQL  │
│  :5173                   │ ─────► │  :3100                    │ ─────► │  xerp        │
│                          │  /api  │                           │        │  ash1        │
│  src/app.jsx             │        │  src/routes/crud.js      │  sp_*  │  mumbai ...  │
│  src/formRegistry.js     │        │  src/db/pool.js           │        │  (one DB per │
│  src/forms/ + companies/ │        │  src/db/sp.js             │        │   company)   │
└──────────────────────────┘        └──────────────────────────┘        └──────────────┘
                                          ▲
                                    server/config/companies.json
                                    (the company registry — the only
                                     place a company is defined)
```

Two Node processes, one database **per company**:

- **Browser app** — Vite dev server on `:5173`. It proxies `/api` to the API, so the
  browser only ever talks to `:5173`. Routing is hash-based (`#/dashboard`,
  `#/form/frmCustomer`, `#/add/frmCustomer?id=5`, `#/print/frmCustomer?id=5`).
- **API** — Express on `:3100`. It is deliberately thin. It authenticates, works out
  which company the request belongs to, resolves a stored-procedure name, calls it
  with positional arguments, and returns rows. **No business logic lives in the API.**

The important consequence: adding a company means adding a database and one registry
entry. The API code does not change. See [Add a company](05-add-a-company.md).

## The company model

A *company* is one PostgreSQL database. The company's `id` **is** its database name.
That single rule removes an entire category of bug, because there is never a question
of "which database should this request hit" — it is derived from the id.

The registry is one JSON file: `server/config/companies.json`.

```json
{
  "default": "xerp",
  "companies": [
    { "id": "xerp", "label": "XERP (HO)" },
    { "id": "ash1", "label": "Ash1" }
  ]
}
```

- `id` — also the database name. Also the folder name under `src/companies/`.
- `label` — what the UI shows.
- `default` — used when nothing else specifies a company.

A company entry can also override the connection, for a database on another server:

```json
{ "id": "mumbai", "label": "Mumbai Branch", "host": "10.0.0.9", "user": "mumbai_app", "passwordEnv": "MUMBAI_PG_PASSWORD" }
```

Recognised keys: `host`, `port`, `user`, `password`, `passwordEnv`, `database`, `max`,
`url`, `ssl`. Anything omitted falls back to the shared `PG_*` environment
variables, and `database` defaults to `id`. Full key reference:
`server/config/companies.README.md`.

### Company routing

This is the part worth memorising. Routing to a database is driven **only** by the
signed JWT, never by a value the browser sends.

```
Login ──►  POST /api/auth/login { userid, password, company }
                 │
                 ├─ looks up `company` in companies.json (whitelisted; unknown → 400)
                 ├─ getPoolFor(company)  ── that company's database
                 ├─ reads tblHO_User in THAT database, checks the bcrypt hash
                 └─ signs a JWT containing { userid, ..., company, companyName }
                                    │
                                    ▼
Every later request ──►  verifyToken
                 ├─ jwt.verify(token)                 ← proves who and which company
                 ├─ req.user = decoded
                 └─ als.getStore().company = decoded.company
                                    │
                                    ▼
                       getPool()  ──►  getCompanyDb(als.company)  ──► pg.Pool
```

The company travels on an `AsyncLocalStorage` store created per request
(`server/src/logging/als.js`), so `getPool()` with no arguments still knows which
company it is serving. That is why a route handler never has to pass a company around.

> ⚠️ Two things are *not* the routing authority, and one of them is a known gap:
> - The `appId`/`company` field in a request body or the `appId` query string is used
>   to pick a *form config override* and a *React component* (see below). It selects
>   presentation, not the database.
> - `server/src/routes/schema.js` (`/api/form-config/:formId?appId=…`) and
>   `src/formRegistry.js` take the company id from the client's `sessionStorage`
>   rather than the JWT. Today they only ever pick which files/config to merge, but
>   they should be switched to the token to close the gap. See
>   [Request flow](02-request-flow.md#what-is-not-trusted).

### Registry hot-reload

`server/src/config/companies.js` re-reads `companies.json` whenever its mtime changes
(an `fs.statSync` on the hot path, which is cheap). Editing the file therefore takes
effect on the next request with no restart. It is resilient on purpose: a missing file,
invalid JSON, a bad entry, or a duplicate id each log a warning and fall back to a
single company built from the environment, so a typo can never stop the server booting.

The same file drives the login screen's company list (`GET /api/auth/companies`), which
labels each entry with `fn_companyname()` from that company's own database if it defines
one (`sql/04_companyname.sql`).

## Shared vs company overrides

Every layer has the same two-tier shape: a shared version, and an optional per-company
override that wins and may be partial.

| Layer | Shared | Company override | How the override wins |
|---|---|---|---|
| Form component | `src/forms/<formId>/*.jsx` | `src/companies/<id>/forms/<formId>/*.jsx` | `src/formRegistry.js` looks in the company folder first, then the shared folder. An override is a whole component replacement. |
| Form config | `src/forms/<formId>/form.json` | `src/companies/<id>/forms/<formId>/form.json` | `GET /api/form-config/:formId?appId=<id>` deep-merges the company file over the shared file. Arrays of `{name,…}` merge by name; other arrays are replaced wholesale. |
| Stored-procedure argument order | `server/_contract.json` `headerFields` / `detFields` | `src/companies/<id>/fieldOrder.json` | `server/src/routes/crud.js` reads the company file, keyed on the same company id `getPool()` uses. Supports `replace`, `prepend`, `append` per form and per kind (`header`/`det`). |
| Extra columns / procedures | `sql/*.sql` (installed into every company DB) | `src/companies/<id>/sql/*.sql` | `node server/_migrate.mjs <id>` applies only to that company's database, tracked by file hash in `company_migration`. |

A company folder looks like this (the `ash1` example that is really in the repo):

```
src/companies/ash1/
├─ README.md                       hand-written notes for the next developer
├─ fieldOrder.json                 where company-specific fields go in the argument list
├─ sql/
│  └─ 01_frmcustomer_testfield.sql ADD COLUMN + the 3 matching sp_* procedures
└─ forms/frmCustomer/
   ├─ form.json                    a full copy (was edited; a partial one would be better)
   ├─ ListPage.jsx
   ├─ AddEditPage.jsx              the real edit: an extra "Test Field" input
   └─ PrintPage.jsx
```

Anything a company does not override falls through to the shared version, so a company
folder is always optional and always incremental.

## The API layer

`server/src/index.js` mounts everything. Order matters:

1. `helmet` (CSP disabled for now), `compression` (skipped for `/api`).
2. Global rate limit on `/api` — 600 requests / 60s.
3. Login rate limit on `/api/auth/login` — 10 / 15 min.
4. CORS allow-list.
5. Body parsers (`express.json`, 1 MB limit).
6. `contextMiddleware` — creates the AsyncLocalStorage store. **Must be after the body
   parsers** (it reads `req.body.appId`) and before the routers.
7. An `X-Server-Ms` timing header, injected by wrapping `res.writeHead`.
8. Static files (`dist` in production, `public` in dev) and `/uploads`.
9. Routers (see [API reference](03-api.md)).
10. `errorHandler`.

`CLUSTER_WORKERS` optionally runs the API in `node:cluster`: unset/`1` = single process
(the sane default on a LAN), `0` = one worker per CPU, `N` = exactly N. Budget
`workers × PG_MAX` against the server's `max_connections` or workers will fail to get a
connection before the database is actually busy.

### Routing tables

| File | Mounted at | Purpose |
|---|---|---|
| `server/src/routes/auth.js` | `/api/auth` | login, `/me`, company list |
| `server/src/routes/crud.js` | `/api/crud` | the one endpoint every form action goes through |
| `server/src/routes/schema.js` | `/api/schema` **and** `/api/form-config` | form configs (shared + company merge) |
| `server/src/routes/menu.js` | `/api` | menu tree, dashboard stats, table/column introspection |
| `server/src/routes/logs.js` | `/api` | activity log viewer |
| `server/src/routes/security.js` | `/api/security` | users, departments, groups, menu links, scopes, permissions, companies |
| `server/src/routes/customfields.js` | `/api/customfields` | per-company custom-field catalog and values |

### The one endpoint that matters: `POST /api/crud`

Every form action in the app is the same request shape, differing only by `action`:

```json
{ "formId": "frmCustomer", "action": "_SEARCH_JSON", "params": { ... }, "pagesize": 20, "pageno": 1 }
```

`crud.js` then:

1. Validates `formId` against `/^[a-zA-Z0-9_\-]+$/`.
2. Loads the form's config (`form.json`, else `schema.json`).
3. Resolves the stored-procedure name from the config, falling back to
   `sp_<formId>_<Action>` (e.g. `sp_frmCustomer_SAVE`).
4. Gets the pool for the token's company.
5. Builds the positional argument array, ending in the four trailing arguments
   `formId, FCODE, auth, ''`.
6. Calls it through `server/src/db/sp.js` and returns the rows.

Actions: `_BOOT`, `_SEARCH_JSON`, `_EDIT_JSON`, `_SAVE`, `_UPDATE`, `_PRINT_ROW`,
`_EXEC_SP`, `_DET_SAVE`, `_DET_UPDATE`, `_DET_DELETE`, `_DELETE` / `_DELETE_ROW`,
`_LOCK`, `_ADD_BLANK`. Details in [API reference](03-api.md) and
[Request flow](02-request-flow.md).

## The database layer

### One engine, parameterized, always quoted

`server/src/db/sp.js` is the only thing that talks SQL. Two rules:

- **Everything is parameterized.** `SELECT * FROM "sp_frmCustomer_SAVE"($1,$2,…)`.
  No value is ever concatenated into SQL text.
- **The function name is quoted.** PostgreSQL folds an unquoted identifier to lower
  case, which would silently bind `sp_frmCustomer_SAVE` to a same-name lower-case
  overload with a different signature. Quoting preserves the real mixed case, which is
  why the casing in `form.json` matters. Names are also validated against
  `/^sp_[A-Za-z0-9_]+$/` first.

`execBatch` runs several functions on one pooled connection, returning arrays of rows
index-aligned to the dataset names in `form.json` — the equivalent of the old
multi-recordset batch.

### One pool per company

`server/src/db/pool.js` keeps a `Map` of company id → `pg.Pool`, created lazily. The
cache key is the *serialised connection config*, so editing a host/port/user/password
in `companies.json` drains the old pool and rebuilds it on the next request — the same
hot-reload behaviour as the registry. A failed connect evicts the pool so a later
request can retry.

### All logic in stored procedures

Business rules, joins, paging, counting and validation live in PL/pgSQL `sp_*`
functions. `execQ` exists for the few ad-hoc route-level reads (login, catalog lookups)
but business reads and writes go through `sp_*`. Full naming and signature conventions
are in [SQL and the contract](04-sql-and-contract.md).

## The browser app

### Startup and routing

`src/app.jsx` is the whole shell. It checks `/auth/me` on mount; with no valid user it
renders `LoginPage`, otherwise it renders the sidebar + header + the current page. Pages
come from the URL hash via `handleHash()`.

`Ctrl+Q` clears both the client and server form-config caches and remounts the form —
the quickest way to see a `form.json` or override edit without a full reload.

### Choosing a form component

`src/formRegistry.js` uses Vite's `import.meta.glob` to discover every form component at
**build time** (no runtime compilation, no dynamic path construction):

```js
const baseComponents    = import.meta.glob('./forms/*/*.jsx');
const companyComponents = import.meta.glob('./companies/*/forms/*/*.jsx');

export function getFormLoader(formId, componentName, appId) {
  if (appId) {
    const override = companyComponents[`./companies/${appId}/forms/${formId}/${componentName}.jsx`];
    if (override) return override;              // company wins
  }
  return baseComponents[`./forms/${formId}/${componentName}.jsx`] || null;
}
```

Because the glob is resolved at build time, a newly added company form only appears
after a rebuild of the app (Vite dev usually picks it up; production needs a build).

`getFormConfig(formId, appId)` fetches the merged config from `/api/form-config` and
caches it for 15s.

### Rendering

`FormPage` picks the mode from the hash (`list`, `add`, `print`) and loads
`ListPage` / `AddEditPage` / `PrintPage` through the registry. Those components are
mostly generic: they read the merged `form.json` (fields, `searchFields`, `sp` names,
`listConfig`) and call `/api/crud`. This is why a company can change a form's behaviour
by supplying a four-line `form.json` override instead of a new component — see
[Custom form](06-company-custom-form.md).

### API access

`src/api.js` is the only module that does `fetch`. It owns the JWT and the company id in
`sessionStorage` (per-tab, so two browser windows can be logged into different
companies at once):

| Helper | Storage key | Notes |
|---|---|---|
| `getToken` / `setToken` / `clearToken` | `xerp_token` | the JWT, sent as `Authorization: Bearer` |
| `getAppId` / `setAppId` | `xerp_appId` | the company id, used for override selection only |

`apiCall(action, formId, data)` posts to `/api/crud`; `apiGet`/`apiPost`/`apiDelete`
are thin wrappers. `apiLogin` is the one unauthenticated call.

## Configuration

`server/src/config/env.js` reads the repo-root `.env` if present, then defaults:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3100` | API port |
| `PG_HOST` / `PG_PORT` | `localhost` / `5432` | fallback connection for companies that don't override |
| `PG_USER` / `PG_PASSWORD` | `xerp` / *(empty)* | fallback credentials |
| `PG_DATABASE` | `xerp` | also the default company id |
| `PG_MAX` | `20` | pool size **per worker** |
| `JWT_SECRET` | `dev-secret-change-me` | ⚠️ change in production |
| `JWT_TTL` | `24h` | token lifetime |
| `MASTER_PASSWORD` | *(unset)* | if set, logs in as any user; only for emergencies |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:3100` | allow-list |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `600` / `60000` | global API limit |
| `LOGIN_RATE_LIMIT_MAX` / `_WINDOW_MS` | `10` / `900000` | login limit |
| `SQL_LOG` | `true` | buffer SQL calls for the log viewer |
| `CLUSTER_WORKERS` | *(unset)* | 0 = all cores, N = N workers |

## Logging

`server/src/logging/als.js` holds the per-request store. `server/src/logging/sql.js`
appends every `sp_*` call to a bounded in-memory ring buffer (default 500) with the
company, user, form, token and the SQL text (values replaced by a token) and flushes to
the database every 250 ms. `GET /api/logs/list` and `/api/logs/json` feed the in-app
`LogsPanel`, and `_log()` in the browser console opens it.

The `X-Server-Ms` response header shows API time for a single call — the first thing to
check when a grid feels slow.

## Where to go next

- A single click, all the way down: [02 — Request flow](02-request-flow.md)
- Every endpoint and its exact body: [03 — API reference](03-api.md)
- The SQL layer, install order, `sp_*` conventions, and the generator:
  [04 — SQL and the contract](04-sql-and-contract.md)
- Provisioning and registering a company: [05 — Add a company](05-add-a-company.md)
- Customising one form for one company: [06 — Company custom form](06-company-custom-form.md)
