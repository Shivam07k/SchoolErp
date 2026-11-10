-- 12_customfields.sql
-- ============================================================
-- Per-company custom fields.
--
-- Every company runs its own PostgreSQL database but shares this one
-- codebase. The rule that keeps a single artifact set working is:
-- the *core schema is identical everywhere* and every company-specific
-- difference is stored as data, never as DDL. This file is the data
-- layer that makes that possible.
--
-- Two tables, one idea:
--   tblFieldDef  - the catalog: what extra fields exist, and how to
--                  render them. A row present in a database IS the
--                  activation switch for that company, so no separate
--                  enable table is needed.
--   "Custom"     - a jsonb column on the base table holding the values.
--
-- Why jsonb on the row instead of a child value table:
--   * values live *inside* the record, so they cannot leak across
--     companies and they disappear with the row (no orphan sweep);
--   * enabling a field costs no write at all;
--   * a child table forces a join on every grid read, and the grid
--     read path is the hot path here.
-- The price is per-field indexing, which GIN jsonb_path_ops covers for
-- containment and equality - the only queries a custom field gets.
--
-- Field_Key is a STABLE identifier like 'frmhsn.remark' and is
-- deliberately not a surrogate: two companies that want the same field
-- reference the same key, so a shared catalog can activate it in both
-- and cross-company exports stay comparable.
--
-- sp_cf_ensure() adds the column to any base table on demand, so a new
-- entity needs no migration - the route calls it the first time an
-- entity is used. Applying this file to a company database is the only
-- schema step, and it is idempotent.
-- ============================================================

BEGIN;

-- ---------- 1. the catalog ----------

CREATE TABLE IF NOT EXISTS public."tblFieldDef" (
  "Field_Key"  text PRIMARY KEY,
  "Entity"     text NOT NULL,
  "Label"      text NOT NULL,
  "Data_Type"  text NOT NULL DEFAULT 'text',
  "Options"    jsonb,
  "Required"   boolean NOT NULL DEFAULT false,
  "Active"     boolean NOT NULL DEFAULT true,
  "Ordinal"    int NOT NULL DEFAULT 100,
  "Created_At" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chkFieldDefType" CHECK ("Data_Type" IN ('text','number','date','bool','lookup'))
);

CREATE INDEX IF NOT EXISTS "ixFieldDefEntity" ON public."tblFieldDef" ("Entity") WHERE "Active";

-- ---------- 2. per-entity column + index, created on demand ----------

DROP FUNCTION IF EXISTS public.sp_cf_ensure(text);
CREATE FUNCTION public.sp_cf_ensure(p_table text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok boolean;
BEGIN
  /* dynamic SQL cannot be parameterised, so the identifier is whitelisted
     and confirmed to exist before it reaches format() */
  IF p_table !~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'cf: invalid table name %', p_table USING ERRCODE = '22023';
  END IF;
  /* matched EXACTLY, not case-folded: the tables are a mix of "tblfrmhsn"
     and "tblBrand", and lower() would fail to find every camelCase one.
     Callers pass the name straight from the form contract. */
  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = p_table AND n.nspname = 'public' AND c.relkind = 'r') INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'cf: unknown table %', p_table USING ERRCODE = '22023';
  END IF;

  /* NOT NULL DEFAULT '{}' is a metadata-only change in PG 11+, so this
     does not rewrite the table */
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS "Custom" jsonb NOT NULL DEFAULT ''{}''::jsonb', p_table);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin ("Custom" jsonb_path_ops)',
                 'ix_' || lower(p_table) || '_custom', p_table);
  RETURN p_table;
END;
$$;

-- ---------- 3. value coercion ----------
-- Anything not declared for the entity is dropped, and a value that does
-- not match its declared type is rejected rather than stored, so a bad
-- payload cannot poison the jsonb for every later reader.

DROP FUNCTION IF EXISTS public.sp_cf_clean(text, jsonb);
CREATE FUNCTION public.sp_cf_clean(p_entity text, p_vals jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  d    record;
  out  jsonb := '{}'::jsonb;
  v    jsonb;
  t    text;
BEGIN
  IF p_vals IS NULL OR jsonb_typeof(p_vals) <> 'object' THEN
    RETURN out;
  END IF;

  FOR d IN SELECT "Field_Key", "Data_Type" FROM public."tblFieldDef"
           WHERE "Entity" = p_entity AND "Active" LOOP
    v := p_vals -> d."Field_Key";
    CONTINUE WHEN v IS NULL OR jsonb_typeof(v) = 'null';
    t := trim(both '"' FROM v::text);
    /* a blank clears the value: the key is simply not written back */
    CONTINUE WHEN t = '';

    CASE d."Data_Type"
      WHEN 'number' THEN
        IF t !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
          RAISE EXCEPTION 'cf: field % expects a number, got %', d."Field_Key", t USING ERRCODE = '22023';
        END IF;
        out := out || jsonb_build_object(d."Field_Key", t::numeric);
      WHEN 'date' THEN
        IF t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
          RAISE EXCEPTION 'cf: field % expects YYYY-MM-DD, got %', d."Field_Key", t USING ERRCODE = '22023';
        END IF;
        out := out || jsonb_build_object(d."Field_Key", t::date);
      WHEN 'bool' THEN
        out := out || jsonb_build_object(d."Field_Key", lower(t) IN ('true','1','t','y','yes','on'));
      ELSE
        out := out || jsonb_build_object(d."Field_Key", t);
    END CASE;
  END LOOP;

  RETURN out;
END;
$$;

-- ---------- 4. catalog read / write ----------

DROP FUNCTION IF EXISTS public.sp_cf_defs(text);
CREATE FUNCTION public.sp_cf_defs(p_entity text)
RETURNS TABLE("Field_Key" text, "Label" text, "Data_Type" text, "Options" jsonb, "Required" boolean, "Ordinal" int)
LANGUAGE sql STABLE
AS $$
  SELECT d."Field_Key", d."Label", d."Data_Type", d."Options", d."Required", d."Ordinal"
  FROM public."tblFieldDef" d
  WHERE d."Entity" = p_entity AND d."Active"
  ORDER BY d."Ordinal", d."Field_Key";
$$;

DROP FUNCTION IF EXISTS public.sp_cf_save_def(text, text, text, text, jsonb, boolean, int);
CREATE FUNCTION public.sp_cf_save_def(
  p_key text, p_entity text, p_label text, p_type text,
  p_options jsonb, p_required boolean, p_ordinal int)
RETURNS TABLE("f_key" text, "f_label" text, "f_type" text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_old text;
BEGIN
  /* The OUT params are deliberately NOT named Field_Key/Label/Data_Type. In
     plpgsql an OUT param is a variable, and the ON CONFLICT target list
     ("Label" = EXCLUDED."Label") names the column unqualified - so a matching
     variable makes the reference ambiguous. Verified: renaming the OUT params
     is what makes this compile. */
  /* the key is part of the shared contract, so its shape is enforced:
     <entity>.<field>. The entity segment keeps the form's real casing
     (frmItemNoDyn, fromProcess) while the field segment is lower snake. */
  IF p_key !~ '^[A-Za-z][A-Za-z0-9_]*\.[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'cf: field_key must look like entity.field_name, got %', p_key USING ERRCODE = '22023';
  END IF;
  IF p_label IS NULL OR btrim(p_label) = '' THEN
    RAISE EXCEPTION 'cf: a label is required' USING ERRCODE = '22023';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('text','number','date','bool','lookup') THEN
    RAISE EXCEPTION 'cf: unsupported data_type %', coalesce(p_type,'(null)') USING ERRCODE = '22023';
  END IF;

  SELECT d."Data_Type" INTO v_old FROM public."tblFieldDef" d WHERE d."Field_Key" = p_key;

  /* retyping a field that already holds values would leave data that no
     longer matches the declared type, so refuse rather than corrupt */
  IF v_old IS NOT NULL AND v_old <> p_type THEN
    RAISE EXCEPTION 'cf: field % is % and already holds values; clear them before changing the type', p_key, v_old USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public."tblFieldDef" AS d
    ("Field_Key","Entity","Label","Data_Type","Options","Required","Ordinal")
  VALUES (p_key, p_entity, btrim(p_label), p_type, p_options, coalesce(p_required,false), coalesce(p_ordinal,100))
  ON CONFLICT ("Field_Key") DO UPDATE
    SET "Label"    = EXCLUDED."Label",
        "Data_Type" = EXCLUDED."Data_Type",
        "Options"   = EXCLUDED."Options",
        "Required"  = EXCLUDED."Required",
        "Ordinal"   = EXCLUDED."Ordinal",
        "Active"    = true
  RETURNING d."Field_Key", d."Label", d."Data_Type";
END;
$$;

-- ---------- 5. value read / write ----------

DROP FUNCTION IF EXISTS public.sp_cf_values(text, bigint[]);
CREATE FUNCTION public.sp_cf_values(p_table text, p_ids bigint[])
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok  boolean;
  v_out jsonb := '{}'::jsonb;
  r     record;
BEGIN
  IF p_table !~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'cf: invalid table name %', p_table USING ERRCODE = '22023';
  END IF;
  /* matched EXACTLY, not case-folded: the tables are a mix of "tblfrmhsn"
     and "tblBrand", and lower() would fail to find every camelCase one.
     Callers pass the name straight from the form contract. */
  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = p_table AND n.nspname = 'public' AND c.relkind = 'r') INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'cf: unknown table %', p_table USING ERRCODE = '22023';
  END IF;

  FOR r IN EXECUTE format(
      'SELECT t."Id"::text AS id, t."Custom" FROM public.%I t WHERE t."Id" = ANY($1)', p_table)
    USING p_ids
  LOOP
    v_out := v_out || jsonb_build_object(r.id, coalesce(r."Custom", '{}'::jsonb));
  END LOOP;

  RETURN v_out;
END;
$$;

DROP FUNCTION IF EXISTS public.sp_cf_save_values(text, text, bigint, jsonb);
CREATE FUNCTION public.sp_cf_save_values(p_entity text, p_table text, p_id bigint, p_vals jsonb)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean jsonb;
  v_keys  text[];
  v_new   jsonb;
  v_n     int;
BEGIN
  IF p_table !~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'cf: invalid table name %', p_table USING ERRCODE = '22023';
  END IF;
  v_clean := public.sp_cf_clean(p_entity, p_vals);

  /* Semantics that satisfies both callers: a key present in the payload is
     written (blank clears it), a key absent is left alone. A form that
     submits every field behaves as a replace; a client patching one field
     behaves as a merge, so two users editing different fields cannot
     clobber each other.

     The submitted keys are collected as a real text[] and handed to EXECUTE
     as a parameter. Building an array by string concatenation and casting
     it instead would produce a value like 'a','b', which is not a valid
     array literal. */
  SELECT coalesce(array_agg(k), '{}'::text[]) INTO v_keys
  FROM jsonb_object_keys(
    CASE WHEN v_clean <> '{}'::jsonb THEN v_clean ELSE coalesce(p_vals, '{}'::jsonb) END) AS k;

  IF v_keys = '{}'::text[] THEN
    RETURN 'ok:0';
  END IF;

  EXECUTE format(
    'UPDATE public.%I SET "Custom" = (COALESCE("Custom",''{}''::jsonb) - $1::text[]) || $2::jsonb
     WHERE "Id" = $3 RETURNING "Custom"', p_table)
    USING v_keys, v_clean, p_id
  INTO v_new;

  /* "Custom" is NOT NULL, so a NULL target means the UPDATE matched no row.
     Testing v_new rather than FOUND: FOUND is not reliably cleared by an
     EXECUTE ... INTO here, which silently reported a missing record as ok. */
  IF v_new IS NULL THEN
    RETURN 'no such record';
  END IF;
  /* there is no jsonb_object_length; counting the keys is the way */
  SELECT count(*) INTO v_n FROM jsonb_object_keys(coalesce(v_new, '{}'::jsonb));

  RETURN 'ok:' || v_n::text;
END;
$$;

-- ---------- 6. hygiene ----------
-- These functions take a table name and build dynamic SQL, so they are not
-- left callable by PUBLIC. This is defence in depth only: the owner account
-- the app connects as bypasses it, which is why the route additionally
-- resolves the entity through the form contract and never forwards a
-- caller-supplied table name.

REVOKE ALL ON FUNCTION public.sp_cf_ensure(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sp_cf_values(text, bigint[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sp_cf_save_values(text, text, bigint, jsonb) FROM PUBLIC;

COMMIT;
