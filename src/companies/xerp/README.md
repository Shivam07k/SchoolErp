# xerp

Company-specific overrides for the **`xerp`** company (database `xerp`).

## How overrides work

A login resolves a form in this order, and stops at the first hit:

1. `src/forms/<formId>/*.jsx` — the common form. Never edited for one company.
2. `src/companies/xerp/forms/<formId>/*.jsx` — this company's copy, used instead.

For configuration, `GET /api/form-config/:formId?appId=xerp` deep-merges
`form.json` from this folder over the common one. Arrays of named objects
(entries carrying a `name`) merge by name; other arrays are replaced. So a
four-line file changes one thing and the rest of the common config survives.

## Adding an override

Copy the form out of the common folder, change only what this company needs:

```
src/forms/frmDeptSale3/ListPage.jsx            <- common, leave alone
src/companies/xerp/forms/frmDeptSale3/ListPage.jsx   <- this company's
```

Or, for configuration only, add just a `form.json` with the keys that differ.

Two costs to keep in mind:

- **Component overrides are resolved at build time** (`import.meta.glob`), so
  adding a `.jsx` here needs a frontend rebuild. A `form.json` alone does not.
- **A full copy has to be re-diffed whenever the common form changes.** Prefer
  the smallest override that does the job; reach for a full copy only when the
  layout genuinely differs.
- If an override needs a **new database column**, the generated SQL
  (`_gen.mjs`, which targets one database) has to be regenerated for that
  company's schema too. That is a bigger job than adding a form file.

This folder name must match the company id, which is the database name.
