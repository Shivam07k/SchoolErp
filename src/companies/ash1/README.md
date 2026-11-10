# ash1

Company-specific overrides for the **`ash1`** company (database `ash1`).

## How overrides work

A login resolves a form in this order, and stops at the first hit:

1. `src/forms/<formId>/*.jsx` — the common form. Never edited for one company.
2. `src/companies/ash1/forms/<formId>/*.jsx` — this company's copy, used instead.

For configuration, `GET /api/form-config/:formId?appId=ash1` deep-merges
`form.json` from this folder over the common one. Arrays of named objects
(entries carrying a `name`) merge by name; other arrays are replaced. So a
four-line file changes one thing and the rest of the common config survives.

## Adding an override

Copy the form out of the common folder and change only what this company needs.
Do it with the helper, not `cp` — the copy sits two levels deeper, so every
`../../` import has to be re-based or the frontend will not build:

```
node server/_copyform.mjs frmDeptSale3 ash1
```

It re-bases the imports and refuses to overwrite an existing override without
`--force`, since the point of a copy is to diverge from the common version.

```
src/forms/frmDeptSale3/ListPage.jsx                 <- common, leave alone
src/companies/ash1/forms/frmDeptSale3/ListPage.jsx  <- this company's
```

Or, for configuration only, add just a `form.json` with the keys that differ.

Three costs to keep in mind:

- **Component overrides are resolved at build time** (`import.meta.glob`), so
  adding a `.jsx` here needs a frontend rebuild. A `form.json` alone does not.
- **A full copy has to be re-diffed whenever the common form changes.** Prefer
  the smallest override that does the job; reach for a full copy only when the
  layout genuinely differs.
- **A full copy also stops receiving generator improvements.** These files were
  produced by `_gen.mjs`; if the common form is regenerated, diff it against
  this copy.

## A field this company does not share

`frmCustomer` here has a `TestField` that `xerp` has no equivalent of. Three
pieces, and all three are needed — a form field with no column, or a column with
no proc, fails on save:

| Piece | File | What it does |
| --- | --- | --- |
| The input | `forms/frmCustomer/AddEditPage.jsx` | `TestField` as the last `headerFields` entry |
| Its position | `fieldOrder.json` | `"header": { "append": ["TestField"] }` |
| Its storage | `sql/01_frmcustomer_testfield.sql` | the column + `sp_frmCustomer_SAVE` / `_UPDATE` / `_DFE1` |

Apply the SQL to this company only:

```
node server/_migrate.mjs ash1            # apply
node server/_migrate.mjs ash1 --status   # what ran, what is pending
```

`fieldOrder.json` and the SQL have to agree, and both have to agree with the
form. The `sp_*` procs are called **positionally** as
`(<fields...>, formId, FCODE, auth, '')`, so `TestField` has to be the 29th
field in all three places. Get it wrong and the save still reports `Success`
while writing the value into `IsSupplier` — a misordered field does not error,
it corrupts the neighbouring column. `server/_tf.mjs` checks for exactly that.

Both files are picked up live: editing `fieldOrder.json` takes effect on the next
request, with no restart.

This folder name must match the company id, which is the database name.
