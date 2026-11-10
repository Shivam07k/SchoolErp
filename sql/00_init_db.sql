-- 00_init_db.sql -- run ONCE as superuser (postgres)
--   creates the app role + database. Idempotent.
--
-- Set a local password first (never commit a real one):
--   psql -U postgres -v app_password='choose-a-local-password' -f sql/00_init_db.sql
\if :{?app_password}
\else
  \set app_password 'change-me-local-dev'
\endif

SELECT format('CREATE ROLE xerp LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'xerp') \gexec

SELECT format('ALTER ROLE xerp WITH LOGIN PASSWORD %L', :'app_password') \gexec

SELECT 'CREATE DATABASE xerp OWNER xerp '
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'xerp') \gexec
