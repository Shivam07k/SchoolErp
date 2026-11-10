# 04 — SQL and the contract

The database layer: what the contract is, which SQL files exist and in what order they
must be installed, the `sp_*` naming and signature conventions, and how form SQL is
generated.

The governing idea: **the core schema is identical for every company, and every
company-specific difference is stored as data, never as DDL.** The one exception is a
genuinely divergent schema, which lives in that company's own `src/companies/<id>/sql/`.

## The contract

`server/_contract.json` is the single source of truth the generator reads. It has exactly
three top-level keys and no schema/version metadata:

| Key | Count | What it holds |
|---|---|---|
| `forms` | 15 | per-form config: field lists, form type, search fields, grid columns, procedure name overrides |
| `tables` | 24 (209 columns) | a snapshot of column introspection per table |
| `entities` | 14 | `formId → base table` — **this is the generator's driver list** |

### `forms.<formId>`

Every entry has the same seven keys:

```json
{
  "sp":          { "grid": "sp_frmCustomer_Grid2", "save": "sp_frmCustomer_SAVE", "…": "…" },
  "formType":    "master",
  "countInGrid": true,
  "searchFields":  [ { "name": "LedgerCode", "type": "text" } ],
  "headerFields":  [ { "name": "LedgerCode", "type": "text" } ],
  "detFields":     [],
  "gridCols":      [ "LedgerCode", "Country" ]
}
```

- `formType` is `master` (11 forms) or `master-detail` (4: `frmDeptSale2`,
  `frmDeptSale3`, `frmGoodsInward`, `frmgoodsoutward`). **There is no `report` type** —
  see [PRINT1](#print1-is-a-dead-reference) below.
- Field `type` is one of `text`, `number`, `date`, `checkbox`, `select`, `combobox`.
- `headerFields` / `detFields` are also the **base argument order** the CRUD route uses —
  see [Positional parameters](02-request-flow.md#positional-parameters).

### `tables.<name>`

An array of column rows, i.e. an introspection snapshot:

```json
"tblBrand": [
  { "table_name": "tblBrand", "column_name": "Id",        "data_type": "bigint" },
  { "table_name": "tblBrand", "column_name": "BrandName", "data_type": "text"   }
]
```

### `entities` — the full map

```json
{
  "frmBrand": "tblBrand",
  "frmCategoryOptions": "tblCategoryOptions",
  "frmCustomer": "tblfrmCustomer",
  "frmDeptSale2": "tblfrmDeptSale2",
  "frmDeptSale3": "tblfrmDeptSale3",
  "frmGoodsInward": "tblfrmGoodsInward",
  "frmgoodsoutward": "tblfrmgoodsoutward",
  "frmhsn": "tblfrmhsn",
  "frmItem": "tblfrmItem",
  "frmItemCategory": "tblfrmItemCategory",
  "frmitemno": "tblfrmitemno",
  "frmItemNoDyn": "tblfrmItemNoDyn",
  "frmPackingCategory": "tblfrmPackingCategory",
  "fromProcess": "tblProcess"
}
```

Two things worth knowing:

- `frmSecUser` is in `forms` but has **no `entities` entry**, so the generator skips it.
  Its form config is inert at the SQL layer.
- `fromProcess → tblProcess`, but `tblProcess` is **not** in `tables`. The generator has
  no introspection for it and therefore emits a `CREATE TABLE` — the only form that does.

14 entities + 1 shared tail = the 15 files in `sql/10_forms/`.

### Who writes it, who reads it

Nobody creates the contract from scratch in this tree; it is hand-maintained. The only
writer is `_gen.mjs`, and it touches exactly one thing: it overwrites
`forms.<id>.detFields` from its hard-coded `DETAIL` map, and rewrites the file only if
something actually changed.

| Consumer | Reads |
|---|---|
| `server/_gen.mjs` | `forms`, `tables`, `entities` |
| `server/_pages.mjs` | `forms` |
| `server/src/routes/crud.js` | `forms` (field order, procedure resolution) |
| `server/src/routes/customfields.js` | `entities` only, to resolve entity → table |

---

## The `sql/` folder

### Install order

The authoritative order is the `LAYERS` array in `server/_provision.mjs`.

**Once, as a PostgreSQL superuser** (creates the login role and the default database):

```
sql/00_init_db.sql
```

**Then, per company, in this exact order** — one transaction per file:

| # | Layer | What it is |
|---|---|---|
| 1 | `01_schema.sql` | platform schema: 12 tables (`tblHO_User`, `tblSec*`, `tblWebMenus`, `tblHO_Franchisee`, `tblUserSetting`, `tblBrand`), 10 indexes. Declares the fast-grid contract: every list returns rows **and** the total in one query via `count(*) OVER () AS rc`. |
| 2 | `02_functions.sql` | 15 set-returning functions + 2 helpers: company list, user-scoped menu tree, dashboard stats, scope helpers, dashboard quick links, grid preferences, security user list/get/save, perm save/get. Contains the reference `sp_Brand_*` implementation later layers copy. |
| 3 | `03_frmCategoryOptions.sql` | the **template** port — the proven fast-grid transliteration (`_Boot`, `_Grid2`, `_GridCount1`, `_DFE1`, `_SAVE`, `_UPDATE`, `_Delete1`, `_LockUnlock1`) plus `tblCategoryOptions`. |
| 4 | `03_seed.sql` | idempotent platform seed: company, groups (`ADMIN`/`SALES`/`ACCOUNTS`/`PURCHASE`/`OPERATOR`), departments, users `ADMIN` + `LOADTEST`, memberships, menus. Password hashes are deliberately **left empty** — `_provision.mjs` bcrypts them. |
| 5 | `04_companyname.sql` | `public.fn_companyname()` → `current_database()`. This is the one place a company can name itself. |
| 6 | `06_*.sql` (11 files) | hand-promoted ports. Each creates its table and 7–8 form-cased procedures. These are the **skeletons** the generated layer replaces. |
| 7 | `10_forms_all.sql` | the generated aggregate (~5.6k lines) = 14 form sections + `sp_GetCategoryOptions`. **Replaces** the `06_` procedures with the fast-grid dialect. |
| 8 | `11_security.sql` | security/admin surface: 16 functions (`sp_sec_dept_*`, `sp_sec_grp_*`, `sp_sec_link_*`, `sp_sec_menu_*`, `sp_sec_menu_scope_*`, `sp_sec_user_get`, `sp_company_save`, `sp_dashboard_links`), 2 tables, a `tblHO_Franchisee` audit trigger, and `ShowOnDashboard` on `tblWebMenus`. |
| 9 | `12_customfields.sql` | `tblFieldDef` + the `Custom` jsonb convention + `sp_cf_*`. See [Custom fields](#custom-fields). |

Three ordering rules that are easy to get wrong:

1. **`06_` before `10_forms_all`.** Each `06_` file creates the table and skeleton
   procedures; the generated layer then replaces them. Reversed, the fast-grid procedures
   would be clobbered by the slow skeletons.
2. **`02_functions` before `11_security`.** `sp_dashboard_links` is defined in *both*.
   Because each layer is `CREATE OR REPLACE`, whichever runs **last** wins — so `11` must
   come after `02` or the superseded version sticks.
3. **The `07_*` files are excluded on purpose.** `07_frmItem.sql` is a draft that
   collides with `06_frmItem.sql` on return types, and `07_frmItem_proof.sql` is a
   manual round-trip *proof* that even contains a syntax error. Do not add them.

> ⚠️ **The order is one-way.** Replaying a layer over a later layer's signature makes
> PostgreSQL raise `cannot change return type` or `cannot change name of input
> parameter`. `_provision.mjs` detects exactly those messages and stops with a rebuild
> instruction. Fix it by rebuilding with `--drop`, never by editing SQL in place.

Missing files are skipped with a message, so the chain tolerates an absent optional layer.

### Other files

| Path | Status |
|---|---|
| `sql/10_forms/` | a **directory**, not a file — 15 generated files (`10_<formId>.sql` ×14 + `10_shared.sql`). It only *looks* like a 1-byte file if you `Get-Content` it. |
| `sql/10_demo_load.sql` | optional, not in the chain. Inserts 100,000 `tblBrand` rows, `ANALYZE`s, returns the count. Useful for a fast grid to look at. |
| `sql/*.ps1` | the older lineage — six generators that wrote `sql/port_<formId>.sql`. No `port_*.sql` files exist any more; their output was promoted into the `06_`/`07_` files and superseded by `_gen.mjs`. Historical; not part of the live chain. |

---

## The generator (`_gen.mjs`)

`server/_gen.mjs` (738 lines) turns the contract into `10_*` form SQL. Two things to know
before running it:

- **It needs a live database.** `notNullCols(table)` opens a `pg.Pool` to
  `localhost:5432/xerp` and reads `information_schema` for
  `is_nullable='NO' AND column_default IS NULL`. Generation reads introspection from the
  running database; it is not a pure offline emitter.
- **Its root path is hardcoded**: `const ROOT = 'C:/Users/hp/Desktop/exp/pg-xerp'`. It
  writes against this exact tree.

It is not wired to an npm script; run it directly from `server/`:

```powershell
cd server
node _gen.mjs
```

### What it emits

```
sql/10_forms/10_<formId>.sql    × 14
sql/10_forms/10_shared.sql         the sp_GetCategoryOptions block
sql/10_forms_all.sql               the concatenation + shared tail
```

### Per form, in order

1. **Merge procedure names**: `{ ...contract.sp, ...live form.json.sp }` — the live
   `form.json` **wins**. (That's why `forms.frmBrand.sp` being `{}` is harmless: the
   `sp_Brand_*` names come from `src/forms/frmBrand/form.json`.)
2. **Column aliasing** (`COLALIAS`): `frmBrand: { Brand → BrandName }`. The select becomes
   `t."BrandName" AS "Brand"` — the *frontend* name is preserved in the result, only the
   SQL column changes.
3. **Lock-column detection**: prefers `Lock`, falls back to `LOCK`/`lock`; decides
   boolean-vs-integer from the introspected `data_type`, so an integer column named
   `LOCK` isn't mistaken for a flag. Non-introspected tables default to boolean.
4. **Schema**: only for a table with no `tables` introspection does it emit
   `CREATE TABLE IF NOT EXISTS` (bigserial PK + mapped columns + lock +
   `FCODE`/`User_Id`/`LOCK_User_Id`/`Created_At`). For introspected tables it only issues
   `ALTER TABLE … ADD COLUMN IF NOT EXISTS` per header field and per system column.
5. **Procedures**: drop every existing overload via a `DO` loop over `pg_proc`, then
   `CREATE OR REPLACE`.
6. **Detail side** for the four master-detail forms: create/reconcile the detail table,
   add a non-FK btree index, emit `DFE2` + `DET_SAVE`/`DET_UPDATE`/`DET_DELETE`.
7. **Trigram indexes** for real text `searchFields`, guarded on `pg_trgm` being available
   *and* `TRGM_INDEX !== '0'`.

### The detail map

| Form | Detail table | FK | Editable | Procedures |
|---|---|---|---|---|
| `frmDeptSale2` | `tblGoodsSaleDet` | `GoodsSale_id` | yes | `sp_frmDeptSale2_DeptSaledet_{SAVE,UPDATE,Delete1}` |
| `frmDeptSale3` | `tblGoodsSaleDet` | `GoodsSale_id` | yes | `sp_frmDeptSale3_DeptSaledet_{SAVE,UPDATE,Delete1}` |
| `frmGoodsInward` | `tblfrmGoodsInwardDet` | `tblfrmGoodsInward_Id` | yes | `sp_frmGoodsInward_Det_{SAVE,UPDATE,DELETE}` |
| `frmgoodsoutward` | `tblGoodsOutwardDet` | `GoodsOutward_ID` | no (read-only) | none, `DFE2` only |

⚠️ `frmDeptSale2` and `frmDeptSale3` **share** `tblGoodsSaleDet` with different column
sets. That is why the generator reconciles with explicit `ADD COLUMN IF NOT EXISTS` —
`CREATE TABLE IF NOT EXISTS` alone would never add the second form's columns.

### Grid performance techniques baked in

Each of these is a measured optimisation, and each is a trap if you "simplify" it:

| Technique | Why |
|---|---|
| Deep paging via `anchor AS MATERIALIZED … OFFSET (no-1)*rows`, then `page` reading `Id <= anchor` | avoids the O(offset) heap walk — 585 ms → fast at page 25k of 1M |
| `EXISTS(… LIMIT 1)` guard around the search | a search matching nothing must not walk the whole `Id` index — was 4.5 s |
| Unfiltered count uses `GREATEST(c.reltuples, page count)` | O(1) instead of counting |
| Filtered count is exact, unless `countmode='skip'` (then `rc = NULL`) | the route's 15s cache passes `'skip'` to avoid recounting |
| Column predicates are bare `col ILIKE`, never `COALESCE(col,'')` | so the trigram GIN index stays usable — 1203 ms → 12 ms |
| `date` columns emitted as `'YYYY-MM-DD'` text, `Created_At` as `'DD-Mon-YY'` | node-pg and `<input type="date">` otherwise shift across timezones |
| Blank text stores `''`, never `NULL` | matches the legacy SQL-Server `NOT NULL` columns |

### `SAVE` and `NOT NULL` handling

The generator queries `information_schema` for `is_nullable='NO' AND column_default IS
NULL` and appends a type-correct default (`nnDef`) for any such column the form does not
write: boolean→`false`, ints→`0`, numeric→`0`, timestamp→`now()`, date→`current_date`,
time→`'00:00:00'`, json→`'{}'`, uuid→`gen_random_uuid()`, else `''::text`.

`SAVE` also injects `User_Id` by looking up `tblHO_User` on the `auth` token (falling
back to the auth string itself) and takes `FCODE` from the `FCODE` argument (falling back
to `'HO'`), unless `FCODE` is itself a form field.

---

## `sp_*` conventions

### Name resolution

The generator resolves each role from a merged name map, defaulting to
`sp_<formId>_<Action>`:

| Role | key | Default |
|---|---|---|
| Grid | `sp.grid \|\| sp.search` | `sp_<formId>_Grid2` |
| Save | `sp.save` | `sp_<formId>_SAVE` |
| Update | `sp.update` | `sp_<formId>_UPDATE` |
| Delete | `sp.delete` | `sp_<formId>_Delete1` |
| DFE1 | `sp.dfe1` | `sp_<formId>_DFE1` |
| DFE2 | `sp.dfe2` | *omitted* |
| GridCount1 | `sp.gridCount` | *omitted* |
| Lock | `sp.lock` | `sp_<formId>_LockUnlock1` |
| Boot | `sp.boot` | *omitted* |
| AddBlank | `sp.addBlank` | `sp_<formId>_AddBlank` |
| PrintRow | `sp.printRow` | *omitted* |

`crud.js` resolves the same names, but from the **live** `src/forms/<formId>/form.json`
— the shared config, not the contract, and not a company `form.json` (see
[Known gaps](#known-gaps-at-the-end-of-this-document)).

### Parameter prefixes

Each parameter is prefixed `p_` + the identifier lowercased with non-alphanumerics
replaced by `_`, using `uniq()` to avoid collisions:

| Identifier | Prefix |
|---|---|
| `frmCustomer` | `p_frmcustomer` |
| `frmBrand` | `p_frmbrand` |
| `frmItemNoDyn` | `p_frmitemnodyn` |
| `LedgerCode` (a field) | `p_ledgercode` |

### Exact signatures

`S` = one `text` per `searchFields` entry, `H` = one `text` per `headerFields` entry,
`D` = one `text` per detail field, `<P>` = the form prefix.

| Procedure | Parameters, in order | Returns |
|---|---|---|
| `Grid2` | `<P>_rows int, <P>_no int, S…, <P>_frm, <P>_fcode, <P>_auth, <P>_countmode text DEFAULT ''` | `id bigint`, grid columns…, `FCODE`, `LOCK`, `LOCK_User_Id`, `User_Id`, `Created_At`, `rc bigint` |
| `GridCount1` | `S…, <P>_frm, <P>_fcode, <P>_auth` | `TotalPages bigint` |
| `DFE1` | `<P>_id bigint, <P>_frm, <P>_auth, <P>_unused` | `id bigint`, header fields…, `LOCK bool` |
| `DFE2` | `<P>_id bigint, <P>_frm, <P>_auth, <P>_unused` | `id bigint`, detail grid columns… |
| `SAVE` | `H…, <P>_frm, <P>_fcode, <P>_auth, <P>_unused` | `status, message, id bigint, Error` |
| `UPDATE` | `<P>_id bigint, H…, <P>_frm, <P>_fcode, <P>_auth, <P>_unused` | `status, message, id bigint, Error` |
| `Delete1` | `<P>_id bigint, <P>_frm, <P>_auth, <P>_unused` | `status, message, Error` |
| `LockUnlock1` | `<P>_id bigint, <P>_frm, <P>_auth, <P>_unused` | `status, message, Error` |
| `AddBlank` / `Boot` | `<P>_frm, <P>_auth, <P>_unused` | master: `id`, header fields…, `LOCK` (blank). master-detail: `id` from a **draft INSERT**. |
| `PRINT_ROW1` | `<P>_id bigint, <P>_frm, <P>_auth, <P>_unused` | `id`, header fields…, `det1 jsonb` |
| `DET_SAVE` | `D…, <P>_frm, <P>_fcode, <P>_auth, <P>_unused` | `status, message, id bigint, Error` |
| `DET_UPDATE` | `<P>_did bigint, D…, <P>_frm, <P>_fcode, <P>_auth, <P>_unused` | `status, message, id bigint, Error` |
| `DET_DELETE` | `<P>_did bigint, <P>_frm, <P>_auth, <P>_unused` | `status, message, Error` |

Worked example — `frmBrand`'s `Grid2`, verbatim from `10_forms_all.sql`, showing both the
`COLALIAS` and the name merge:

```sql
CREATE OR REPLACE FUNCTION public."sp_Brand_Grid2"(
    p_frmbrand_rows integer, p_frmbrand_no integer,
    p_brand text,
    p_frmbrand_frm text, p_frmbrand_fcode text, p_frmbrand_auth text, p_frmbrand_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Brand" text, "FCODE" text, "LOCK" boolean,
              "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
```

### Behaviour by form type

**Master** (11 forms): `Grid2`, `DFE1`, `SAVE`, `UPDATE`, `Delete1`, `LockUnlock1`,
`AddBlank` (a blank shape, no insert), optionally `GridCount1`/`Boot`/`PRINT_ROW1`.
`Delete1` touches the master row only.

**Master-detail** (4 forms): all of the above **plus** the detail table, `DFE2`, and —
for the three editable ones — `DET_SAVE`/`DET_UPDATE`/`DET_DELETE`. Two behaviours
differ and are easy to miss:

- `AddBlank` **INSERTs a draft header** and returns its real `Id`, because "Add New" must
  have an id to attach lines to before the header is persisted.
- `Delete1` **cascades** — it deletes detail rows (`WHERE fk = id`) and then the header.

### `PRINT1` is a dead reference

`_gen.mjs` has no code path that emits `PRINT1`, and a search of every `sql/*.sql` finds
**zero** `PRINT1` functions — even though the contract's `sp` maps list `PRINT1` for
`frmCustomer`. It is a leftover from the old xErp contract. **`PRINT_ROW1` is the live
print mechanism**: it returns the header columns plus a `det1` jsonb array of line items,
and `PrintPage.jsx` reads `data.hdr1[0]` and `data.det1`. It is generated for the nine
forms that set `sp.printRow`: `frmCustomer`, `frmDeptSale2`, `frmDeptSale3`,
`frmGoodsInward`, `frmgoodsoutward`, `frmhsn`, `frmItemNo`, `frmItemNoDyn`,
`fromProcess`.

### Mixed case is mandatory

Procedure names keep each form's real capitalisation: `sp_frmCustomer_Grid2`,
`sp_frmitemno_Grid2`, `sp_frmItemNoDyn_Grid2`, `sp_frmgoodsoutward_*`. `sp.js` **quotes**
the identifier when calling, because PostgreSQL folds an unquoted name to lower case and
would silently bind to a stale same-name overload with a different signature. The only
intentionally lower-case procedures are the platform ones: `sp_cf_*`, `sp_company_*`,
`sp_sec_*`, `sp_get_menus`, `sp_dashboard_*`.

### Calling one

`server/src/db/sp.js`:

- validates the name against `/^sp_[A-Za-z0-9_]+$/`;
- quotes it: `SELECT * FROM "sp_frmCustomer_SAVE"($1,$2,…)`;
- parameterizes every value;
- `execFn` for one function, `execBatch` for several on one connection (same transaction
  scope, results index-aligned to `form.json` dataset names), `execQ` for the few
  ad-hoc route-level queries.

---

## Custom fields

The no-code path for company-specific fields. Two tables, one idea:

- **`tblFieldDef`** — the catalog. A row's presence in a database *is* the activation
  switch for that company, so there is no separate enable table.
- **`"Custom"`** — a `jsonb` column on the base table holding the values, created on
  demand.

```sql
CREATE TABLE IF NOT EXISTS public."tblFieldDef" (
  "Field_Key"  text PRIMARY KEY,
  "Entity"     text NOT NULL,
  "Label"      text NOT NULL,
  "Data_Type"  text NOT NULL DEFAULT 'text',
  "Options"    jsonb,
  "Required"   boolean NOT NULL DEFAULT false,
  "Active"     boolean NOT NULL DEFAULT true,
  "Ordinal"    int NOT NULL DEFAULT 100,
  "Created_At" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chkFieldDefType" CHECK ("Data_Type" IN ('text','number','date','bool','lookup'))
);
CREATE INDEX IF NOT EXISTS "ixFieldDefEntity"
  ON public."tblFieldDef" ("Entity") WHERE "Active";
```

### The `sp_cf_*` functions

| Function | Signature | Returns | What it does |
|---|---|---|---|
| `sp_cf_ensure` | `(p_table text)` | `text` | Idempotent. Whitelists `^[A-Za-z_][A-Za-z0-9_]{0,62}$`, confirms the table exists in `public` (matched **exactly**, not case-folded, so both `tblfrmhsn` and `tblBrand` work), then `ADD COLUMN IF NOT EXISTS "Custom" jsonb NOT NULL DEFAULT '{}'` and a GIN index `ix_<lower(table)>_custom … jsonb_path_ops`. Raises `22023` on a bad/unknown table. |
| `sp_cf_clean` | `(p_entity text, p_vals jsonb)` | `jsonb` | Coercion. Iterates the entity's **active** defs; drops undeclared keys, blanks and JSON nulls. Enforces `number` (`^-?[0-9]+(\.[0-9]+)?$`), `date` (`YYYY-MM-DD`) and `bool` (`true,1,t,y,yes,on`). Raises `22023` on a mismatch. |
| `sp_cf_defs` | `(p_entity text)` | `TABLE(Field_Key, Label, Data_Type, Options, Required, Ordinal)` | `LANGUAGE sql STABLE`. Active defs `ORDER BY "Ordinal", "Field_Key"`. |
| `sp_cf_save_def` | `(p_key text, p_entity text, p_label text, p_type text, p_options jsonb, p_required boolean, p_ordinal int)` | `TABLE(f_key, f_label, f_type)` | Enforces `p_key ~ ^[A-Za-z][A-Za-z0-9_]*\.[a-z0-9_]+$`, requires a label, validates `p_type`, and **refuses to re-type a field that already holds values**. `ON CONFLICT ("Field_Key") DO UPDATE … "Active"=true`. The OUT params are named `f_key/f_label/f_type` on purpose — naming them `Field_Key` etc. would shadow the column in the `ON CONFLICT` target and fail to compile. |
| `sp_cf_values` | `(p_table text, p_ids bigint[])` | `jsonb` | Whitelists the table, returns `{ "<id>": Custom, … }`. Deliberately *not* folded into `Grid2` — that would need a per-company compiled artifact. |
| `sp_cf_save_values` | `(p_entity text, p_table text, p_id bigint, p_vals jsonb)` | `text` | Whitelists, cleans via `sp_cf_clean`, then **merges**: a key present in the payload is written (blank clears it), a key absent is left alone. Returns `'ok:<keycount>'` or `'no such record'`. Tests the returned jsonb (not `FOUND`, which is unreliable after `EXECUTE … INTO`) to detect a missing row. |

### Security posture

`REVOKE ALL ON FUNCTION` from `PUBLIC` for `sp_cf_ensure`, `sp_cf_values` and
`sp_cf_save_values`, since those build dynamic SQL. That is defence in depth only — the
owner account bypasses it — which is why `customfields.js` resolves the entity through
the contract and never forwards a caller-supplied table name. SQLSTATEs `22023`, `23514`,
`22P02` and `P0001` are translated to HTTP **400**, so a bad payload never looks like a
server fault.

---

## Provisioning, cloning, migrating

Full usage in [07 — Tools and scripts](07-tools.md). The mechanics that matter here:

**`_provision.mjs`** applies `LAYERS` in the order above, one transaction per file,
printing `ok <file> (<ms>ms)`. A failure rolls that file back and exits 1; if the message
is `cannot change return type` / `cannot change name of input parameter` it also prints
the one-way-order warning and the rebuild command. Afterwards it optionally overrides
`fn_companyname()` with `--label`, and sets the `ADMIN` password — from `--admin-password`
or a random `crypto.randomBytes(9)` value, bcrypt cost 10, **only if `PasswordHash` is
currently empty**, printing it once. (`03_seed.sql` deliberately creates `ADMIN` with no
hash so a fresh company can only be reached via `MASTER_PASSWORD`; the update matches
`lower(btrim("UserId"))='admin'`, which is why it finds the upper-case `ADMIN` row.)

**`_clone.mjs`** picks its method automatically: same host+port →
`CREATE DATABASE … WITH TEMPLATE <src> OWNER <owner> ENCODING 'UTF8'`; different server →
`pg_dump --format=custom --no-owner` piped into `pg_restore --no-owner --no-privileges`.
It refuses to overwrite an existing database or an already-registered id without
`--drop`, and by default clears every `tblHO_User.token` on the copy — otherwise a source
token would still validate there, because auth reads `tblHO_User` in whichever database
the request reached.

**`_migrate.mjs <companyId>`** applies `src/companies/<id>/sql/*.sql` (sorted) to **that
company's database only** — "applying ash1's DDL to xerp would be a data incident, not a
migration". It tracks `(company, file, hash)` in `public.company_migration` where
`hash = sha256(contents).slice(0,16)`, reports `pending` / `applied <ts>` /
`CHANGED since it ran`, and **re-runs a file whose hash changed**. One transaction per
file. It resolves the database through the same registry as the server, so "which DB is
this company" has exactly one answer.

**`_copyform.mjs <formId> <companyId>`** copies `src/forms/<formId>` to
`src/companies/<companyId>/forms/<formId>`, re-basing relative imports (resolve, then
re-relativise, so nesting depth is handled and bare specifiers are left alone). It never
overwrites without `--force`, and reminds you to also add `fieldOrder.json` and
`sql/*.sql` if the company has its own columns.

---

## Known gaps at the end of this document

Honest list of things that look like bugs, so nobody rediscovers them:

- **`PRINT1`** — referenced by contracts, generated by nothing. Use `PRINT_ROW1`.
- **`07_frmItem.sql` / `07_frmItem_proof.sql`** — deliberately excluded; the first
  collides on return types, the second has a syntax error (`v_delILIKE`).
- **`sql/10_forms`** is a directory, not an empty file.
- **`frmSecUser`** has no `entities` entry, so the generator skips it.
- **`tblProcess`** (`fromProcess`) is the only table the generator creates from scratch.
- **`crud.js` `loadFormConfig` is common-only.** It reads `src/forms/<formId>/form.json`
  and has a 15s TTL cache; it does **not** merge the company override, unlike
  `/api/form-config`. So a company `form.json` changes the UI but not the procedure
  resolution. If you rename a procedure in a company override, `crud.js` will not see it.
- **`/api/form-config` trusts a client-supplied `appId`** for choosing which override to
  merge. Presentation only, never routing, but it should read the JWT.
- **`_gen.mjs` has a hardcoded root path** and a hardcoded `xerp` connection.
- **A `--drop` rebuild destroys everything** in the target database, including custom
  fields and any data seeded outside the layer chain. `companies.json` survives; the
  database does not.
