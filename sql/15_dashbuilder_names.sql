/* =============================================================
   Name resolution for the dashboard builder.

   This database keeps mixed-case identifiers (tblBrand, tblfrmCustomer),
   and unquoted input folds to lower case. So a builder request may say
   "tblbrand" and the real relation is "tblBrand": resolve the name that
   actually exists and hand THAT to format('%I', ...). Never quote the
   caller's spelling.
   ============================================================= */

CREATE OR REPLACE FUNCTION public.sp_dash_resolve_table(p_name text)
RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT t.table_name
    FROM information_schema.tables t
   WHERE t.table_schema = 'public'
     AND t.table_type = 'BASE TABLE'
     AND lower(t.table_name) = lower(btrim(coalesce(p_name, '')))
   ORDER BY t.table_name
   LIMIT 1
$fn$;

CREATE OR REPLACE FUNCTION public.sp_dash_resolve_column(p_table text, p_column text)
RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT c.column_name
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND lower(c.table_name) = lower(btrim(coalesce(p_table, '')))
     AND lower(c.column_name) = lower(btrim(coalesce(p_column, '')))
   ORDER BY c.ordinal_position
   LIMIT 1
$fn$;
