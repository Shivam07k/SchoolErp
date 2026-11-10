# 08 — Testing

How to check your work, which harness to use, and — read this part twice — how not to
damage data while testing.

## Stay out of trouble

> ⚠️ **Old destructive test scripts deleted real rows from the `xerp` database.** The
> customer count went from **999,975 to 999,968** and other tables likely lost their top
> rows too. The scripts were later rewritten to own their rows (write a marker, then
> delete only what matches the marker), but anything older than that rewrite should be
> treated as destructive. There was no backup, so those rows are gone.

Practical rules:

1. **Know which database a script touches** before running it. Most hardcode `xerp`; the
   ones that talk to the API write to whichever company your token points at. Read the
   first 20 lines.
2. **Back up before bulk work.** `pg_dump` before a migration, a regeneration, or any
   script that inserts at scale.
3. **Never run a "reset" or `--drop` path casually.** `node _provision.mjs xerp --drop`
   destroys the default database.
4. **Prefer a throwaway company.** Provision one, test there, delete it. The registry edit
   is one line.
5. **Clean up after the harnesses that need it** (see below).

```powershell
# a safety net, before anything risky
pg_dump -U xerp -d xerp -Fc -f C:\temp\xerp-$(Get-Date -f yyyyMMdd-HHmm).dump
```

## The harnesses

| Script | What it proves | Needs |
|---|---|---|
| [`_tf.mjs`](#testfield-round-trip-_tfmjs) | a company-only field round-trips; xerp is untouched | API + `ash1` + `xerp` |
| [`_hotreload.mjs`](#fieldorder-live-reload-_hotreloadmjs) | `fieldOrder.json` is re-read without a restart | API + `ash1` |
| [`_pages.mjs`](#every-page-_pagesmjs) | every page in `src/forms` works | API + a database |
| [`_iso.mjs`](#isolation-_isomjs) | two companies cannot see each other's data | API + two companies |
| [`_sep.mjs`](#second-company-coverage-_sepmjs) | per-company tokens, overrides and other route groups | API + `ash1` |
| [`_cf.mjs`](#custom-fields-_cfmjs) | the custom-field API end to end | API + a company |
| [`_cn.mjs`](#company-name-_cnmjs) | company-name and login wiring | API + `ash1` |
| [`_clone_check.mjs`](#after-a-clone-_clone_checkmjs) | a clone is a working, independent company | API + three companies |
| [`_cfg.mjs`](#registry-resilience-_cfgmjs) | a bad registry edit cannot take the server down | API |
| [`_schema.mjs`](#schema-introspection-_schemamjs) | the installed schema is what you expect | PostgreSQL |

Most talk to the **running API** on `localhost:3100`. Start it first.

```powershell
# terminal 1
cd server; npm run dev

# terminal 2
cd server
node _pages.mjs
```

The current state, all green:

| Harness | Result |
|---|---|
| `_tf.mjs` | 12 passed, 0 failed |
| `_hotreload.mjs` | 2 passed, 0 failed |
| `_pages.mjs` | 334 passed, 0 failed |
| `_iso.mjs` | 20 passed, 0 failed |
| `_sep.mjs` | 24 passed, 0 failed |
| `_cf.mjs` | 29 passed, 0 failed |
| `_cn.mjs` | 10 passed, 0 failed |
| `_clone_check.mjs` | 16 passed, 0 failed |
| `_cfg.mjs` | 16 passed, 0 failed |
| Vite production build | succeeds; the ash1 override chunk contains the company-only field |

## TestField round-trip: `_tf.mjs`

The most important check if you touched the company-field mechanism. It asks a sharper
question than "does the save work":

```powershell
node _tf.mjs
```

Because `sp_*` procedures are called **positionally**, a field in the wrong slot writes
into its neighbour — `IsSupplier` in this case — and still returns `Success`. So a passing
save proves nothing on its own. `_tf.mjs` therefore checks that:

1. the value lands in `TestField` and **not** in `IsSupplier` (a misordered field fails
   here, silently passing every other check);
2. it comes back through `DFE1`;
3. it round-trips through update as well as insert;
4. `xerp` does not have the column and is **still saving its 28-field form correctly** —
   one company's change must not break another's;
5. `xerp` returns no `TestField` at all.

Cleans up after itself.

## FieldOrder live reload: `_hotreload.mjs`

```powershell
node _hotreload.mjs
```

Proves `src/companies/ash1/fieldOrder.json` is re-read without a server restart, by
appending a **second** field so the route must send 30 values to a 33-parameter procedure.
That must **fail loudly**. If it fails, the file is being re-read live; if the save still
succeeds, the order is stale and the cache is not keyed on mtime.

This is a negative test — a failure here is the expected outcome, and the script is
counting that correctly.

> ⚠️ It leaves **two successful `HOTRL` rows** in `tblfrmCustomer` in `ash1`. It does not
> clean them up. After running:
>
> ```sql
> DELETE FROM tblfrmCustomer WHERE "LedgerCode" LIKE 'HOTRL%';
> ```
>
> Add that cleanup to the script if you run it often.

## Every page: `_pages.mjs`

```powershell
node _pages.mjs
```

Walks every page in `src/forms`, exercising search, edit, save, delete, lock and print as
applicable, and reports pass/fail per page. 334 checks.

⚠️ It **writes to and deletes rows in the `xerp` database**. Run it against a company you
do not mind, or fix its row ownership first.

## Isolation: `_iso.mjs`

```powershell
node _iso.mjs
```

Per-company isolation, end to end. The question is not "does the API return 200" but:
**given two logins, does each land in its own database and nowhere else?** It writes a
distinct marker row in each and checks:

- each company sees its own marker;
- neither sees the other's;
- a token minted for one company cannot read the other's data;
- the `Custom` jsonb column and the field-order override stay company-local.

This is the test that matters most for the company's core promise. Run it after **any**
change to routing, the registry, the pool, or the field-order cache.

## Second-company coverage: `_sep.mjs`

```powershell
node _sep.mjs
```

Covers what `_pages.mjs` cannot, because that suite only ever runs against `xerp`:

1. the session token really is stored per company database;
2. a form override in a **real** company folder is served to that company only;
3. the other route groups — menu, security, custom fields — work on `ash1`.

## Custom fields: `_cf.mjs`

```powershell
node _cf.mjs
```

End-to-end over HTTP: define a field, write values, read them back, check the **merge
semantics** (a key in the payload is written, a key absent is left alone), deactivate a
field, and confirm the validation rejections (`400` for a malformed key, a wrong type, an
unknown entity). `_cfv.mjs` verifies the same `sp_cf_*` functions at the SQL level without
HTTP.

## Company name: `_cn.mjs`

```powershell
node _cn.mjs
```

Checks the `ash1` naming and login path directly.

## After a clone: `_clone_check.mjs`

```powershell
node _clone.mjs mumbai --from xerp --dry-run
node _clone.mjs mumbai --from xerp
node _clone_check.mjs
```

Verifies the clone is a fully working, independent company:

1. the running server picked it up from `companies.json` **with no restart**;
2. login works and it names itself correctly;
3. **a token minted for the source company is refused on the clone** — this is what
   clearing the copied session tokens prevents, and it is the check most likely to catch a
   real isolation bug;
4. the clone's data is its own — writes do not cross over;
5. all three companies are simultaneously reachable and distinct.

The clone is a real database, so this does write to it. Delete it afterwards.

## Registry resilience: `_cfg.mjs`

```powershell
node _cfg.mjs
```

The registry is a file people edit by hand, so its failure modes matter more than usual: a
typo must never take the server down or silently point a company at the wrong database.
This restores the original file on exit and exercises the bad cases — missing file, invalid
JSON, wrong shape, a bad entry, a duplicate id, a `default` that is not listed.

## Schema introspection: `_schema.mjs`

```powershell
node _schema.mjs
```

Prints columns, NOT NULL counts and unique indexes for the 17 form/detail tables. Use it
to confirm a migration actually landed, and to spot an index that is missing.

```powershell
node _diff.mjs        # what differs between xerp and ash1
```

The quickest way to answer "what is actually different between these two companies?" —
tables, columns, functions, row counts. More useful than comparing `form.json` files.

## Building the app

The frontend has no unit tests; a production build is the check.

```powershell
npm run build
```

Confirm the company override actually made it into the bundle — the company chunk should
contain your new field:

```powershell
Select-String -Path dist\assets\*.js -Pattern 'Test Field \(ash1 only\)'
```

Remember the glob in `src/formRegistry.js` is resolved at **build time**: a newly added
company form component needs a rebuild before it appears in a production bundle.

## Manual checks worth doing by hand

Automation misses the things users notice:

| Check | How |
|---|---|
| Grid feels fast on a big table | `node _seed.mjs 1000000` then search; check `X-Server-Ms` |
| Two browser windows, two companies | `sessionStorage` is per-tab, so log in as different companies in each — they must not interfere |
| Ctrl+Q picks up a `form.json` edit | edit the file, press Ctrl+Q, confirm the UI changed |
| A company with a bad `companies.json` entry | the server still boots and warns |
| Print page | `PRINT_ROW1` only; `PRINT1` does not exist |
| An unknown action | `POST /api/crud` with `"action": "_NOPE"` → `{ "error": "Unknown action: _NOPE" }` |

## Performance

```powershell
node _seed.mjs 1000000     # a million rows per form table, batched at 50k, idempotent
node _page.mjs             # paging latency
node _cc2.mjs              # cold vs cached row totals
```

`_cc2.mjs` measures a cold count over `frmhsn` (222k rows) and then five repeats, showing
the 15-second row-total cache at work. Compare the two: the gap is the cache.

The optimisations worth not breaking are listed in
[Grid performance techniques](04-sql-and-contract.md#grid-performance-techniques-baked-in)
— each is a measured fix, and each looks like an unnecessary complication.

⚠️ `_seed.mjs` inserts at scale into the database it targets. Check which one, and
`pg_dump` first.

## Rate limits will bite you

`600 requests / 60s` globally, and `10 logins / 15 minutes` on
`POST /api/auth/login`. Running several harnesses in a row can exceed the login limit,
which is exactly why `_tok.mjs` and `_auth.mjs` exist — they cache and re-mint rather than
logging in per script. If a script suddenly measures 401s, this is why.

Override for a test run if you must:

```powershell
$env:LOGIN_RATE_LIMIT_MAX = "1000"
$env:LOGIN_RATE_LIMIT_WINDOW_MS = "60000"
```

## When something fails

| Symptom | Look at |
|---|---|
| A grid returns 200 with no rows | the procedure errored server-side — `_SEARCH_JSON` swallows it and logs `Grid error:` |
| `401` from every call | token re-mint, or the login rate limit; see `_auth.mjs` |
| `Unknown company database: <id>` | the token's company is no longer registered — log out and back in |
| A save returns `Success` but the value is in the wrong field | the field order and the procedure signature disagree — [Path C](06-company-custom-form.md#path-c-add-a-real-column-for-one-company) |
| A field saves then reads back blank | the procedure's `RETURNS TABLE` wasn't extended — `DFE1` names its columns explicitly |
| An override doesn't show | cached 15s; press Ctrl+Q, or check `appliedOverride` in the `/api/form-config` response |
| A new company component is missing in production | the glob is build-time — rebuild |
| The app is slow | `X-Server-Ms` first, then `_cc2.mjs` |

## Where to go next

- What the tests are protecting: [01 — Architecture](01-architecture.md)
- The scripts in full: [07 — Tools and scripts](07-tools.md)
- What to do when a test correctly catches a real bug:
  [04 — SQL and the contract](04-sql-and-contract.md#known-gaps-at-the-end-of-this-document)
