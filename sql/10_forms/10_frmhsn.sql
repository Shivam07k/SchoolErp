-- ============================================================

-- frmhsn  (ported from old xErp sp_* contract)

-- table: tblfrmhsn

-- ============================================================

ALTER TABLE public."tblfrmhsn" ADD COLUMN IF NOT EXISTS "GSTper" numeric;

ALTER TABLE public."tblfrmhsn" ADD COLUMN IF NOT EXISTS "MinAmt" numeric;

ALTER TABLE public."tblfrmhsn" ADD COLUMN IF NOT EXISTS "MaxAmt" numeric;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_Grid2"(
    p_frmhsn_rows integer, p_frmhsn_no integer,
    p_hsn text,
    p_hsndescription text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text, p_frmhsn_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmhsn" a
        WHERE ((COALESCE(p_hsn, '') = '' OR a."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR a."HsnDescription"::text ILIKE '%' || p_hsndescription || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmhsn" t2 WHERE (COALESCE(p_hsn, '') = '' OR t2."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t2."HsnDescription"::text ILIKE '%' || p_hsndescription || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmhsn_no - 1) * p_frmhsn_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."Hsn",
               t."HsnDescription",
               t."GSTper",
               t."MinAmt",
               t."MaxAmt",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmhsn" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_hsn, '') = '' OR t."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t."HsnDescription"::text ILIKE '%' || p_hsndescription || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmhsn_rows
    )
    SELECT p."id", p."Hsn", p."HsnDescription", p."GSTper", p."MinAmt", p."MaxAmt", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmhsn_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_hsn, '') = ''
                     AND COALESCE(p_hsndescription, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmhsn"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmhsn" t WHERE (COALESCE(p_hsn, '') = '' OR t."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t."HsnDescription"::text ILIKE '%' || p_hsndescription || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmhsn_Hsn_trgm" ON public."tblfrmhsn" USING gin ("Hsn" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmhsn_HsnDescription_trgm" ON public."tblfrmhsn" USING gin ("HsnDescription" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_DFE1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."Hsn",
           t."HsnDescription",
           t."GSTper",
           t."MinAmt",
           t."MaxAmt",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmhsn" t
    WHERE t."Id" = p_frmhsn_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_SAVE"(
    
    p_hsn text,
    p_hsndescription text,
    p_gstper text,
    p_minamt text,
    p_maxamt text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmhsn_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmhsn_auth);
    INSERT INTO public."tblfrmhsn" ("Hsn", "HsnDescription", "GSTper", "MinAmt", "MaxAmt", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_hsn, ''), ''),
            COALESCE(NULLIF(p_hsndescription, ''), ''),
            CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            CASE WHEN trim(p_minamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_minamt::numeric ELSE 0 END,
            CASE WHEN trim(p_maxamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_maxamt::numeric ELSE 0 END,
            v_uid,
            COALESCE(NULLIF(p_frmhsn_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_UPDATE"(
    p_frmhsn_id bigint,
    p_hsn text,
    p_hsndescription text,
    p_gstper text,
    p_minamt text,
    p_maxamt text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmhsn"
    SET "Hsn" = COALESCE(NULLIF(p_hsn, ''), ''),
            "HsnDescription" = COALESCE(NULLIF(p_hsndescription, ''), ''),
            "GSTper" = CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            "MinAmt" = CASE WHEN trim(p_minamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_minamt::numeric ELSE 0 END,
            "MaxAmt" = CASE WHEN trim(p_maxamt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_maxamt::numeric ELSE 0 END,
            "FCODE" = COALESCE(NULLIF(p_frmhsn_fcode, ''), "FCODE")
    WHERE "Id" = p_frmhsn_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmhsn_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmhsn_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_Delete1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmhsn" WHERE "Id" = p_frmhsn_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_LockUnlock1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmhsn_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmhsn" WHERE "Id" = p_frmhsn_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmhsn"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmhsn_auth)
    WHERE "Id" = p_frmhsn_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmhsn_AddBlank"(
    p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "Hsn",
           NULL::text AS "HsnDescription",
           NULL::numeric AS "GSTper",
           NULL::numeric AS "MinAmt",
           NULL::numeric AS "MaxAmt",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_GridCount1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_GridCount1"(
    
    p_hsn text,
    p_hsndescription text,
    p_frmhsn_frm text, p_frmhsn_fcode text, p_frmhsn_auth text)
RETURNS TABLE("TotalPages" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT count(*)::bigint FROM public."tblfrmhsn" t
    WHERE (COALESCE(p_hsn, '') = '' OR t."Hsn"::text ILIKE '%' || p_hsn || '%')
          AND (COALESCE(p_hsndescription, '') = '' OR t."HsnDescription"::text ILIKE '%' || p_hsndescription || '%');
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmhsn_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmhsn_PRINT_ROW1"(
    p_frmhsn_id bigint, p_frmhsn_frm text, p_frmhsn_auth text, p_frmhsn_unused text)
RETURNS TABLE("id" bigint, "Hsn" text, "HsnDescription" text, "GSTper" numeric, "MinAmt" numeric, "MaxAmt" numeric, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."Hsn",
           t."HsnDescription",
           t."GSTper",
           t."MinAmt",
           t."MaxAmt",
           '[]'::jsonb AS "det1"
    FROM public."tblfrmhsn" t
    WHERE t."Id" = p_frmhsn_id;
END
$fn$;
