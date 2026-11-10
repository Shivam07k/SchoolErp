# 07 â€” Tools and scripts

Every script in `server/` and `sql/`, what it does, and how to run it. Most take no
arguments; the ones that matter for daily work are the company tools at the top.

Run them from `server/` unless stated otherwise. Unless noted they connect to
`localhost:5432` as `xerp` / `<local-db-password>` â€” a few have that hardcoded.

## The ones you will actually use

| Script | Purpose |
|---|---|
| [`_provision.mjs`](#provision-a-company-_provisionmjs) | create a company database and install the schema |
| [`_clone.mjs`](#clone-a-database-_clonemjs) | copy a company database, optionally register + scaffold it |
| [`_migrate.mjs`](#company-sql-migrator-_migratemjs) | apply `src/companies/<id>/sql/` to that company only |
| [`_copyform.mjs`](#copy-a-form-into-a-company-_copyformmjs) | copy a shared form into a company folder, re-basing imports |
| [`_gen.mjs`](#generate-form-sql-_genmjs) | regenerate form SQL from the contract + live database |
| [`_sql.mjs`](#apply-ad-hoc-sql-_sqlmjs) | apply one `.sql` file or a whole directory |
| [`setup.mjs`](#first-time-setup-setupmjs) | first-time install into the default database |
| [`_iso.mjs`](#isolation-_isomjs) | prove two companies cannot see each other's data |
| [`_tf.mjs`](#testfield-round-trip-_tfmjs) | prove the company-only field round-trips and xerp is untouched |

---

## Provision a company: `_provision.mjs`

```
node _provision.mjs <companyId> [--label "Display Name"] [--admin-password pw] [--drop]
```

Creates a database named after the id and installs the app into it: the fixed
[layer order](04-sql-and-contract.md#install-order), one transaction per file, printing
`ok <file> (<ms>ms)`. Then optionally sets `fn_companyname()` from `--label` and sets the
`ADMIN` password (from `--admin-password` or a generated random one, bcrypt cost 10) **only
if the hash is currently empty**. Finishes with a verification line and the registry entry
to paste.

Idempotent-ish: re-running against an existing company only re-applies layers, all of
which are `IF NOT EXISTS` / `OR REPLACE`. âš ï¸ `--drop` deletes the database first â€” it is
NOT safe, and it refuses to run on the default company.

Needs a role with `CREATEDB`:

```powershell
psql -U postgres -c "ALTER ROLE xerp CREATEDB"   # once
node _provision.mjs ash1 --label "Ash1" --admin-password "pick-something"
```

Full walkthrough: [05 â€” Add a company](05-add-a-company.md#path-a-provision-a-fresh-company).

## Clone a database: `_clone.mjs`

```
node _clone.mjs <newId> [options]

  --from <id>          source company (default: the registry default)
  --db-name <name>     target database name (default: <newId>)
  --label <text>       display label (default: <newId>)
  --host/--port/--user/--password
  --password-env <V>   read the target password from env var V
  --owner <role>       owner of the new database (default: the target user)
  --no-register        copy only, do not touch companies.json
  --no-folder          do not create src/companies/<id>/
  --drop               drop the target first if it already exists
  --dry-run            print the plan and exit
  --list               show the registered companies and exit
  --help               print this list
```

`--keep-tokens` and `--keep-name` are honoured in the code but not in the help text.

Same server â†’ `CREATE DATABASE â€¦ WITH TEMPLATE` (a file copy). Different server â†’
`pg_dump --format=custom` piped into `pg_restore --no-owner --no-privileges`.

By default it also clears the copied `tblHO_User.token` values (otherwise a source token
would still validate on the copy), resets `fn_companyname()`, appends the registry entry,
and creates `src/companies/<id>/` with a `README.md`. It refuses to overwrite an
existing database or an already-registered id without `--drop`, and a same-server copy
**terminates other sessions on the source** â€” live requests can fail for that second.

âš ï¸ The cross-server path does not create the target database or set up its SSL, and has
not been tested against a live second server. `--dry-run` first.

```powershell
node _clone.mjs mumbai --from xerp --label "Mumbai Branch" --dry-run
node _clone.mjs mumbai --from xerp --label "Mumbai Branch"
node _clone.mjs --list
```

## Company SQL migrator: `_migrate.mjs`

```
node server/_migrate.mjs <companyId>            apply everything pending
node server/_migrate.mjs <companyId> --status   list applied / pending
node server/_migrate.mjs <companyId> --dry-run  show what would run
node server/_migrate.mjs <companyId> --force     re-run even if unchanged
```

Applies `src/companies/<id>/sql/*.sql` (sorted) to that company's database **only**.
Tracks `(company, file, hash)` in `public.company_migration` with
`hash = sha256(contents).slice(0,16)`; a file whose hash changed since it ran is re-run
automatically. One transaction per file, rollback and exit 1 on failure. Resolves the
database through the same registry the server uses, so there is one answer to "which
database is this company".

```powershell
node server/_migrate.mjs ash1 --status
node server/_migrate.mjs ash1 --dry-run
node server/_migrate.mjs ash1
```

## Copy a form into a company: `_copyform.mjs`

```
node server/_copyform.mjs <formId> <companyId> [--force]
```

Copies `src/forms/<formId>` â†’ `src/companies/<companyId>/forms/<formId>` and re-bases
relative imports (resolve, then re-relativise, so the extra directory level is handled and
bare specifiers are untouched). **Never overwrites without `--force`.** If the company has
its own columns it reminds you to also add `fieldOrder.json` and `sql/*.sql`.

## Generate form SQL: `_gen.mjs`

```powershell
node _gen.mjs
```

No arguments, not wired to an npm script. Reads `server/_contract.json` plus **live
`information_schema` introspection from the `xerp` database**, and writes
`sql/10_forms/10_<formId>.sql` (Ã—14), `sql/10_forms/10_shared.sql` and
`sql/10_forms_all.sql`. Then back-writes `detFields` into the contract if they changed.

âš ï¸ It has a **hardcoded root path** (`C:/Users/hp/Desktop/exp/pg-xerp`) and a hardcoded
`xerp` connection. Both must be edited if your tree or credentials differ. It also needs
the `xerp` database to be up, because NOT NULL columns drive the generated defaults.

Details: [The generator](04-sql-and-contract.md#the-generator-_genmjs).

## Apply ad-hoc SQL: `_sql.mjs`

```powershell
node _sql.mjs sql/11_security.sql     # one file
node _sql.mjs sql                     # every .sql in a directory
```

The general sibling of `_apply.mjs`; use it for layer scripts like `11_security` or
`12_customfields`. No transaction wrapper and no per-file status, so read the output.

## First-time setup: `setup.mjs`

```powershell
node setup.mjs           # schema + seed (incl. bcrypt password hashes)
node setup.mjs --demo    # also load 100k brands
```

Applies the SQL migrations to the **default** database and bcrypts the seeded password
hashes. This is the original single-database installer; for adding a second company use
`_provision.mjs` instead.

## Apply generated form SQL: `_apply.mjs`

```powershell
node _apply.mjs
```

Development helper: applies every file in `sql/10_forms/` to the `xerp` database, each in
its own transaction, printing `ok`/`FAIL`, then verifies the three detail foreign-key
indexes (`tblGoodsSaleDet.GoodsSale_id`, `tblfrmGoodsInwardDet.tblfrmGoodsInward_Id`,
`tblGoodsOutwardDet.GoodsOutward_ID`). Pinned to `xerp` with a hardcoded path. Use
`_sql.mjs` for anything else.

## Seed bulk data: `_seed.mjs`

```powershell
node _seed.mjs            # target 1,000,000 rows per table
node _seed.mjs 100000     # target 100,000
```

Inserts into every form table **and** detail table, in batches of 50,000. Idempotent: skips
any table already at or over the target. Use for grid performance work â€” see
[08 â€” Testing](08-testing.md#performance).

---

## Diagnostics

### `_pages.mjs`

```powershell
node _pages.mjs
```

Exercises **every** page in `src/forms` and reports pass/fail per page. The broad
regression suite. âš ï¸ Run it only against a company you are willing to write to â€” see
[Testing safely](08-testing.md#stay-out-of-trouble).

### Isolation: `_iso.mjs`

```powershell
node _iso.mjs
```

Per-company isolation, end to end. The question it answers is not "does the API return
200" but: given two logins, does each land in its **own** database and nowhere else. It
writes marker rows in both and checks they do not cross over.

### Second-company coverage: `_sep.mjs`

```powershell
node _sep.mjs
```

Checks the claims the `_pages` suite never covered, because that suite only runs against
`xerp`: that the session token really is stored per company database, that a form override
in a **real** company folder is served to that company only, and that the other route
groups (menu, security, custom fields) work on `ash1`.

### Clone verification: `_clone_check.mjs`

```powershell
node _clone_check.mjs
```

Verifies a clone is a fully working, independent company: the running server picked it up
from `companies.json` **with no restart**; login works and it names itself correctly; a
token minted for the **source** company is refused on the clone (which is what clearing
the copied session tokens prevents); the clone's data is its own; and all three companies
are simultaneously reachable and distinct. Run it after `_clone.mjs`.

### Registry resilience: `_cfg.mjs`

```powershell
node _cfg.mjs
```

The registry is a file people edit by hand, so its failure modes matter: a typo must never
take the server down or point a company at the wrong database. This restores the original
file on exit and exercises the bad cases.

### Company name / login wiring: `_cn.mjs`

```powershell
node _cn.mjs
```

Checks the `ash1` company-name and login path directly.

### TestField round-trip: `_tf.mjs`

```powershell
node _tf.mjs
```

Does the ash1-only `TestField` round-trip **and** checks xerp stays untouched. It covers
the whole chain: the field has to land in the right positional slot â€” *a misordered field
writes into `IsSupplier` and still returns `Success`, so success alone proves nothing* â€”
come back through `DFE1`, and be invisible to `xerp`, which must also still save its
28-field form correctly. Cleans up after itself.

### FieldOrder live reload: `_hotreload.mjs`

```powershell
node _hotreload.mjs
```

Proves editing `src/companies/ash1/fieldOrder.json` takes effect without a server restart,
by appending a second field so the route must send 30 fields to a 33-parameter procedure â€”
which has to fail loudly. If it fails, the file is being re-read live; if the save still
succeeds, the order is stale.

âš ï¸ It deliberately leaves two successful `HOTRL` rows behind. Clean them up afterwards:

```sql
DELETE FROM tblfrmCustomer WHERE "LedgerCode" LIKE 'HOTRL%';
```

### Custom fields over HTTP: `_cf.mjs`

```powershell
node _cf.mjs
```

End-to-end exercise of `/api/customfields` â€” definitions, values, merge semantics,
deactivation, and the validation rejections.

### Custom-field SQL: `_cfv.mjs`

```powershell
node _cfv.mjs
```

Verifies the `sp_cf_*` functions at the SQL level, without HTTP.

### `_auth.mjs` and `_tok.mjs`

Shared helpers, not standalone checks. Both exist to keep the test scripts honest:

- `_tok.mjs` caches a bearer token for the local check scripts. Each script used to log in
  on every run, and the login limiter allows only 10 attempts per 15 minutes â€” so running
  three checks in a row made the third measure 401s instead of query time.
- `_auth.mjs` adds the subtler fix: `tblHO_User.token` is a **single-session pointer**, so
  a later login to the same company silently invalidates a cached JWT (its signature still
  verifies but no longer matches the user's row). It re-mints when that happens.

### Grid performance: `_page.mjs` and `_cc2.mjs`

```powershell
node _page.mjs      # paging latency for one form
node _cc2.mjs       # cold vs cached counts, guaranteed-cold then repeat
```

`_cc2.mjs` measures a cold count over `frmhsn` (222k rows) and then five repeats, to show
the 15s row-total cache doing its job.

---

## Introspection and one-off queries

| Script | What it does |
|---|---|
| `_schema.mjs` | prints columns, NOT NULL counts and unique indexes for the 17 form/detail tables |
| `_diff.mjs` | compares two databases (hardcoded `xerp` vs `ash1`) â€” tables, columns, functions, row counts |
| `_snap.mjs <tag>` | writes `snap_<tag>.json`, a before/after snapshot to diff against |
| `_auth.mjs`, `_tok.mjs` | see above |

`_diff.mjs` is the quickest way to answer "what is actually different between these two
companies?" â€” much more useful than eyeballing `form.json` files.

## The older PowerShell generators in `sql/`

Six scripts â€” `_regen.ps1`, `_regen-11.ps1`, `_batch-generate.ps1`, `_generate-ports.ps1`,
`port-gen.ps1`, `generate_ports.ps1` (plus the `_run-generate-and-test.ps1` wrapper) â€” all
wrote `sql/port_<formId>.sql`. **No `port_*.sql` files exist any more**: their output was
promoted into the `06_`/`07_` files and then superseded by `_gen.mjs`'s `10_` layer.
They are historical, not part of the live chain. Don't reach for them.

`_run-generate-and-test.ps1` is a three-line wrapper around `_batch-generate.ps1`.

## Conventions across all of them

- `.mjs` ES modules, run with `node`, from `server/`.
- Database credentials are hardcoded in most of them (`localhost:5432`, `xerp`,
  `<local-db-password>`). They are developer scripts, not part of the server.
- **Several of them write to `xerp`.** Before running anything that is not obviously
  read-only, read the first 20 lines and check which database it targets. See
  [Stay out of trouble](08-testing.md#stay-out-of-trouble).
- The broader scripts (`_pages`, `_iso`, `_sep`, `_cf`, `_cn`, `_clone_check`, `_tf`) talk
  to the **running API** on `localhost:3100` â€” start the server first. The rest connect to
  PostgreSQL directly.
- Exit code 0 means pass; the counting harnesses print `ok` / `x` per check and a summary.

## Where to go next

- What each company tool does in detail: [05 â€” Add a company](05-add-a-company.md)
- The SQL layer these tools install: [04 â€” SQL and the contract](04-sql-and-contract.md)
- Running the checks safely: [08 â€” Testing](08-testing.md)
