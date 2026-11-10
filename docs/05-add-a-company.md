# 05 â€” Add a company

Every step of adding a company to the system, from nothing to a working login. Two
paths:

- **[A. Provision a fresh company](#path-a-provision-a-fresh-company)** â€” a new empty
  database with the full schema installed. This is the normal path.
- **[B. Clone an existing company](#path-b-clone-an-existing-company)** â€” copy an
  existing company's schema *and data* as a starting point.

A company is **one PostgreSQL database** whose name is the company id. Nothing else in
the system needs to change to support it.

## Before you start

### Prerequisites

| Requirement | How to check |
|---|---|
| PostgreSQL 16+ running | `psql -U postgres -c "select version()"` |
| The `xerp` role can create databases | see below |
| The SQL layer installed once | `sql/00_init_db.sql` applied |
| `server/config/companies.json` exists | it does, in the repo |

The app role `xerp` deliberately does **not** have `CREATEDB`. Grant it once, as a
superuser:

```powershell
psql -U postgres -c "ALTER ROLE xerp CREATEDB"
```

`_provision.mjs` and `_clone.mjs` connect to `localhost:5432` as `xerp` with the
password hardcoded in the script (`<local-db-password>`). If your local setup differs, edit `DB` at
the top of the script.

### Pick an id carefully

The id must match `^[A-Za-z][A-Za-z0-9_]{0,30}$` and it becomes:

- the **database name**,
- the key in `companies.json`,
- the folder name `src/companies/<id>/`,
- the login-screen id,
- the default `FCODE` source for its forms.

Changing it later means renaming the database, the folder, and the registry entry.

---

## Path A: Provision a fresh company

### Step 1 â€” create the database and install the schema

```powershell
cd server
node _provision.mjs mumbai --label "Mumbai Branch" --admin-password "pick-something"
```

Usage:

```
node _provision.mjs <companyId> [--label "Display Name"] [--admin-password pw] [--drop]
```

What it does, in order:

1. Validates the id. Refuses `--drop` on the default company (`xerp`).
2. Connects to the `postgres` maintenance database as `xerp`. If that fails it prints
   the `ALTER ROLE xerp CREATEDB` hint and exits 1.
3. With `--drop`: terminates other sessions on the target, then
   `DROP DATABASE IF EXISTS "<id>"`.
4. Creates `CREATE DATABASE "<id>" OWNER xerp`, or notes that it already exists and will
   re-apply the layers.
5. Connects to the new database and applies this **fixed layer order**, one transaction
   per file, printing `ok <file> (<ms>ms)`:

   ```
   01_schema.sql
   02_functions.sql
   03_frmCategoryOptions.sql
   03_seed.sql
   04_companyname.sql
   06_*.sql            (sorted)
   10_forms_all.sql
   11_security.sql
   12_customfields.sql
   ```

   A missing file is skipped with `skip <f> (not found)`. A failure rolls that file back,
   prints `FAIL`, and exits 1. The `07_*` files are deliberately not in this list.
6. With `--label`: overrides `fn_companyname()` to return that label.
7. Sets the `ADMIN` password â€” from `--admin-password`, or a random
   `crypto.randomBytes(9)` value, bcrypt cost 10 â€” **only if `PasswordHash` is currently
   empty**, and prints it once. (`03_seed.sql` creates `ADMIN` with no hash on purpose,
   so a fresh company is not reachable by a password that ships in the repo.)
8. Prints a verification line and the registry line to paste.

Expected output:

```
mumbai: created database
  ok   01_schema.sql (212ms)
  ok   02_functions.sql (188ms)
  â€¦
  ok   12_customfields.sql (96ms)
mumbai: fn_companyname() -> Mumbai Branch

mumbai: ADMIN password set -> pick-something

mumbai: ready  db=mumbai  name=Mumbai Branch  tables=â€¦  form_fns=â€¦  users=2
add it to server/src/config/companies.js: { id: 'mumbai', label: 'Mumbai Branch', database: 'mumbai' }
```

> âš ï¸ The last line names the wrong file â€” the registry is
> **`server/config/companies.json`**, not `companies.js`. The script's own message has
> drifted; do what it says, not where it says.

### Step 2 â€” register it

Edit `server/config/companies.json` and add the entry. For a company on the same server
with the default connection, one line is enough:

```json
{
  "default": "xerp",
  "companies": [
    { "id": "xerp",  "label": "XERP (HO)" },
    { "id": "ash1",  "label": "Ash1" },
    { "id": "mumbai", "label": "Mumbai Branch" }
  ]
}
```

For a company on **another server**, give it its own connection. Anything you omit falls
back to the shared `PG_*` environment variables; `database` defaults to `id`:

```json
{ "id": "mumbai", "label": "Mumbai Branch",
  "host": "10.0.0.9", "port": 5432,
  "user": "mumbai_app", "passwordEnv": "MUMBAI_PG_PASSWORD",
  "ssl": { "rejectUnauthorized": false } }
```

Recognised keys: `id`, `label`, `host`, `port`, `user`, `password`, `passwordEnv`,
`database`, `max`, `url`, `ssl`. Prefer `passwordEnv` over a literal `password` so the
secret stays out of the repo. Full reference: `server/config/companies.README.md`.

**No restart is needed.** `server/src/config/companies.js` re-reads the file whenever its
mtime changes, and the pool is rebuilt on the next request because its cache key is the
serialised connection config. You should see this in the API log:

```
[companies] 3 company(ies) loaded from companies.json: xerp, ash1, mumbai (default xerp)
```

### Step 3 â€” verify

```powershell
# registry is visible
curl http://localhost:3100/api/auth/companies
```

```json
{ "ok": true, "companies": [ { "id": "xerp", "label": "XERP (HO)" },
                            { "id": "ash1", "label": "Ash1" },
                            { "id": "mumbai", "label": "Mumbai Branch" } ] }
```

```powershell
# the database is alive
curl http://localhost:3100/api/healthz
```

Then log in through the UI at `http://localhost:5173` choosing **Mumbai Branch**. A user
only exists in the database that created it, so `ADMIN` in `mumbai` is a *different row*
from `ADMIN` in `xerp` â€” you can have different users, passwords, menus and data per
company.

### Step 4 (optional) â€” seed extra users and menus

`03_seed.sql` already gave you `ADMIN` and `LOADTEST`, the standard groups and
departments, and a starter menu. To change them, use the Security screens in the app
(`/api/security/*`), or SQL directly in that company's database. Remember every user must
be created in **each** company you want them to log into.

### Step 5 (optional) â€” give the company its own form overrides

Only if this company needs something different. See
[06 â€” Company custom form](06-company-custom-form.md).

```powershell
node _copyform.mjs frmCustomer mumbai
```

---

## Path B: Clone an existing company

Use this when a new company should start from an existing one's schema **and data** â€”
useful for a branch that mirrors head office before you prune it.

```powershell
cd server
node _clone.mjs mumbai --from xerp --label "Mumbai Branch"
```

Usage:

```
node _clone.mjs <newId> [options]

  --from <id>          source company (default: the registry default)
  --db-name <name>     target database name (default: <newId>)
  --label <text>       display label (default: <newId>)
  --host <h>           target server (default: the source's)
  --port <p>           target port (default: the source's)
  --user <u>           role to connect as (default: the source's)
  --password <p>       target password (default: the source's)
  --password-env <V>   read the target password from env var V
  --owner <role>       owner of the new database (default: the target user)
  --no-register        copy only, do not touch companies.json
  --no-folder          do not create src/companies/<id>/
  --drop               drop the target first if it already exists
  --dry-run            print the plan and exit
  --list               show the registered companies and exit
```

`--help` prints this list. `--keep-tokens` and `--keep-name` are also honoured in the
code, overriding the clean-login-state behaviour below.

### How it picks a method

| Condition | Method | Notes |
|---|---|---|
| target host+port == source host+port | `CREATE DATABASE â€¦ WITH TEMPLATE <src> OWNER <owner> ENCODING 'UTF8'` | fast â€” effectively a file copy |
| different server | `pg_dump --format=custom --no-owner` piped into `pg_restore --no-owner --no-privileges` | goes over the network |

The `pg_dump`/`pg_restore` binaries are found via `PG_BIN`, then `pg_config --bindir`,
then well-known install paths. `CREATE DATABASE â€¦ TEMPLATE` runs on a maintenance
database (`postgres`, else `template1`), because it cannot run while connected to the
template database or inside a transaction.

### What it does for you

By default, one command does everything:

1. Copies the database.
2. **Clears every `tblHO_User.token`** on the copy. This matters: auth checks
   `tblHO_User` in whichever database the request reached, so a token from the source
   would still validate on the copy. Override with `--keep-tokens`.
3. Resets `fn_companyname()` to the new database name. Override with `--keep-name`.
4. Verifies table, function and user counts on the copy.
5. Appends the entry to `server/config/companies.json` (writing only the fields that
   differ from the environment defaults; warns if you passed a literal `--password`).
6. Creates `src/companies/<id>/` with a `README.md`. Skip with `--no-folder`.

### Safety checks

| Situation | Behaviour |
|---|---|
| Target database already exists | refuses unless `--drop` (same-server path): `database 'x' already exists â€¦ Re-run with --drop` |
| Target id already in `companies.json` | refuses unless `--drop` |
| Same-server copy | **terminates other sessions on the source** â€” the running app reconnects on its own, but live requests can fail for that second |
| `--dry-run` | prints the whole plan and changes nothing |

Always `--dry-run` first when the target is a different server.

### Worked example: clone to another server

```powershell
node _clone.mjs mumbai --from xerp --host 10.0.0.5 --user erp `
                      --password-env MUMBAI_DB_PASSWORD --label "Mumbai Branch" --dry-run
node _clone.mjs mumbai --from xerp --host 10.0.0.5 --user erp `
                      --password-env MUMBAI_DB_PASSWORD --label "Mumbai Branch"
```

Known limitation: the cross-server path does **not** create the target database or set up
its SSL â€” `pg_restore` expects both to exist already, and it has not been tested against
a live second server. Create the database and role manually first.

### After cloning

- âš ï¸ The copy contains the source's **data**, including its users and passwords. Change
  the `ADMIN` password on the copy, or delete the users you do not want.
- âš ï¸ `src/companies/<id>/` is created **empty** apart from a `README.md`. Anything the
  source had in its own company folder is not copied â€” the copy is a database copy, not
  a code copy. Re-create overrides deliberately.

---

## After either path: the checklist

| # | Check | How |
|---|---|---|
| 1 | The database exists | `psql -U xerp -l` shows it |
| 2 | The schema installed | `psql -U xerp -d mumbai -c "\dt"` â€” expect ~30 tables |
| 3 | The form procedures exist | `psql -U xerp -d mumbai -c "select proname from pg_proc where proname like 'sp_frm%'"` â€” expect ~40 |
| 4 | It is registered | `GET /api/auth/companies` lists it |
| 5 | The pool builds | the API log shows `[companies] N company(ies) loaded`, and a request returns 200 |
| 6 | You can log in | the login screen offers it and `ADMIN` authenticates |
| 7 | Data is isolated | write a row as one company, read as the other â€” the other must not see it |

That last one is the whole point of the design; run it once per new company.

## Changing a company later

| Change | Do this |
|---|---|
| Rename the display label | edit `label` in `companies.json` â€” hot-reloaded |
| Move to another server | edit `host`/`user`/`passwordEnv` in `companies.json` â€” the pool rebuilds on the next request |
| Rename the database | `DROP`/`CREATE` or rename it, **and** update `database` in `companies.json` â€” they must not drift |
| Apply company-only DDL | add `src/companies/<id>/sql/*.sql`, then `node _migrate.mjs <id>` |
| Reset a company to a clean install | âš ï¸ `node _provision.mjs <id> --drop --admin-password <pw>` â€” **destroys all data in that database**, including custom fields. `companies.json` survives; the database does not |
| Remove a company | drop the database, remove the entry from `companies.json`, delete `src/companies/<id>/`. The server evicts the pool on the next request |

## Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `cannot reach postgres as 'xerp'` | role has no `CREATEDB` | `psql -U postgres -c "ALTER ROLE xerp CREATEDB"` |
| `cannot create database '<id>'` | same, or the role can't `CREATEDB` | as above |
| `Unknown company` on login | not in `companies.json`, or a typo in the id | add the entry; check the log line listing loaded companies |
| Login succeeds but every list is empty | a layer failed silently, or the DB has no seed | re-run `_provision.mjs <id>` (layers are idempotent) |
| `cannot change return type` while installing | the install order is one-way and a layer was replayed | rebuild: `node _provision.mjs <id> --drop --admin-password <pw>` |
| Company missing from the login screen | `companies.json` not reloaded, or `fn_companyname()` is failing | the log warns either way; the label falls back to the id |
| `Unknown company database: <id>` in the log | the token's company is no longer registered | log out and back in after editing the registry |
| Clone refuses: `already exists` | target database or registry id taken | `--drop`, or pick another id |

## Where to go next

- Making one form different for this company:
  [06 â€” Company custom form](06-company-custom-form.md)
- What the provisioning scripts actually do:
  [04 â€” SQL and the contract](04-sql-and-contract.md#provisioning-cloning-migrating)
- Every script and its flags: [07 â€” Tools and scripts](07-tools.md)
- Verifying isolation automatically: [08 â€” Testing](08-testing.md)
