# xErp Developer Documentation

This folder explains how the whole system fits together: how a request travels from
the browser to the database, what the API looks like, how the SQL layer is built, and
exactly what to do when you want to add a company or add a company-specific form/field.

Everything written here describes the repository at `C:\Users\hp\Desktop\exp\pg-xerp`.
If you ever see a second folder called `xErp` next to it, that is an unrelated older
snapshot — these docs do not cover it.

## The one-paragraph version

xErp is a React single-page app plus a small Express API, both talking to PostgreSQL
through stored procedures. The API is deliberately thin: it authenticates the user,
figures out *which company* the request belongs to, and calls a matching `sp_*`
PostgreSQL function with **positional parameters**. Almost all real logic lives in SQL.
Companies are isolated by giving each one its own database, chosen from a registry
file — never from anything the browser sends.

## Documentation map

Read in this order if you are new.

| # | Document | What you will learn |
|---|----------|---------------------|
| 00 | [This file](README.md) | Orientation, layout, how to run it, where to go next |
| 01 | [Architecture](01-architecture.md) | The big picture: processes, folders, the company model, the shared-vs-company split |
| 02 | [Request flow](02-request-flow.md) | Exactly what happens when a user clicks Save, step by step |
| 03 | [API reference](03-api.md) | Every endpoint, its body, its response, and the rules it enforces |
| 04 | [SQL and the contract](04-sql-and-contract.md) | The SQL layers, install order, `sp_*` conventions, and the generator |
| 05 | [Add a company](05-add-a-company.md) | Full step-by-step to provision, register, and use a new company |
| 06 | [Company custom form / field](06-company-custom-form.md) | Full step-by-step to customise one form for one company only |
| 07 | [Tools and scripts](07-tools.md) | Every script in `server/` and `sql/`, what it does, how to run it |
| 08 | [Testing](08-testing.md) | The test harnesses, how to run them, and how to stay out of trouble |

## Folder layout

```
pg-xerp/
├─ src/                     React app (browser side)
│  ├─ app.jsx               router, layout, auth gate
│  ├─ api.js                all HTTP calls; owns the auth token
│  ├─ formRegistry.js       chooses a form component: company first, then shared
│  ├─ components/           generic shell pieces (FormRenderer, Grid, etc.)
│  ├─ forms/                shared form implementations (frmCustomer, frmBrand, ...)
│  └─ companies/            per-company overrides (forms, fieldOrder.json, sql, README)
├─ server/                  Express API
│  ├─ index.js              mounts middleware and all routes
│  ├─ config/companies.json the company registry (edit this to add a company)
│  ├─ src/routes/           crud, auth, schema, customfields, menu, logs, security
│  ├─ src/db/               pool (per-company), sp (call a stored proc)
│  ├─ _*.mjs                one-off tools: provision, clone, migrate, gen, tests
│  └─ _contract.json        the contract: forms, tables, entities (generator input)
├─ sql/                     the SQL layer, applied in a fixed order to each database
└─ docs/                    these files
```

## Running it

Two processes. Start the API first.

```powershell
# 1) API — http://localhost:3100
cd server
npm install
npm run dev

# 2) App — http://localhost:5173
npm install
npm run dev
```

The React dev server proxies `/api` to the API, so in the browser you only ever talk
to `localhost:5173`. Sign in at `/login` with a seeded user such as `ADMIN`.

## The five rules that explain most of the codebase

1. **The database picks the company, not the browser.** The JWT says which company you
   belong to; the server looks that company up in `server/config/companies.json` and
   uses that database. A `company`/`appId` value in a request body is never trusted for
   routing. (See [Architecture](01-architecture.md#company-routing).)
2. **All logic is in SQL.** The API authenticates, routes, and marshals. Business rules
   and queries are `sp_*` functions. (See [SQL](04-sql-and-contract.md).)
3. **Stored-procedure arguments are positional.** Values are sent as a bare array in a
   fixed order; the last four are always `formId, FCODE, auth, ''`. Getting the order
   wrong can save data into the wrong field without erroring. (See
   [Request flow](02-request-flow.md#positional-parameters).)
4. **Shared first, company overrides second.** A company folder can shadow any shared
   form, field order, or add its own SQL; anything it does not define falls back to the
   shared version. (See [Architecture](01-architecture.md#shared-vs-company-overrides).)
5. **Custom differences are data, not code.** Most company-specific *fields* need no
   code at all — they are rows in a catalog (`tblFieldDef`) stored as JSON. Only a
   genuinely different *schema* or *form layout* justifies the per-company `sql/` and
   `forms/` folders. (See [Custom field](06-company-custom-form.md).)

## Where to go for common tasks

- I want a brand-new company → [05-add-a-company](05-add-a-company.md)
- I want one company to have an extra column on a form → [06-company-custom-form](06-company-custom-form.md) (data-only path, no code)
- I want one company to have a different form *layout* → [06-company-custom-form](06-company-custom-form.md) (override path)
- I want to understand an endpoint → [03-api](03-api.md)
- I want to understand the database → [04-sql-and-contract](04-sql-and-contract.md)
- I want to copy a company's whole database → [05-add-a-company](05-add-a-company.md#path-b-clone-an-existing-company) / [07-tools](07-tools.md#clone-a-database-_clonemjs)
- I want to regenerate form procedures after editing the contract → [04-sql-and-contract](04-sql-and-contract.md#the-generator-_genmjs) / [07-tools](07-tools.md#generate-form-sql-_genmjs)
- I want to add a brand-new form for everyone → see [06](06-company-custom-form.md#path-e-add-a-brand-new-form-for-everyone) and the generator notes in [04](04-sql-and-contract.md)

## Conventions used in these docs

- Code you type is in `backticks`; paths are exact and relative to `pg-xerp/`.
- ⚠️ marks something that can delete or break data.
- Field/procedure names keep their real capitalisation (`sp_frmCustomer_SAVE`,
  `TestField`) because PostgreSQL treats quoted names case-sensitively.
