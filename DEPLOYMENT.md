# Deploying School ERP on Render + Supabase

This guide takes the repository from GitHub to a running Render web service whose
database lives in Supabase.

```
GitHub repo  ──►  Render web service  ──►  Supabase PostgreSQL
                  (Node 22, SPA + API)      (session pooler, TLS)
```

You need:

- a Supabase project (free tier is enough to start),
- a Render account connected to GitHub,
- this repository pushed to `https://github.com/Shivam07k/SchoolErp.git`.

---

## 1. Create the Supabase database

1. Sign in at <https://supabase.com>, **New project**.
2. Choose the region closest to your Render region (Singapore pairs well with
   Render's `singapore` region), set a database password and save it somewhere
   safe. You will not see it again.
3. Wait until the project finishes provisioning.

### Copy the connection details

Supabase Dashboard → **Project Settings** → **Database** → **Connection
pooling**. Use the **Session** mode values, not the transaction pooler:

| Setting  | Value                                  |
| -------- | -------------------------------------- |
| Host     | `aws-0-<region>.pooler.supabase.com`   |
| Port     | `5432`                                 |
| User     | `postgres.<project-ref>`               |
| Password | the database password from step 1      |
| Database | `postgres`                             |

Why session mode: the app uses explicit transactions and PostgreSQL advisory
locks, which the transaction pooler (port 6543) does not preserve.

> The direct connection host (`db.<project-ref>.supabase.co`) is IPv6-only on
> new projects and will not resolve from Render. Use the pooler host above.

### Optional: keep uploads in Supabase Storage

Render's free filesystem is wiped on every deploy. Uploaded photos and
documents then disappear. To keep them:

1. Supabase Dashboard → **Storage** → **New bucket** → name it
   `school-uploads`, keep it **private** (no public access).
2. Project Settings → **API** → copy the **Project URL** and the
   **`service_role`** key.
3. Set these three variables on Render (see step 4):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
   Uploads are then written to the bucket and streamed back through the API, so
   the bucket can stay private.

If these are left unset the app writes to `server/uploads/private`, which only
works while the disk survives. Never expose the `service_role` key to the
browser or commit it.

---

## 2. Create the schema

The repo ships a migration runner that records applied files in
`schema_migrations`, so it is safe to run more than once.

Run it **once, from your machine**, pointing at Supabase. In PowerShell:

```powershell
$env:PG_HOST        = "aws-0-<region>.pooler.supabase.com"
$env:PG_PORT        = "5432"
$env:PG_USER        = "postgres.<project-ref>"
$env:PG_PASSWORD    = "<database password>"
$env:PG_DATABASE    = "postgres"
$env:PG_SSL         = "true"
$env:COMPANY_NAME   = "Your School Name"

npm --prefix server run db:migrate
```

Alternative: put the full connection string in `SUPABASE_DB_URL` and skip the
`PG_*` variables:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
$env:COMPANY_NAME    = "Your School Name"
npm --prefix server run db:migrate
```

This creates roughly 480 tables, the security/user tables, all school modules,
the role and permission catalogue, a default campus and academic data, and sets
the display name returned at login.

### Create the first administrator

```powershell
$env:ADMIN_PASSWORD = "<a strong password, at least 8 characters>"
npm --prefix server run db:seed-admin
```

The account id is `ADMIN` by default; override with `ADMIN_USERID`. Sign in with
this password at the Render URL afterwards.

> Re-running `db:seed-admin` resets the password of an existing user, so it can
> also be used to recover access. Keep `JWT_SECRET` stable: changing it signs
> everybody out.

---

## 3. Push the repository

```powershell
git remote add origin https://github.com/Shivam07k/SchoolErp.git
git push -u origin main
```

`.gitignore` already excludes `.env`, database dumps, logs, uploads and the
plaintext credential files used during local setup.

---

## 4. Create the Render service

1. Render Dashboard → **New** → **Blueprint**.
2. Connect GitHub and pick `Shivam07k/SchoolErp`.
3. Render reads [`render.yaml`](render.yaml) and prompts for:
   - `PG_HOST` – the Supabase pooler host,
   - `PG_USER` – `postgres.<project-ref>`,
   - `PG_PASSWORD` – the database password.
4. Apply. The first deploy builds the React app, installs the server
   dependencies and starts `node server/src/index.js`.

Render generates `JWT_SECRET` automatically. `PG_PORT`, `PG_DATABASE`,
`PG_SSL`, `PG_MAX`, `NODE_ENV` and the rate limits come from `render.yaml`.

`CORS_ORIGIN` is optional: the server falls back to Render's
`RENDER_EXTERNAL_URL`. Set it only if you add a custom domain, e.g.
`https://erp.example.com`.

The health check is `GET /api/healthz`; a deploy only goes live when the
database answers.

### If you prefer a manual service instead of the Blueprint

| Setting        | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| Runtime        | Node                                                              |
| Build command  | `npm ci --include=dev && npm run build && npm --prefix server ci --omit=dev` |
| Start command  | `node server/src/index.js`                                        |
| Health check   | `/api/healthz`                                                    |

Then add the environment variables listed in [`.env.example`](.env.example) or
`render.yaml`, with `NODE_ENV=production`.

---

## 5. Verify

```powershell
Invoke-RestMethod https://<service>.onrender.com/api/healthz
Invoke-RestMethod https://<service>.onrender.com/api/auth/companies
```

Then open the service URL, sign in as `ADMIN` with the password from step 2 and
check **Dashboard**, **Students** and **Users & Access**.

---

## Updating

Push to `main`; Render redeploys automatically (`autoDeploy: true`). If you add
a new file to `sql/`, add it to the `files` array in
`server/scripts/db-migrate.mjs` and run `db:migrate` again — already-applied
files are skipped.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Deploy fails at `Validation failed` / `Invalid production configuration` | A required variable is missing or `JWT_SECRET` is shorter than 32 characters. |
| `password authentication failed` | Use the pooler user `postgres.<project-ref>`, not plain `postgres`, and the database password, not the Supabase account password. |
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` | New Supabase projects are IPv6-only on the direct host. Use the session pooler host. |
| `remaining connection slots are reserved` | Lower `PG_MAX` (5 is set in `render.yaml`) or raise the Supabase pool size. |
| Login works but the screen is blank | Check the browser console: the SPA may be calling a different origin. Set `CORS_ORIGIN` to the exact Render URL. |
| Uploads disappear after a deploy | The Render disk is ephemeral. Configure Supabase Storage (step 1). |
| First request after idle is slow | Expected on Render's free plan; the instance sleeps after 15 minutes. Upgrade to remove it. |
| `relation "..." does not exist` | `db:migrate` was not run against this database, or a new SQL file was not added to the runner. |

---

## Security notes

- Never commit `.env`, the Supabase `service_role` key or database dumps.
- `MASTER_PASSWORD` login is refused in production unless
  `ALLOW_MASTER_PASSWORD=true`. Leave it unset.
- The Supabase Storage bucket must stay private; files are served through the
  authenticated `/api/school/uploads/...` route.
- Rotate the database password from the Supabase dashboard if it is ever
  exposed, then update `PG_PASSWORD` on Render.
