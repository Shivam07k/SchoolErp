# 03 — API reference

Every endpoint the server exposes, what it takes, and what it returns. For the reasoning
behind them see [02 — Request flow](02-request-flow.md).

Base URL in development is `http://localhost:3100`; the browser talks to the Vite dev
server on `:5173` which proxies `/api` through, so from the app's point of view every
path below is just `/api/...`.

## Conventions

**Auth.** Every endpoint needs `Authorization: Bearer <jwt>` except the three marked
public. Unauthenticated → `401 { "error": "No token provided" | "Invalid token" }`.

**Company.** Handled for you: the JWT's `company` claim picks the database. You never
send a company to choose a database.

**Rate limits.** 600 requests/minute across `/api`; 10 login attempts per 15 minutes.
Exceeding either returns `429` with `{ "error": "Too many requests…" }`.

**Errors.** Two styles coexist:

- `4xx` with `{ "error": "…" }` — a malformed or unauthorised request.
- `200` with `{ "error": "…" }` — a *handled* failure from `/api/crud` and
  `/api/form-config`. The status is 200 because the HTTP call itself succeeded; check
  the `error` key. This trips people up, so check it.

**Timing.** Every `/api` response carries `X-Server-Ms`.

## Endpoint index

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | log in (public) |
| GET | `/api/auth/me` | current user from the token |
| GET | `/api/auth/companies` | company list for the login screen (public) |
| POST | `/api/crud` | **all form actions** |
| GET | `/api/form-config/:formId` | merged form config (shared + company override) |
| GET | `/api/schema/:formId` | same handler, older path |
| GET | `/api/schema/forms` | list of form packages |
| GET | `/api/menu` | menu tree |
| GET | `/api/dashboard` | dashboard stat cards and quick links |
| GET | `/api/tables` | base tables in `public` |
| GET | `/api/columns/:table` | columns of one table |
| GET | `/api/logs/list` | log files |
| GET | `/api/logs/json` | lines from a log file |
| GET/POST | `/api/security/…` | users, departments, groups, links, menus, scopes, permissions, companies |
| GET/POST/PUT/DELETE | `/api/customfields/…` | per-company custom-field catalog and values |
| GET | `/api/healthz` | liveness + DB ping (public) |
| GET | `/api/env` | `{ dev, master }` flags (public) |

---

## Auth

### `POST /api/auth/login` — public

```json
{ "userid": "ADMIN", "password": "admin123", "company": "ash1" }
```

`company` is optional and defaults to the registry's `default`. It is whitelisted
against `companies.json` before use, so an unknown value is rejected rather than
probed.

Responses:

| Case | Status | Body |
|---|---|---|
| Success | 200 | `{ "ok": true, "token": "<jwt>", "user": { "userid", "name", "grp" }, "company", "companyName", "viaMaster": false }` |
| Unknown company | 400 | `{ "error": "Unknown company" }` |
| Missing fields | 400 | `{ "error": "userid and password required" }` |
| Bad credentials | 401 | `{ "error": "Invalid credentials" }` (also for a user with no password hash or `Status='0'`) |

The user must exist in **that company's** database. A user present in `xerp` but not in
`ash1` cannot log in to `ash1` — this is the isolation boundary.

> `MASTER_PASSWORD`, if set in the environment, logs in as any user. Every use is logged
> with a warning. Intended for emergencies; unset it in production.

### `GET /api/auth/me`

`{ "ok": true, "user": { …everything in the JWT payload… } }`

### `GET /api/auth/companies` — public

```json
{ "ok": true, "companies": [ { "id": "xerp", "label": "XERP (HO)" },
                            { "id": "ash1", "label": "Ash1" } ] }
```

Labels prefer the database's own `fn_companyname()` and become `Name (id)` when it
differs from the id. Cached on the registry revision, so a newly registered company
appears without restarting the server.

---

## `POST /api/crud` — the workhorse

One endpoint serves every form. `formId` selects the form, `action` the operation.

```json
{
  "formId": "frmCustomer",
  "action": "_SEARCH_JSON",
  "id": "5",
  "params": { "LedgerCode": "C001", "Country": "India" },
  "csv": "grid1",
  "pagesize": 20,
  "pageno": 1,
  "FCODE": "HO"
}
```

Only `formId` and `action` are required. `params` is a field→value object; its **key
order is irrelevant** because the server re-orders it into the form's declared field
order (see [Positional parameters](02-request-flow.md#positional-parameters)).

Invalid `formId` (not matching `/^[a-zA-Z0-9_\-]+$/`), or a form with no readable
config, returns `200` with `{ "error": … }`. An unknown `action` returns
`{ "error": "Unknown action: …" }`.

| Action | Procedure | Arguments | Response |
|---|---|---|---|
| `_BOOT` | `sp.boot` | `formId, auth, ''` | the blank/default row object, or `{}` |
| `_SEARCH_JSON` | `sp.grid` ?? `sp.search` ?? `sp_<formId>_Grid2` | `pagesize, pageno, <searchFields…>, formId, FCODE, auth, countmode` | `{ "<gridKey>": [rows], "TotalPages": [{ "TotalPages": n }] }` |
| `_EDIT_JSON` | `sp.dfe1` ?? `sp_<formId>_DFE1` | `id, formId, auth, ''` | `{ "hdr1": [row] }`, plus `det1` for master-detail forms with a `dfe2` |
| `_SAVE` | `sp.save` ?? `sp_<formId>_SAVE` | `<headerFields…>, formId, FCODE, auth, ''` | `{ "det1": rows, "sts": [errorRows] }` |
| `_UPDATE` | `sp.update` ?? `sp_<formId>_UPDATE` | `id, <headerFields…>, formId, FCODE, auth, ''` | `{ "det1": rows, "sts": [errorRows] }` |
| `_PRINT_ROW` | `sp.printRow` ?? `sp_<formId>_PRINT_ROW1` | `id, formId, auth, ''` | `{ "hdr1": [hdr], "det1": [...] }` |
| `_EXEC_SP` | `params._spName` | the other `params` values in order, then `auth` | `{ "result1": rows }` |
| `_DET_SAVE` | `sp.detSave` | `<detFields…>, formId, FCODE, auth, ''` | `{ "det1", "sts" }` |
| `_DET_UPDATE` | `sp.detUpdate` | `id, <detFields…>, formId, FCODE, auth, ''` | `{ "det1", "sts" }` |
| `_DET_DELETE` | `sp.detDelete` | `id, formId, auth, ''` | `{ "det1": rows }` |
| `_DELETE` | `sp.delete` ?? `sp_<formId>_Delete1` | `id, formId, auth, ''` | `{ "ret": rows }` |
| `_DELETE_ROW` | same as `_DELETE` | `id, formId, auth, ''` | `{ "det1": rows }` |
| `_LOCK` | `sp.lock` ?? `sp_<formId>_LockUnlock1` | `id, formId, auth, ''` | `{ "ret": rows, "sts": rows }` |
| `_ADD_BLANK` | `sp.addBlank` ?? `sp_<formId>_AddBlank` | `formId, auth, ''` | the blank row object (on master-detail forms, a new draft `id`) |

Notes:

- `auth` is the session token from the JWT, or the user id when the form sets
  `"authType": "userId"`. This is how procedures know who is calling.
- `FCODE` falls back to the token's `fcode`, then `'HO'`.
- All values are sent as text; `null`/`undefined` become `''`. Type coercion and NOT
  NULL defaults are the procedure's job.
- A `master-detail` form whose `dfe2` fails still returns the header, with `det1: []`.
- `_SEARCH_JSON`'s response key comes from the first entry of `csv` (default `grid1`),
  which is how `form.json`'s `csvComma` shapes the client.
- `_SEARCH_JSON` returns `200` with an empty grid if the procedure errors — check the
  server log rather than assuming "no matches".
- `_EXEC_SP` is the escape hatch for a page to call a whitelisted `sp_*` by name. The
  name must match `/^sp_[a-zA-Z0-9_]+$/` or you get `400`.

`sts` is pre-filtered to rows where `status === 'Error'` or `Error` is truthy, so the UI
can check one array.

---

## Form configuration

### `GET /api/form-config/:formId`

`schemaRouter` is mounted at **both** `/api/schema` and `/api/form-config`; the
`:formId` handler is the same in both cases.

| Query | Meaning |
|---|---|
| `appId` | which company's override to merge in. Omit for the shared config only. |

```json
{ "ok": true, "config": { …merged form.json… }, "appliedOverride": "ash1", "isCommon": false }
```

`isCommon: true` when the company has no override. `appliedOverride` is `null` then.

The merge is **deep**, and designed so a company override stays small: objects merge
recursively; arrays whose entries all carry a `name` merge by name (so an override can
flip `hidden` on an existing field, or add a new one); every other array is replaced
wholesale. A four-line override is therefore enough to hide a field — no 100-line copy
to keep in sync.

`400` if `formId` or `appId` fails its regex, `404` if the shared form does not exist.

> ⚠️ `appId` comes from the client here (it selects which files get merged, not which
> database is used). The JWT's `company` would be the stricter source; see
> [Architecture](01-architecture.md#company-routing).

### `GET /api/schema/forms`

```json
{ "ok": true, "forms": [ { "formId": "frmCustomer", "title": "Customer Master", "formType": "master" } ] }
```

---

## Menu, dashboard, introspection

### `GET /api/menu?fcode=HO`

Calls `sp_get_menus(fcode, sessionToken)` and groups the rows into a two-level tree:

```json
{ "ok": true, "menu": { "Sales": { "Customer": [ { "title": "Customer Master",
                                                  "formId": "frmCustomer",
                                                  "webPage": "frmCustomer.aspx",
                                                  "icon": "…",
                                                  "visible": "1" } ] } } }
```

`formId` is extracted from the legacy `WebPage` string: it matches `frm…`/`rpt…` and
strips the old `_JQ`, `_AE`, `_AEG`, `_SS` suffixes. Returns `{ "ok": true, "menu": {} }`
rather than an error if the procedure fails, so the app still boots with an empty menu.

### `GET /api/dashboard`

`{ "ok": true, "stats": { "<key>": "<val>" }, "links": [ … ], "forms": [] }`

`stats` comes from `sp_dashboard_stats()` and `links` from
`sp_dashboard_links('admin', sessionToken)`. Each is wrapped in its own try/catch, so
one failing still returns the other. (`sp_dashboard_links` is defined twice in the SQL
layer — `02_functions.sql` and `11_security.sql`; the later one wins, which is why the
install order in [04](04-sql-and-contract.md#install-order) matters.)

### `GET /api/tables`

`{ "ok": true, "tables": ["tblBrand", "tblfrmCustomer", …] }` — base tables in `public`.

### `GET /api/columns/:table`

```json
{ "ok": true, "columns": [ { "column_name": "LedgerCode", "data_type": "text",
                              "character_maximum_length": 20, "is_nullable": "NO" } ] }
```

`:table` must match `/^[A-Za-z0-9_]+$/`. Read-only introspection for the dev-only Form
Generator page.

---

## Logs

### `GET /api/logs/list`

A bare JSON array (not wrapped in `ok`), newest first:

```json
[ { "name": "sql-2026-09-28.log", "size": 48213, "mtime": 1789… } ]
```

### `GET /api/logs/json`

| Query | Default | Meaning |
|---|---|---|
| `file` | required | file name; must match `/^[A-Za-z0-9_.-]+$/` or `400` |
| `tail` | — | `1` = last 500 lines only |
| `limit` | `300` | max lines returned, capped at 2000 |
| `q` | — | case-insensitive substring filter |

`{ "items": [ …parsed JSON lines, or { "raw": "…" } if a line isn't JSON… ] }`

---

## Security administration

All under `/api/security`, all authenticated, all scoped to the token's company.

These screens use a small REST dialect rather than the `Grid2` one: they POST a named
master and the procedures answer `{ status, message }`. A `status` other than
`ok`/`success` becomes `400 { ok: false, error, result }`; otherwise
`200 { ok: true, status: "ok", result, message }`.

`scopeType` must be one of `U`, `G`, `D` (user, group, department) wherever it appears.

### Users

| Method | Path | Notes |
|---|---|---|
| GET | `/security/users` | `sp_sec_user_list()` → `{ ok, users: rows }` |
| GET | `/security/user/:userId` | `sp_sec_user_get(userId)` → `{ ok, hdr, depts, grps, hasPassword }`; `404` if unknown; id must match `/^[A-Za-z0-9_\- ]*$/` |
| POST | `/security/user` | save (alias) |
| POST | `/security/users/save` | save (alias, same handler) |

Save body:

```json
{ "userId": "ADMIN", "userName": "Administrator", "designation": "System Admin",
  "status": "1", "deptsCsv": "HO", "grpsCsv": "ADMIN", "password": "…" }
```

Sent to `sp_sec_user_save` as
`[actor, userId, userName, hash, designation, status, deptsCsv, grpsCsv]`. A plaintext
`password` is bcrypt-hashed (cost 10) first. **Omitting `password` keeps the existing
hash** — that is why the hash argument must arrive as `NULL` and not `''`, since an
empty string would wipe it and lock the user out.

### Departments, groups, links, menus, scopes, permissions

| Method | Path | Procedure | Key arguments |
|---|---|---|---|
| GET | `/security/departments` | `sp_sec_dept_list` | — |
| POST | `/security/department` | `sp_sec_dept_save` | `deptName` |
| POST | `/security/department/delete` | `sp_sec_dept_delete` | `deptId` |
| GET | `/security/groups` | `sp_sec_grp_list` | — |
| POST | `/security/group` | `sp_sec_grp_save` | `groupName`, `isAdmin` |
| POST | `/security/group/delete` | `sp_sec_grp_delete` | `grpId` |
| GET | `/security/links` | `sp_sec_link_list` | — |
| POST | `/security/links` | `sp_sec_link_save` | `linkId, linkName, linkType, formId, url, icon, menuOrder, active` |
| POST | `/security/links/delete` | `sp_sec_link_delete` | `linkId` |
| GET | `/security/menus?fcode=` | `sp_sec_menu_list` | `fcode` |
| POST | `/security/menus` | `sp_sec_menu_save` | `id, menuTitle, subGroup, icon, menuOrder, show, showOnDashboard, adminOnly` |
| GET | `/security/menu-scope?scopeType=&scopeId=` | `sp_sec_menu_scope_get` | `scopeType`, `scopeId` |
| POST | `/security/menu-scope` | `sp_sec_menu_scope_save` | `scopeType, scopeId, items` (JSON) |
| GET | `/security/perm?scopeType=&scopeId=&formId=` | `sp_sec_perm_get` | three params |
| GET | `/security/perm/:scopeType/:scopeId/:formId` | `sp_sec_perm_get` | path params |
| POST | `/security/perm` | `sp_sec_perm_save` | `scopeType, scopeId, formId, flags` (or legacy `json`) |
| GET | `/security/companies` | `sp_company_list` | — |
| POST | `/security/companies` | `sp_company_save` | `id, franchiseeCode, company, name, status` |

Note `/security/companies` is a **franchisee** list held in `tblHO_Franchisee` — it is
not the same thing as the company registry in `server/config/companies.json`.

---

## Custom fields

`/api/customfields`, authenticated. This is the **no-code** way to add a field to one
company: the definition goes in a catalog table, the values in a `jsonb` column, and no
JavaScript or DDL is touched. See
[06 — Company custom form](06-company-custom-form.md#path-a-add-a-field-with-no-code-at-all).

The `entity` is resolved to a real table through `server/_contract.json`'s `entities` map
(`frmCustomer` → `tblfrmCustomer`), and a **caller-supplied table name is never
forwarded** to the dynamic SQL inside `sp_cf_*`. An unknown entity → `400`.

Every read or write first calls `sp_cf_ensure(table)`, which idempotently adds the
`"Custom" jsonb` column and its GIN index — so a newly supported entity needs no
migration; the column appears on first use.

### `GET /customfields/defs?entity=frmCustomer`

```json
{ "status": "Success", "entity": "frmCustomer",
  "defs": [ { "field_key": "frmCustomer.gst_no", "label": "GST No",
              "data_type": "text", "options": null, "required": false, "ordinal": 10 } ] }
```

### `POST /customfields/defs`

```json
{ "entity": "frmCustomer", "field_key": "frmCustomer.gst_no",
  "label": "GST No", "data_type": "text", "options": null,
  "required": false, "ordinal": 10 }
```

→ `sp_cf_save_def(key, entity, label, type, options, required, ordinal)`

Validation, all `400`:

- `field_key` must match `^[A-Za-z][A-Za-z0-9_]*\.[a-z0-9_]+$` — the entity segment
  keeps real casing (so `frmItemNoDyn` and `fromProcess` work), the field segment is
  lower snake case.
- `field_key` must start with the entity name.
- `label` is required. `data_type` ∈ `text`, `number`, `date`, `bool`, `lookup`.
- The SQL layer also **refuses to re-type a field that already holds values**, and
  re-saving an existing key reactivates it rather than duplicating it.

Response: `{ "status": "Success", "def": { …normalised def… } }`

### `DELETE /customfields/defs/:key`

Sets `"Active" = false` — it does **not** delete the row, because stored values outlive
the definition. `404` if the key is unknown. Response
`{ "status": "Success", "field_key", "active": false }`.

### `GET /customfields/values?entity=frmCustomer&ids=5,6,7`

```json
{ "status": "Success", "entity": "frmCustomer",
  "values": { "5": { "gst_no": "27ABC…" }, "6": { "gst_no": null } } }
```

At most 500 positive integer ids. This is deliberately a **separate** call from `Grid2`
rather than folded into it: that would mean a different compiled procedure per company,
which is the thing this design exists to avoid. The client merges `values` onto the grid
rows it already has.

### `PUT /customfields/values`

```json
{ "entity": "frmCustomer", "id": 5, "values": { "gst_no": "27ABC…" } }
```

→ `sp_cf_save_values(entity, table, id, values)`

**Merge semantics:** a key present in the payload is written (a blank value clears it),
a key absent is left alone. So a full-form submit behaves like a replace while a
single-field patch behaves like a merge, and two users editing different fields of the
same record don't clobber each other. Values are coerced against their declared type
(`number` → numeric regex, `date` → `YYYY-MM-DD`, `bool` → `true/1/t/y/yes/on`) and an
undeclared, blank, or null key is dropped.

Responses: `{ "status": "Success", "id", "result": "ok:3" }`, or `404` when the record
does not exist. Bad types / unknown keys / unknown tables come back as `400` — the SQL
layer raises `22023` and the route translates it, so a client mistake never looks like a
server fault.

---

## Health and environment

| Path | Body | Notes |
|---|---|---|
| `GET /api/healthz` | `{ "ok": true, "db": "up", "time": "…" }` or `503 { "ok": false, "db": "down" }` | public |
| `GET /api/env` | `{ "dev": true, "master": false }` | public; gates the dev-only Form Generator page |

> ⚠️ `/api/healthz` calls `getPool()` with no request context, so it always pings the
> **default** company's database. It proves the server and that one database are alive,
> not every company. There is a separate registry-wide check in
> [08 — Testing](08-testing.md).
