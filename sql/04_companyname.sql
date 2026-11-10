-- 04_companyname.sql
-- ============================================================
-- How a company database names itself.
--
-- The database name IS the company id: the pool registry in
-- server/src/config/companies.js keys on it, the login screen offers it,
-- and it selects the company's form overrides in src/companies/<id>/.
-- So that id has to be readable from inside the database, and one place
-- should answer it.
--
-- By default the answer is the database name, which is what every company
-- wants and nobody has to configure. A company that wants a different name
-- for display overrides the function in its own database - no code change,
-- no redeploy:
--
--   CREATE OR REPLACE FUNCTION public.fn_companyname()
--   RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'BKE Logistics' $$;
--
-- Read it with:
--   SELECT public.fn_companyname();
--
-- Called at login (server/src/routes/auth.js). It is read-only and constant
-- for the life of a connection, so it is cheap; login caches nothing because
-- the answer cannot change under a running process.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_companyname()
RETURNS text
LANGUAGE sql
STABLE
AS $$ SELECT current_database()::text $$;

COMMENT ON FUNCTION public.fn_companyname() IS
  'Display name of this company. Defaults to the database name; redefine in a company database to override.';
