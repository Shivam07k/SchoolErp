-- ============================================================

-- frmitemno  (ported from old xErp sp_* contract)

-- table: tblfrmitemno

-- ============================================================

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Style" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Color" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "description" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Unit" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Category" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "MRP" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "Rate" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "GSM" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "HSN" text;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "GstPer" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "NetWt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "GrWt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "SqFt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "SqMtr" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "RateSqFt" numeric;

ALTER TABLE public."tblfrmitemno" ADD COLUMN IF NOT EXISTS "RateSqMtr" numeric;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_Grid2'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_Grid2"(
    p_frmitemno_rows integer, p_frmitemno_no integer,
    p_itemno text,
    p_title text,
    p_size text,
    p_frmitemno_frm text, p_frmitemno_fcode text, p_frmitemno_auth text, p_frmitemno_countmode text DEFAULT '')
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "FCODE" text, "LOCK" boolean, "LOCK_User_Id" text, "User_Id" text, "Created_At" text, "rc" bigint)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    WITH anchor AS MATERIALIZED (
        SELECT a."Id"
        FROM public."tblfrmitemno" a
        WHERE ((COALESCE(p_itemno, '') = '' OR a."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR a."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR a."Size"::text ILIKE '%' || p_size || '%'))
          AND (EXISTS (SELECT 1 FROM public."tblfrmitemno" t2 WHERE (COALESCE(p_itemno, '') = '' OR t2."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t2."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR t2."Size"::text ILIKE '%' || p_size || '%') LIMIT 1))
        ORDER BY a."Id" DESC
        LIMIT 1 OFFSET (p_frmitemno_no - 1) * p_frmitemno_rows
    ),
    page AS (
        SELECT t."Id" AS "id",
               t."ItemNo",
               t."Style",
               t."Size",
               t."Color",
               t."description",
               t."Unit",
               t."Category",
               t."Title",
               t."MRP",
               t."Rate",
               t."GSM",
               t."HSN",
               t."GstPer",
               t."NetWt",
               t."GrWt",
               t."SqFt",
               t."SqMtr",
               t."RateSqFt",
               t."RateSqMtr",
               t."FCODE",
               COALESCE(t."Lock", 0) <> 0 AS "LOCK",
               t."LOCK_User_Id",
               t."User_Id",
               to_char(t."Created_At", 'DD-Mon-YY') AS "Created_At"
        FROM public."tblfrmitemno" t
        WHERE t."Id" <= (SELECT a."Id" FROM anchor a)
          AND ((COALESCE(p_itemno, '') = '' OR t."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR t."Size"::text ILIKE '%' || p_size || '%'))
        ORDER BY t."Id" DESC
        LIMIT p_frmitemno_rows
    )
    SELECT p."id", p."ItemNo", p."Style", p."Size", p."Color", p."description", p."Unit", p."Category", p."Title", p."MRP", p."Rate", p."GSM", p."HSN", p."GstPer", p."NetWt", p."GrWt", p."SqFt", p."SqMtr", p."RateSqFt", p."RateSqMtr", p."FCODE", p."LOCK", p."LOCK_User_Id", p."User_Id", p."Created_At",
           CASE WHEN p_frmitemno_countmode = 'skip' THEN NULL ELSE CASE WHEN COALESCE(p_itemno, '') = ''
                     AND COALESCE(p_title, '') = ''
                     AND COALESCE(p_size, '') = ''
               THEN (SELECT GREATEST(c.reltuples::bigint, (SELECT count(*) FROM page))
                     FROM pg_class c WHERE c.oid = 'public."tblfrmitemno"'::regclass)
               ELSE (SELECT count(*) FROM public."tblfrmitemno" t WHERE (COALESCE(p_itemno, '') = '' OR t."ItemNo"::text ILIKE '%' || p_itemno || '%')
          AND (COALESCE(p_title, '') = '' OR t."Title"::text ILIKE '%' || p_title || '%')
          AND (COALESCE(p_size, '') = '' OR t."Size"::text ILIKE '%' || p_size || '%'))
          END END AS rc
    FROM page p;
END
$fn$;

DO $do$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_trgm') THEN
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE INDEX IF NOT EXISTS "idx_tblfrmitemno_ItemNo_trgm" ON public."tblfrmitemno" USING gin ("ItemNo" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmitemno_Title_trgm" ON public."tblfrmitemno" USING gin ("Title" gin_trgm_ops);

      CREATE INDEX IF NOT EXISTS "idx_tblfrmitemno_Size_trgm" ON public."tblfrmitemno" USING gin ("Size" gin_trgm_ops);

    END IF;
  END $do$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_DFE1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_DFE1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id" AS "id",
           t."ItemNo",
           t."Style",
           t."Size",
           t."Color",
           t."description",
           t."Unit",
           t."Category",
           t."Title",
           t."MRP",
           t."Rate",
           t."GSM",
           t."HSN",
           t."GstPer",
           t."NetWt",
           t."GrWt",
           t."SqFt",
           t."SqMtr",
           t."RateSqFt",
           t."RateSqMtr",
           COALESCE(t."Lock", 0) <> 0 AS "LOCK"
    FROM public."tblfrmitemno" t
    WHERE t."Id" = p_frmitemno_id;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_SAVE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_SAVE"(
    
    p_itemno text,
    p_style text,
    p_size text,
    p_color text,
    p_description text,
    p_unit text,
    p_category text,
    p_title text,
    p_mrp text,
    p_rate text,
    p_gsm text,
    p_hsn text,
    p_gstper text,
    p_netwt text,
    p_grwt text,
    p_sqft text,
    p_sqmtr text,
    p_ratesqft text,
    p_ratesqmtr text,
    p_frmitemno_frm text, p_frmitemno_fcode text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE
    v_uid text; v_id bigint;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemno_auth;
    v_uid := COALESCE(NULLIF(v_uid, ''), p_frmitemno_auth);
    INSERT INTO public."tblfrmitemno" ("ItemNo", "Style", "Size", "Color", "description", "Unit", "Category", "Title", "MRP", "Rate", "GSM", "HSN", "GstPer", "NetWt", "GrWt", "SqFt", "SqMtr", "RateSqFt", "RateSqMtr", "User_Id", "FCODE")
    VALUES (COALESCE(NULLIF(p_itemno, ''), ''),
            COALESCE(NULLIF(p_style, ''), ''),
            COALESCE(NULLIF(p_size, ''), ''),
            COALESCE(NULLIF(p_color, ''), ''),
            COALESCE(NULLIF(p_description, ''), ''),
            COALESCE(NULLIF(p_unit, ''), ''),
            COALESCE(NULLIF(p_category, ''), ''),
            COALESCE(NULLIF(p_title, ''), ''),
            CASE WHEN trim(p_mrp) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_mrp::numeric ELSE 0 END,
            CASE WHEN trim(p_rate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_rate::numeric ELSE 0 END,
            COALESCE(NULLIF(p_gsm, ''), ''),
            COALESCE(NULLIF(p_hsn, ''), ''),
            CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            CASE WHEN trim(p_netwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_netwt::numeric ELSE 0 END,
            CASE WHEN trim(p_grwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_grwt::numeric ELSE 0 END,
            CASE WHEN trim(p_sqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqft::numeric ELSE 0 END,
            CASE WHEN trim(p_sqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqmtr::numeric ELSE 0 END,
            CASE WHEN trim(p_ratesqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqft::numeric ELSE 0 END,
            CASE WHEN trim(p_ratesqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqmtr::numeric ELSE 0 END,
            v_uid,
            COALESCE(NULLIF(p_frmitemno_fcode, ''), 'HO'))
    RETURNING "Id" INTO v_id;
    RETURN QUERY SELECT 'Success'::text, ''::text, v_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_UPDATE'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_UPDATE"(
    p_frmitemno_id bigint,
    p_itemno text,
    p_style text,
    p_size text,
    p_color text,
    p_description text,
    p_unit text,
    p_category text,
    p_title text,
    p_mrp text,
    p_rate text,
    p_gsm text,
    p_hsn text,
    p_gstper text,
    p_netwt text,
    p_grwt text,
    p_sqft text,
    p_sqmtr text,
    p_ratesqft text,
    p_ratesqmtr text,
    p_frmitemno_frm text, p_frmitemno_fcode text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "id" bigint, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    UPDATE public."tblfrmitemno"
    SET "ItemNo" = COALESCE(NULLIF(p_itemno, ''), ''),
            "Style" = COALESCE(NULLIF(p_style, ''), ''),
            "Size" = COALESCE(NULLIF(p_size, ''), ''),
            "Color" = COALESCE(NULLIF(p_color, ''), ''),
            "description" = COALESCE(NULLIF(p_description, ''), ''),
            "Unit" = COALESCE(NULLIF(p_unit, ''), ''),
            "Category" = COALESCE(NULLIF(p_category, ''), ''),
            "Title" = COALESCE(NULLIF(p_title, ''), ''),
            "MRP" = CASE WHEN trim(p_mrp) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_mrp::numeric ELSE 0 END,
            "Rate" = CASE WHEN trim(p_rate) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_rate::numeric ELSE 0 END,
            "GSM" = COALESCE(NULLIF(p_gsm, ''), ''),
            "HSN" = COALESCE(NULLIF(p_hsn, ''), ''),
            "GstPer" = CASE WHEN trim(p_gstper) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_gstper::numeric ELSE 0 END,
            "NetWt" = CASE WHEN trim(p_netwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_netwt::numeric ELSE 0 END,
            "GrWt" = CASE WHEN trim(p_grwt) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_grwt::numeric ELSE 0 END,
            "SqFt" = CASE WHEN trim(p_sqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqft::numeric ELSE 0 END,
            "SqMtr" = CASE WHEN trim(p_sqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_sqmtr::numeric ELSE 0 END,
            "RateSqFt" = CASE WHEN trim(p_ratesqft) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqft::numeric ELSE 0 END,
            "RateSqMtr" = CASE WHEN trim(p_ratesqmtr) ~ '^-?[0-9]*\.?[0-9]+$' THEN p_ratesqmtr::numeric ELSE 0 END,
            "FCODE" = COALESCE(NULLIF(p_frmitemno_fcode, ''), "FCODE")
    WHERE "Id" = p_frmitemno_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, p_frmitemno_id, 'Record not found'::text;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'Success'::text, ''::text, p_frmitemno_id, NULL::text;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'Error'::text, SQLERRM, NULL::bigint, SQLERRM;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_Delete1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_Delete1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
BEGIN
    
    DELETE FROM public."tblfrmitemno" WHERE "Id" = p_frmitemno_id;
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
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_LockUnlock1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_LockUnlock1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("status" text, "message" text, "Error" text)
LANGUAGE plpgsql AS $fn$
DECLARE v_uid text; v_lock boolean;
BEGIN
    SELECT "UserId" INTO v_uid FROM public."tblHO_User" WHERE "token" = p_frmitemno_auth;
    SELECT COALESCE("Lock", 0) <> 0 INTO v_lock
    FROM public."tblfrmitemno" WHERE "Id" = p_frmitemno_id;
    IF v_lock IS NULL THEN
        RETURN QUERY SELECT 'Error'::text, 'Record not found'::text, 'Record not found'::text;
        RETURN;
    END IF;
    UPDATE public."tblfrmitemno"
    SET "Lock" = CASE WHEN COALESCE("Lock", 0) <> 0 THEN 0 ELSE 1 END,
        "LOCK_User_Id" = COALESCE(NULLIF(v_uid, ''), p_frmitemno_auth)
    WHERE "Id" = p_frmitemno_id;
    RETURN QUERY SELECT 'Success'::text, CASE WHEN v_lock THEN 'Unlocked' ELSE 'Locked' END, NULL::text;
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmitemno_AddBlank'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public."sp_frmitemno_AddBlank"(
    p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "LOCK" boolean)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY SELECT NULL::bigint AS "id",
           NULL::text AS "ItemNo",
           NULL::text AS "Style",
           NULL::text AS "Size",
           NULL::text AS "Color",
           NULL::text AS "description",
           NULL::text AS "Unit",
           NULL::text AS "Category",
           NULL::text AS "Title",
           NULL::numeric AS "MRP",
           NULL::numeric AS "Rate",
           NULL::text AS "GSM",
           NULL::text AS "HSN",
           NULL::numeric AS "GstPer",
           NULL::numeric AS "NetWt",
           NULL::numeric AS "GrWt",
           NULL::numeric AS "SqFt",
           NULL::numeric AS "SqMtr",
           NULL::numeric AS "RateSqFt",
           NULL::numeric AS "RateSqMtr",
           false AS "LOCK";
END
$fn$;

DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'sp_frmItemNo_PRINT_ROW1'
    LOOP EXECUTE 'DROP FUNCTION ' || r.sig || ' CASCADE'; END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public."sp_frmItemNo_PRINT_ROW1"(
    p_frmitemno_id bigint, p_frmitemno_frm text, p_frmitemno_auth text, p_frmitemno_unused text)
RETURNS TABLE("id" bigint, "ItemNo" text, "Style" text, "Size" text, "Color" text, "description" text, "Unit" text, "Category" text, "Title" text, "MRP" numeric, "Rate" numeric, "GSM" text, "HSN" text, "GstPer" numeric, "NetWt" numeric, "GrWt" numeric, "SqFt" numeric, "SqMtr" numeric, "RateSqFt" numeric, "RateSqMtr" numeric, "det1" jsonb)
LANGUAGE plpgsql AS $fn$
BEGIN
    RETURN QUERY
    SELECT t."Id",
           t."ItemNo",
           t."Style",
           t."Size",
           t."Color",
           t."description",
           t."Unit",
           t."Category",
           t."Title",
           t."MRP",
           t."Rate",
           t."GSM",
           t."HSN",
           t."GstPer",
           t."NetWt",
           t."GrWt",
           t."SqFt",
           t."SqMtr",
           t."RateSqFt",
           t."RateSqMtr",
           '[]'::jsonb AS "det1"
    FROM public."tblfrmitemno" t
    WHERE t."Id" = p_frmitemno_id;
END
$fn$;
