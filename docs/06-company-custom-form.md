# 06 — Company custom form / field

How to change a form for **one company only**, and how to add a form for everyone. Five
paths, cheapest first. Pick the topmost one that does what you need — the lower paths cost
real maintenance.

| Path | What you want | Code? | DDL? | Effort |
|---|---|---|---|---|
| **[A](#path-a-add-a-field-with-no-code-at-all)** | One company gets extra fields on a form | No | No (just a `jsonb` column, created on demand) | 1 API call |
| **[B](#path-b-change-a-form-with-a-partial-formjson)** | One company sees a different layout, labels, or grid columns | No | No | A 4-line JSON file |
| **[C](#path-c-add-a-real-column-for-one-company)** | One company gets a **real column** that its forms, reports and SQL can use | Yes | Yes | 4 files, one migration |
| **[D](#path-d-override-the-whole-form-component)** | One company needs different behaviour in React | Yes | No | Copy a folder, edit JSX |
| **[E](#path-e-add-a-brand-new-form-for-everyone)** | A new form, for all companies | Yes | Yes | Contract + generator + components |

The rule behind the ordering: **custom differences are data, not code.** Reach for A or B
first. Path C is for when the difference must be a real, queryable, typed column. Path D
is for when the *behaviour* must differ. Path E is a different job entirely.

---

## Path A: add a field with no code at all

Use this when one company needs a few extra data points on a form and you do not need
them in reports, joins or custom SQL. The definition goes in a catalog table, the values
live in a `jsonb` column, and **nothing is compiled, generated or deployed**.

This is backed by `sql/12_customfields.sql` and `/api/customfields` — see
[Custom fields](04-sql-and-contract.md#custom-fields) for the SQL
and [Custom fields](03-api.md#custom-fields) for the endpoint reference.

### Step 1 — check the entity is supported

The `entity` must exist in `server/_contract.json`'s `entities` map, which maps a form id
to a real table:

```json
"frmCustomer": "tblfrmCustomer"
```

A caller-supplied table name is never accepted, so this whitelist is the boundary. 14
entities are supported: `frmBrand`, `frmCategoryOptions`, `frmCustomer`, `frmDeptSale2`,
`frmDeptSale3`, `frmGoodsInward`, `frmgoodsoutward`, `frmhsn`, `frmItem`,
`frmItemCategory`, `frmitemno`, `frmItemNoDyn`, `frmPackingCategory`, `fromProcess`.

### Step 2 — define the field

```powershell
curl -X POST http://localhost:3100/api/customfields/defs `
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" `
  -d '{
        "entity": "frmCustomer",
        "field_key": "frmCustomer.gst_no",
        "label": "GST No",
        "data_type": "text",
        "ordinal": 10
      }'
```

```json
{ "status": "Success",
  "def": { "field_key": "frmCustomer.gst_no", "label": "GST No",
           "data_type": "text", "options": null, "required": false, "ordinal": 10 } }
```

Rules, all enforced server-side:

- `field_key` must be `entity.field_name` — the entity segment keeps its real casing, the
  field segment is lower snake case. So `frmCustomer.gst_no` is right and
  `frmcustomer.gst_no` is rejected.
- `label` is required; `data_type` ∈ `text`, `number`, `date`, `bool`, `lookup`.
- The definition belongs to **whichever database the token's company points at**, so
  running this as `ash1` defines it for `ash1` only. `xerp` never sees it.

On first use the route calls `sp_cf_ensure`, which idempotently adds
`"Custom" jsonb NOT NULL DEFAULT '{}'` to `tblfrmCustomer` plus a GIN index. There is no
migration step and no DDL for you to write.

### Step 3 — render it

The generic forms do not read the catalog yet, so you add the inputs yourself. In
`src/companies/<id>/forms/<formId>/AddEditPage.jsx`, add a field entry (copy the company
folder with `_copyform.mjs` first — see [Path D](#path-d-override-the-whole-form-component)),
then merge the stored values on load and send them back on save:

Two things to get right here:

- `hdr1` from `_EDIT_JSON` does **not** contain the custom values. `DFE1` declares an
  explicit `RETURNS TABLE` and never selects the `Custom` jsonb column, so reading
  `row.Custom` gives `undefined`. The values arrive from a **separate**
  `GET /customfields/values` call.
- `src/api.js` has no `apiPut` helper (only `apiGet`, `apiPost`, `apiDelete`), and
  `sp_cf_save_values` is reached with `PUT`. Add the helper, or call `fetch` directly.

```jsx
// load: the normal _EDIT_JSON gives the header row …
const ed = await apiCall('_EDIT_JSON', formId, { id: recordId });
setFormData((f) => ({ ...f, ...(ed.hdr1?.[0] || {}) }));

// … and the custom values come from their own endpoint, keyed by record id
const cv = await apiGet(
  `/customfields/values?entity=${encodeURIComponent(formId)}&ids=${recordId}`);
const custom = cv.values?.[String(recordId)] || {};
setFormData((f) => ({ ...f, gst_no: custom.gst_no ?? '' }));

// save: the normal _SAVE/__UPDATE params, then the custom values separately
const r = await apiCall(recordId ? '_UPDATE' : '_SAVE', formId,
                        recordId ? { id: recordId, params: formData } : { params: formData });
const savedId = recordId || r.det1?.[0]?.id;
await fetch('/api/customfields/values', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
  body: JSON.stringify({ entity: formId, id: savedId,
                         values: { 'frmCustomer.gst_no': formData.gst_no } }),
});
```

On a **list** page, do the same per batch: the grid gives you ids, then one
`GET /customfields/values?entity=…&ids=1,2,3,…` (up to 500) returns everything keyed by
id, which you merge onto the rows you already have. That is the intended shape of this
API, and it is why values are not folded into `Grid2`.

### Step 4 — write and read values

```powershell
# write (merge semantics)
curl -X PUT http://localhost:3100/api/customfields/values `
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" `
  -d '{"entity":"frmCustomer","id":5,"values":{"frmCustomer.gst_no":"27ABCDE1234F1Z5"}}'
# → { "status": "Success", "id": 5, "result": "ok:1" }

# read for a grid page (at most 500 ids)
curl "http://localhost:3100/api/customfields/values?entity=frmCustomer&ids=5,6,7" `
  -H "Authorization: Bearer $TOKEN"
# → { "status": "Success", "entity": "frmCustomer",
#     "values": { "5": { "gst_no": "27ABCDE1234F1Z5" } } }
```

Two behaviours worth internalising:

- **Merge, not replace.** A key present in the payload is written (a blank value clears
  it); a key absent is left alone. So a full-form submit behaves like a replace while a
  single-field patch behaves like a merge, and two people editing different fields of the
  same record don't overwrite each other.
- **Values are not in `Grid2`.** `GET /customfields/values` is a separate call that
  returns values keyed by id, which the client merges onto the grid rows it already has.
  Folding it into `Grid2` would mean a different compiled procedure per company, which is
  exactly what this design avoids.

### Limitations of Path A

- Values are JSON, so they are not typed columns — no index, no constraint, no
  `JOIN ... ON`, and no aggregation in reports without `jsonb` operators.
- Nothing reads the catalog automatically; Step 3 is on you.
- Deactivating a field (`DELETE /defs/:key`) sets `"Active" = false` rather than deleting
  the row, so stored values survive. There is no UI to bring it back — re-POST the same
  `field_key`, which reactivates it.
- The SQL layer **refuses to re-type a field that already holds values**.

**Use Path C instead** if any of that matters to you.

---

## Path B: change a form with a partial `form.json`

Use this when the difference is presentation: hide a field, relabel it, change which
columns the grid shows, reorder search fields. **No JavaScript, no SQL.**

A company override is a *partial* config that is **deep-merged** over the shared
`form.json` by `GET /api/form-config/:formId?appId=<id>`. Merge rules:

- objects merge recursively;
- arrays whose entries all carry a `name` merge **by name** — so you can flip `hidden` on
  a field the base already declares, and add a field the base does not have;
- every other array is replaced wholesale.

That is what lets an override be four lines instead of a hundred-line copy that has to be
re-merged by hand every time the shared form changes. `src/companies/bke/forms/frmDeptSale3/form.json`
and `src/companies/spartan/forms/frmDeptSale3/form.json` are real examples in the repo.

### Step 1 — create the folder

```powershell
cd server
node _copyform.mjs frmDeptSale3 bke
```

This copies the whole folder (including the `.jsx` files) and re-bases relative imports.
If you only want the config, just create the file by hand:

```
src/companies/bke/forms/frmDeptSale3/form.json
```

### Step 2 — write only what differs

```json
{
  "title": "Department Sale (BKE)",
  "headerFields": [
    { "name": "Transport", "hidden": true },
    { "name": "SalesResponsible", "label": "Sales Owner", "required": true }
  ],
  "csvComma": "FCODE,LedgerGroup,Currency,Country,State,CustomerGroup"
}
```

- `{ "name": "Transport", "hidden": true }` hides a field the base already declares.
- `{ "name": "SalesResponsible", … }` changes a field the base already declares.
- An entry with a `name` the base does **not** have is **added**.
- `csvComma` replaced wholesale — it is a string, so this is a straight override.

### Step 3 — verify

Restart isn't needed; the config is cached 15s on both sides, and `Ctrl+Q` in the app
clears both caches and remounts the form. Check:

```powershell
curl "http://localhost:3100/api/form-config/frmDeptSale3?appId=bke" -H "Authorization: Bearer $TOKEN"
```

`appliedOverride: "bke"` and `isCommon: false` confirm the override was found. Log in as
`bke` and confirm the field is gone.

### What Path B does *not* do

It does **not** change which stored procedure is called. `server/src/routes/crud.js` has
its own `loadFormConfig` that reads only `src/forms/<formId>/form.json` — it is
**common-only**, unlike `/api/form-config`. So renaming a procedure in a company
`form.json` changes the UI config but is ignored by procedure resolution. If you need
different procedure names for one company, that is Path C territory.

---

## Path C: add a real column for one company

Use this when the extra data must be a real typed column: you want it in reports, in
`JOIN`s, indexable, or constrained. This is the full mechanism, and the `ash1`
`TestField` in this repo is a complete worked example of it.

Five artefacts, and **the procedure signatures and the field order must change
together** or values will be written into the wrong column.

```
src/companies/ash1/
├─ fieldOrder.json                      where the new field goes in the argument list
├─ sql/01_frmcustomer_testfield.sql     ALTER TABLE + the 3 rewritten sp_* procedures
└─ forms/frmCustomer/
   └─ AddEditPage.jsx                   the input
```

### Step 0 — understand why this is delicate

`sp_*` procedures are called **positionally**:

```
(<fields…>, formId, FCODE, auth, '')
```

A new field must sit **immediately before those four trailing system parameters**.
There is no name-based binding, so if `fieldOrder.json` says the field is #29 and the
procedure's 29th parameter is something else, PostgreSQL accepts the call and writes each
value into its neighbour — returning `Success`. This is the single most dangerous failure
mode in this codebase.

The order is: shared `server/_contract.json` `headerFields` (or `detFields`) → layered with
`src/companies/<id>/fieldOrder.json`. See
[Positional parameters](02-request-flow.md#positional-parameters).

### Step 1 — copy the form into the company folder

```powershell
cd server
node _copyform.mjs frmCustomer ash1
```

Copies `src/forms/frmCustomer/` → `src/companies/ash1/forms/frmCustomer/` and re-bases
relative imports (resolve, then re-relativise, so the extra directory level is handled
and bare specifiers like `react` are left alone). It refuses to overwrite an existing
folder without `--force` — silently replacing a company's edits with the shared version
would be the worst possible outcome.

For a one-line config change you can skip this and use [Path B](#path-b-change-a-form-with-a-partial-formjson).

### Step 2 — declare the field order

Create `src/companies/ash1/fieldOrder.json`:

```json
{
  "_comment": "Why this file exists, and that it only makes sense together with sql/",
  "frmCustomer": {
    "header": {
      "append": ["TestField"]
    }
  }
}
```

Three operations, applied in this order per form and per kind (`header` / `det`):

| Key | Effect |
|---|---|
| `replace` | use exactly this list, ignoring the contract |
| `prepend` | these names first, then the contract list |
| `append` | contract list, then these names — **this is what puts a new field last, right before the system parameters** |

Rules:

- An override for a form the contract does not know about is **ignored with a warning**
  (`[fieldOrder] <formId> (<kind>) is not in _contract.json, ignoring override`). There
  is no base list to extend, and a partial order would silently shift every later argument
  into the wrong column.
- The resolved order is cached **per company**, keyed on the same company id `getPool()`
  uses, so the two can never disagree.
- It is keyed on the file's **mtime**, so editing `fieldOrder.json` takes effect on the
  next request — no restart.
- An override applies to **one form and one kind**. To change a detail field you use the
  same file with a `det` key.

### Step 3 — write the company SQL

Create `src/companies/ash1/sql/01_frmcustomer_testfield.sql`. It needs three things:

**(a) the column**

```sql
ALTER TABLE public."tblfrmCustomer"
  ADD COLUMN IF NOT EXISTS "TestField" text NOT NULL DEFAULT '';
```

`NOT NULL DEFAULT ''` because the legacy tables are `NOT NULL` and blank text must store
`''`, never `NULL`.

**(b) `SAVE` with the extra parameter** — drop every existing overload first, because
`CREATE OR REPLACE` cannot change a parameter list:

```sql
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sp_frmCustomer_SAVE'
  LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmCustomer_SAVE"(
  p_ledgercode text, …, p_issupplier text,   -- the 28 existing header fields
  p_testfield text,                          -- ← #29, immediately before the system params
  p_frmcustomer_frm text, p_frmcustomer_fcode text,
  p_frmcustomer_auth text, p_frmcustomer_unused text)
 RETURNS TABLE(status text, message text, id bigint, "Error" text)
 LANGUAGE plpgsql AS $function$
 DECLARE v_uid text; v_id bigint;
 BEGIN
   SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmcustomer_auth;
   v_uid := COALESCE(NULLIF(v_uid, ''), p_frmcustomer_auth);
   INSERT INTO public."tblfrmCustomer" (…, "TestField", "User_Id", "FCODE")
   VALUES (…, COALESCE(NULLIF(p_testfield, ''), ''), v_uid,
           COALESCE(NULLIF(p_frmcustomer_fcode, ''), 'HO'))
   RETURNING "Id" INTO v_id;
   RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
 EXCEPTION WHEN OTHERS THEN
   RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
 END
 $function$;
```

**(c) `UPDATE` and `DFE1`**

- `UPDATE` = `p_frmcustomer_id` first, then all 29 fields, then the four system
  parameters. Add the column to the `SET` list.
- `DFE1` keeps its four parameters but its `RETURNS TABLE` is an **explicit column list**,
  so you must append the new column there too. The existing `ash1` file explains why in a
  comment worth repeating: *without this override the value would save fine and then come
  back blank.*

The `ash1` file is the reference implementation — read it before writing your own:

```
src/companies/ash1/sql/01_frmcustomer_testfield.sql
```

Note it overrides **three** procedures (`SAVE`, `UPDATE`, `DFE1`) and **not** `Grid2`. A
new column therefore does not appear in the grid until `sp_frmCustomer_Grid2` also returns
it (nor in `PRINT_ROW1`, which feeds the print page). That gap is real and currently open.

Also note the coercion style, which you should copy: `COALESCE(NULLIF(x, ''), '')` for
text, a regex guard for numbers
(`CASE WHEN trim(p_crlimit) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_crlimit::numeric ELSE 0 END`),
and a whitelist for booleans
(`CASE WHEN lower(trim(p_x)) IN ('true','1','t','y','yes','on') THEN true ELSE false END`).

### Step 4 — apply it, to that company only

```powershell
node server/_migrate.mjs ash1
```

Applies `src/companies/ash1/sql/*.sql` (sorted) to **ash1's database only**. "applying
ash1's DDL to xerp would be a data incident, not a migration."

Flags: `--status`, `--dry-run`, `--force`. One transaction per file. Tracks
`(company, file, hash)` in `public.company_migration` where
`hash = sha256(contents).slice(0,16)`, reports `pending` / `applied <ts>` /
`CHANGED since it ran`, and **re-runs a file whose hash changed**. It resolves the
database through the same registry as the server, so "which DB is this company" has one
answer.

```powershell
node server/_migrate.mjs ash1 --status
```

### Step 5 — add the input

In `src/companies/ash1/forms/frmCustomer/AddEditPage.jsx`, add the field in the
`headerFields` array:

```jsx
{ name: 'TestField', label: 'Test Field (ash1 only)', type: 'text',
  width: '6,6,6,6', source: '', classes: '' }
```

A component override **replaces** the shared component wholesale, so the position of
this entry is the form's field order as far as the UI is concerned. It does not have to
match `fieldOrder.json` — the UI sends `params` as an object and the server re-orders it.
But keep them consistent anyway, and read the `ash1` file's comment on the subject: the
position here has to agree with `p_testfield` in the SQL, because the procedures are
positional.

Then, in the same file, make sure `_SAVE` / `_UPDATE` send the value — check the
`params` object it builds includes `TestField`.

### Step 6 — verify

```powershell
# the column is only in ash1
psql -U xerp -d ash1 -c "\d tblfrmCustomer" | Select-String TestField
psql -U xerp -d xerp -c "\d tblfrmCustomer" | Select-String TestField   # expect nothing
```

Then, in the app, logged in as `ash1`: open Customer Master → Add → the field appears →
Save → reopen → the value is there. And logged in as `xerp`: the field does not exist.

There is a purpose-built harness for exactly this: `node server/_tf.mjs` (12 checks) and
`node server/_hotreload.mjs` (2 checks, for the `fieldOrder.json` live reload). See
[08 — Testing](08-testing.md).

### Checklist

| # | Step | File | ✅ |
|---|---|---|---|
| 1 | form copied into the company | `src/companies/<id>/forms/<formId>/*` | ☐ |
| 2 | field order declared | `src/companies/<id>/fieldOrder.json` | ☐ |
| 3 | column added | `src/companies/<id>/sql/NN_*.sql` | ☐ |
| 4 | `SAVE` signature + insert updated | same SQL file | ☐ |
| 5 | `UPDATE` signature + `SET` updated | same SQL file | ☐ |
| 6 | `DFE1` `RETURNS TABLE` + select updated | same SQL file | ☐ |
| 7 | `Grid2` updated **if the grid should show it** | same SQL file | ☐ |
| 8 | applied to that company only | `node _migrate.mjs <id>` | ☐ |
| 9 | input added | `AddEditPage.jsx` in the company folder | ☐ |
| 10 | verified present in one company, absent in another | — | ☐ |

> ⚠️ Steps 2, 3–5 are one atomic change. Field order and procedure signatures must be
> edited in the same commit, and the migration must be applied to the same company.

### Rolling it back

The `ash1` file documents it in a header comment, but do it in this order: drop the
procedures, drop the column, then remove the `fieldOrder.json` entry and the JSX input.
Dropping the column before the procedures leaves procedures referencing a missing column.
`_migrate.mjs` has no `down` mode — write a `NN_*.sql` that reverses the change and run
it, and remember the hash tracking will apply it once.

---

## Path D: override the whole form component

Use this when React *behaviour* must differ — different validation, a computed field, a
totals row, a completely different page. This is a full replacement, not a merge: a
company's `AddEditPage.jsx` replaces the shared one completely, and you own keeping it in
sync with upstream changes to the shared version.

```powershell
cd server
node _copyform.mjs frmCustomer ash1
```

You get:

```
src/companies/ash1/forms/frmCustomer/
├─ form.json      (edit if the layout differs, or shrink it to a partial override)
├─ ListPage.jsx
├─ AddEditPage.jsx
└─ PrintPage.jsx
```

`src/formRegistry.js` resolves the company path first and falls back to the shared path, so
you can override just one of the three:

```js
companyComponents[`./companies/${appId}/forms/${formId}/${componentName}.jsx`]  // wins
baseComponents[`./forms/${formId}/${componentName}.jsx`]                        // fallback
```

Notes:

- The glob is resolved at **build time**, so a newly added company component appears after
  a rebuild (Vite dev usually notices; production needs `npm run build`).
- `_copyform.mjs` re-bases relative imports — the copy sits two directories deeper, so
  `../../api` becomes `../../../../api`. Bare specifiers (`react`, `bootstrap`) are left
  alone.
- It never overwrites without `--force`.
- If the company also has its own columns, you still need Path C's `fieldOrder.json` and
  `sql/*.sql`; the script reminds you.

## Path E: add a brand-new form for everyone

A different job: this changes the shared system, not one company. Sketch:

1. **Contract.** Add `forms.<formId>` (with `headerFields`, `searchFields`, `formType`) and
   `entities.<formId>` → the base table, plus the `tables.<table>` column snapshot the
   generator needs. See [The contract](04-sql-and-contract.md#the-contract).
2. **Shared form folder.** `src/forms/<formId>/` with `form.json`, `ListPage.jsx`,
   `AddEditPage.jsx`, and `PrintPage.jsx` if it prints. `form.json` declares the `sp`
   names; the CRUD route resolves from it.
3. **Generate the SQL.** `node server/_gen.mjs` writes
   `sql/10_forms/10_<formId>.sql` and rebuilds `10_forms_all.sql`, from the contract plus
   live-database introspection. It needs a live `xerp` database to read `NOT NULL` columns
   and has a hardcoded root path. See
   [The generator](04-sql-and-contract.md#the-generator-_genmjs).
4. **Install into every company's database.** `_provision.mjs <id>` is idempotent-ish and
   safe to re-run against an existing company (all layers are `IF NOT EXISTS` /
   `OR REPLACE`, and the seed is guarded). Run it per company.
5. **Menu entry.** The menu comes from each database's `tblWebMenus` via `sp_get_menus`, so
   add a row per company (the Security screens, or `sp_sec_menu_save`).
6. **Test.** [08 — Testing](08-testing.md).

## Choosing between A and C — a short decision guide

| Question | Answer | Path |
|---|---|---|
| Does it need to appear in a report or a `JOIN`? | yes | C |
| Does it need to be indexed, `NOT NULL`, or numeric? | yes | C |
| Will more than a handful of records have it? | yes | C |
| Is it a one-off note or a small set of extra attributes? | no | A |
| Do you just want it hidden, relabelled, or off the grid? | — | B |
| Does the *page* need to behave differently? | yes | D |
| Should every company have it? | yes | E |

Note that A and C can coexist: a company can have a real `TestField` column *and* ad-hoc
catalog fields, because they live in different places.

## Where to go next

- Why the argument order matters: [02 — Request flow](02-request-flow.md#positional-parameters)
- The SQL conventions to follow: [04 — SQL and the contract](04-sql-and-contract.md)
- Endpoint reference for Path A: [03 — API reference](03-api.md#custom-fields)
- The live example to copy from: `src/companies/ash1/` and its `README.md`
- Verifying your change: [08 — Testing](08-testing.md)
